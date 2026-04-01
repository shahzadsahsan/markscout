import Foundation
import UIKit
import UniformTypeIdentifiers

class SyncFolderManager {
    private let bookmarkKey = "syncFolderBookmark"

    var hasSavedBookmark: Bool {
        UserDefaults.standard.data(forKey: bookmarkKey) != nil
    }

    func saveBookmark(for url: URL) throws {
        let data = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        UserDefaults.standard.set(data, forKey: bookmarkKey)
    }

    func resolveBookmark() throws -> URL {
        guard let data = UserDefaults.standard.data(forKey: bookmarkKey) else {
            throw SyncError.noBookmark
        }
        var isStale = false
        let url = try URL(resolvingBookmarkData: data, bookmarkDataIsStale: &isStale)
        if isStale {
            throw SyncError.staleBookmark
        }
        return url
    }

    // MARK: - Reading

    func readManifest() async throws -> SyncManifest {
        let folderURL = try resolveBookmark()
        guard folderURL.startAccessingSecurityScopedResource() else {
            throw SyncError.accessDenied
        }
        defer { folderURL.stopAccessingSecurityScopedResource() }

        let manifestURL = folderURL.appendingPathComponent("manifest.json")

        // Check if the file exists at all (even as an iCloud placeholder)
        let exists = FileManager.default.fileExists(atPath: manifestURL.path)
        if !exists {
            // Check if there's an .icloud placeholder
            let icloudName = ".\(manifestURL.lastPathComponent).icloud"
            let icloudURL = manifestURL.deletingLastPathComponent().appendingPathComponent(icloudName)
            let placeholderExists = FileManager.default.fileExists(atPath: icloudURL.path)

            if !placeholderExists {
                // List what IS in the folder to help debug
                let contents = (try? FileManager.default.contentsOfDirectory(atPath: folderURL.path)) ?? []
                throw SyncError.manifestNotFoundDetail(
                    "manifest.json not found in selected folder. Folder contains: \(contents.isEmpty ? "nothing" : contents.joined(separator: ", "))"
                )
            }
        }

        try await ensureDownloaded(manifestURL, timeout: 60)
        let data = try Data(contentsOf: manifestURL)
        return try JSONDecoder().decode(SyncManifest.self, from: data)
    }

    func readFileContent(relativePath: String) async throws -> String {
        let folderURL = try resolveBookmark()
        guard folderURL.startAccessingSecurityScopedResource() else {
            throw SyncError.accessDenied
        }
        defer { folderURL.stopAccessingSecurityScopedResource() }

        let fileURL = folderURL.appendingPathComponent("files").appendingPathComponent(relativePath)
        try await ensureDownloaded(fileURL, timeout: 60)
        return try String(contentsOf: fileURL, encoding: .utf8)
    }

    // MARK: - Batch Download

    /// Downloads all files from manifest with progress reporting.
    /// Returns the number of files successfully downloaded.
    func downloadAllFiles(
        manifest: SyncManifest,
        onProgress: @MainActor @Sendable @escaping (Int, Int) -> Void
    ) async -> Int {
        let folderURL: URL
        do {
            folderURL = try resolveBookmark()
        } catch {
            return 0
        }
        guard folderURL.startAccessingSecurityScopedResource() else { return 0 }
        defer { folderURL.stopAccessingSecurityScopedResource() }

        let total = manifest.files.count
        var downloaded = 0

        for (index, file) in manifest.files.enumerated() {
            let fileURL = folderURL.appendingPathComponent("files").appendingPathComponent(file.relativePath)
            do {
                try await ensureDownloaded(fileURL, timeout: 30)
                downloaded += 1
            } catch {
                // Skip files that fail to download — they'll be tried again later
            }
            await MainActor.run { onProgress(index + 1, total) }
        }

        return downloaded
    }

    // MARK: - Download Helper

    /// Triggers download of an iCloud-evicted file and waits until it's available.
    private func ensureDownloaded(_ url: URL, timeout: Int) async throws {
        // Already downloaded and readable
        let values = try? url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
        if let status = values?.ubiquitousItemDownloadingStatus, status == .current {
            return
        }
        if FileManager.default.isReadableFile(atPath: url.path),
           let data = try? Data(contentsOf: url), !data.isEmpty {
            return
        }

        // Trigger iCloud download
        try? FileManager.default.startDownloadingUbiquitousItem(at: url)

        // Poll until available
        let iterations = timeout * 2 // 500ms intervals
        for _ in 0..<iterations {
            try await Task.sleep(for: .milliseconds(500))

            let vals = try? url.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey])
            if let status = vals?.ubiquitousItemDownloadingStatus, status == .current {
                return
            }
            if FileManager.default.isReadableFile(atPath: url.path),
               let data = try? Data(contentsOf: url), !data.isEmpty {
                return
            }
        }

        throw SyncError.downloadTimeout(url.lastPathComponent)
    }

    // MARK: - Utilities

    func isAccessible() -> Bool {
        guard let url = try? resolveBookmark() else { return false }
        guard url.startAccessingSecurityScopedResource() else { return false }
        defer { url.stopAccessingSecurityScopedResource() }
        let manifestURL = url.appendingPathComponent("manifest.json")
        return FileManager.default.fileExists(atPath: manifestURL.path)
    }

    func clearBookmark() {
        UserDefaults.standard.removeObject(forKey: bookmarkKey)
    }
}

// MARK: - Errors

enum SyncError: LocalizedError {
    case noBookmark
    case staleBookmark
    case accessDenied
    case manifestNotFound
    case manifestNotFoundDetail(String)
    case fileNotFound(String)
    case downloadTimeout(String)

    var errorDescription: String? {
        switch self {
        case .noBookmark: return "No sync folder configured"
        case .staleBookmark: return "Sync folder access expired. Please re-select the folder."
        case .accessDenied: return "Cannot access sync folder"
        case .manifestNotFound: return "No manifest.json found in sync folder"
        case .manifestNotFoundDetail(let detail): return detail
        case .fileNotFound(let path): return "File not found: \(path)"
        case .downloadTimeout(let name): return "Download timed out for \(name). Check your network connection."
        }
    }
}

// MARK: - Document Picker Coordinator

struct FolderPickerResult {
    let url: URL
    let manifest: SyncManifest
}

class FolderPickerCoordinator: NSObject, UIDocumentPickerDelegate {
    let completion: (Result<FolderPickerResult, Error>) -> Void
    private let folderManager: SyncFolderManager

    init(folderManager: SyncFolderManager, completion: @escaping (Result<FolderPickerResult, Error>) -> Void) {
        self.folderManager = folderManager
        self.completion = completion
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        do {
            try folderManager.saveBookmark(for: url)
        } catch {
            completion(.failure(error))
            return
        }
        Task {
            do {
                let manifest = try await folderManager.readManifest()
                await MainActor.run {
                    completion(.success(FolderPickerResult(url: url, manifest: manifest)))
                }
            } catch {
                await MainActor.run {
                    completion(.failure(error))
                }
            }
        }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        completion(.failure(SyncError.noBookmark))
    }
}

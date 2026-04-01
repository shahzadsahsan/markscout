import SwiftUI

struct SettingsView: View {
    @Bindable var appState: AppState
    let folderManager: SyncFolderManager
    let cacheManager: LocalCacheManager

    @State private var showClearConfirm = false
    @State private var showFolderPicker = false
    @State private var pickerCoordinator: FolderPickerCoordinator?
    @State private var isDownloadingAll = false
    @State private var downloadProgress: (current: Int, total: Int) = (0, 0)

    var body: some View {
        List {
            // Sync Folder
            Section {
                HStack {
                    Label("Sync Folder", systemImage: "folder")
                        .foregroundStyle(Color.msText)
                    Spacer()
                    Text("iCloud/MarkScout")
                        .font(.caption)
                        .foregroundStyle(Color.msMuted)
                }
                .listRowBackground(Color.msSurface)

                Button("Change Sync Folder") {
                    changeSyncFolder()
                }
                .foregroundStyle(Color.amber)
                .listRowBackground(Color.msSurface)

                if isDownloadingAll {
                    HStack {
                        Label("Downloading...", systemImage: "arrow.down.circle")
                            .foregroundStyle(Color.msText)
                        Spacer()
                        if downloadProgress.total > 0 {
                            Text("\(downloadProgress.current)/\(downloadProgress.total)")
                                .font(.caption)
                                .foregroundStyle(Color.msMuted)
                        }
                    }
                    .listRowBackground(Color.msSurface)
                    ProgressView(value: Double(downloadProgress.current), total: max(1, Double(downloadProgress.total)))
                        .tint(Color.amber)
                        .listRowBackground(Color.msSurface)
                } else {
                    Button {
                        downloadAllFiles()
                    } label: {
                        Label("Download All Files", systemImage: "arrow.down.circle")
                    }
                    .foregroundStyle(Color.amber)
                    .listRowBackground(Color.msSurface)
                }

                if let manifest = appState.manifest {
                    HStack {
                        Label("Files", systemImage: "doc.text")
                            .foregroundStyle(Color.msText)
                        Spacer()
                        Text("\(manifest.fileCount) files")
                            .font(.caption)
                            .foregroundStyle(Color.msMuted)
                    }
                    .listRowBackground(Color.msSurface)
                }
            } header: {
                Text("Sync")
                    .foregroundStyle(Color.msMuted)
            }

            // Filters
            Section {
                HStack {
                    Label("File Count", systemImage: "line.3.horizontal.decrease.circle")
                        .foregroundStyle(Color.msText)
                    Spacer()
                    Text("\(appState.filteredFiles.count) shown")
                        .font(.caption)
                        .foregroundStyle(Color.msMuted)
                }
                .listRowBackground(Color.msSurface)

                if let manifest = appState.manifest {
                    let projects = Set(manifest.files.map(\.project)).sorted()
                    ForEach(projects, id: \.self) { project in
                        let count = manifest.files.filter { $0.project == project }.count
                        HStack {
                            Text(project)
                                .font(.system(.body, design: .monospaced))
                                .foregroundStyle(Color.msText)
                            Spacer()
                            Text("\(count) files")
                                .font(.caption)
                                .foregroundStyle(Color.msMuted)
                        }
                        .listRowBackground(Color.msSurface)
                    }
                }
            } header: {
                Text("Filters")
                    .foregroundStyle(Color.msMuted)
            }

            // Theme
            Section {
                NavigationLink {
                    PalettePickerSheet(selectedPalette: $appState.activePalette)
                } label: {
                    HStack {
                        Label("Theme", systemImage: "paintpalette")
                            .foregroundStyle(Color.msText)
                        Spacer()
                        Text(palette(for: appState.activePalette).label)
                            .font(.caption)
                            .foregroundStyle(Color.msMuted)
                    }
                }
                .listRowBackground(Color.msSurface)
            } header: {
                Text("Appearance")
                    .foregroundStyle(Color.msMuted)
            }

            // Cache
            Section {
                HStack {
                    Label("Cache Size", systemImage: "internaldrive")
                        .foregroundStyle(Color.msText)
                    Spacer()
                    Text(cacheManager.formattedCacheSize)
                        .font(.caption)
                        .foregroundStyle(Color.msMuted)
                }
                .listRowBackground(Color.msSurface)

                HStack {
                    Label("Cached Files", systemImage: "doc.on.doc")
                        .foregroundStyle(Color.msText)
                    Spacer()
                    Text("\(cacheManager.cachedFileCount)")
                        .font(.caption)
                        .foregroundStyle(Color.msMuted)
                }
                .listRowBackground(Color.msSurface)

                Button("Clear Cache") {
                    showClearConfirm = true
                }
                .foregroundStyle(.red)
                .listRowBackground(Color.msSurface)
            } header: {
                Text("Storage")
                    .foregroundStyle(Color.msMuted)
            }

            // About
            Section {
                HStack {
                    Label("Version", systemImage: "info.circle")
                        .foregroundStyle(Color.msText)
                    Spacer()
                    Text("MarkScout for iOS v1.0.0")
                        .font(.caption)
                        .foregroundStyle(Color.msMuted)
                }
                .listRowBackground(Color.msSurface)
            } header: {
                Text("About")
                    .foregroundStyle(Color.msMuted)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.msBackground)
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Clear Cache", isPresented: $showClearConfirm) {
            Button("Cancel", role: .cancel) { }
            Button("Clear", role: .destructive) {
                try? cacheManager.clearCache()
            }
        } message: {
            Text("This will remove all cached files. They will be re-downloaded when you refresh.")
        }
    }

    private func downloadAllFiles() {
        guard let manifest = appState.manifest else { return }
        isDownloadingAll = true
        downloadProgress = (0, manifest.fileCount)
        Task {
            let downloaded = await folderManager.downloadAllFiles(manifest: manifest) { current, total in
                downloadProgress = (current, total)
            }
            await MainActor.run {
                isDownloadingAll = false
                if downloaded > 0 {
                    appState.cacheStatus = .cached
                }
            }
            // Also update the local cache
            await cacheManager.cacheAllFiles(manifest: manifest, folderManager: folderManager)
            await MainActor.run {
                appState.cacheStatus = .cached
            }
        }
    }

    private func changeSyncFolder() {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
        picker.allowsMultipleSelection = false

        let coordinator = FolderPickerCoordinator(folderManager: folderManager) { result in
            if case .success(let pickerResult) = result {
                appState.manifest = pickerResult.manifest
                appState.lastSyncCheck = Date()
            }
        }
        picker.delegate = coordinator
        self.pickerCoordinator = coordinator

        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            root.present(picker, animated: true)
        }
    }
}

import SwiftUI
import UniformTypeIdentifiers

struct OnboardingView: View {
    @State private var currentStep = 0
    @State private var showError = false
    @State private var errorMessage = ""
    @State private var isDownloading = false
    @State private var downloadProgress: (current: Int, total: Int) = (0, 0)

    let folderManager: SyncFolderManager
    let onComplete: (SyncManifest) -> Void

    @State private var pickerCoordinator: FolderPickerCoordinator?

    var body: some View {
        VStack(spacing: 0) {
            if isDownloading {
                downloadingView
            } else {
                TabView(selection: $currentStep) {
                    welcomeStep.tag(0)
                    selectFolderStep.tag(1)
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
            }
        }
        .background(Color.msBackground)
    }

    // MARK: - Step 1: Welcome

    private var welcomeStep: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 64))
                .foregroundStyle(Color.amber)
            Text("MarkScout for iOS")
                .font(.system(.title, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(.white)
            Text("A companion for your desktop\nmarkdown browser")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .font(.body)
            Spacer()
            amberButton("Get Started") { currentStep = 1 }
                .padding(.bottom, 48)
        }
    }

    // MARK: - Step 2: Select Folder

    private var selectFolderStep: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "folder.badge.plus")
                .font(.system(size: 64))
                .foregroundStyle(Color.amber)
            Text("Select MarkScout Folder")
                .font(.system(.title2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(.white)
            Text("Open iCloud Drive and pick the\nMarkScout sync folder")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)

            if showError {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.callout)
                    .padding(.horizontal, 32)
                    .multilineTextAlignment(.center)
            }

            Spacer()
            amberButton("Choose Folder") {
                presentFolderPicker()
            }

            #if targetEnvironment(simulator)
            Button {
                loadDemoData()
            } label: {
                Text("Use Demo Data")
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(Color.msMuted)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .padding(.horizontal, 32)
            #endif

            Spacer().frame(height: 48)
        }
    }

    // MARK: - Downloading State

    private var downloadingView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 64))
                .foregroundStyle(Color.amber)
                .symbolEffect(.pulse, isActive: true)
            Text("Downloading Files")
                .font(.system(.title2, design: .monospaced))
                .fontWeight(.bold)
                .foregroundStyle(.white)

            if downloadProgress.total > 0 {
                VStack(spacing: 8) {
                    ProgressView(value: Double(downloadProgress.current), total: Double(downloadProgress.total))
                        .tint(Color.amber)
                        .padding(.horizontal, 48)
                    Text("\(downloadProgress.current) of \(downloadProgress.total) files")
                        .font(.system(.callout, design: .monospaced))
                        .foregroundStyle(Color.msMuted)
                }
            } else {
                ProgressView()
                    .tint(Color.amber)
                Text("Reading manifest...")
                    .font(.system(.callout, design: .monospaced))
                    .foregroundStyle(Color.msMuted)
            }
            Spacer()
        }
    }

    // MARK: - Actions

    private func loadDemoData() {
        let demo = DemoDataManager.shared
        guard demo.isAvailable else {
            errorMessage = "SampleData not found in bundle"
            showError = true
            return
        }
        do {
            let m = try demo.loadManifest()
            demo.activate()
            onComplete(m)
        } catch {
            errorMessage = "Demo error: \(error)"
            showError = true
        }
    }

    private func presentFolderPicker() {
        showError = false
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
        picker.allowsMultipleSelection = false

        let coordinator = FolderPickerCoordinator(folderManager: folderManager) { result in
            switch result {
            case .success(let pickerResult):
                startDownloading(manifest: pickerResult.manifest)
            case .failure(let error):
                if case SyncError.noBookmark = error {
                    // User cancelled — do nothing
                } else {
                    errorMessage = error.localizedDescription
                    showError = true
                }
            }
        }
        picker.delegate = coordinator
        self.pickerCoordinator = coordinator

        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            root.present(picker, animated: true)
        }
    }

    private func startDownloading(manifest: SyncManifest) {
        isDownloading = true
        downloadProgress = (0, manifest.fileCount)

        Task {
            let downloaded = await folderManager.downloadAllFiles(manifest: manifest) { current, total in
                downloadProgress = (current, total)
            }

            await MainActor.run {
                if downloaded > 0 {
                    onComplete(manifest)
                } else {
                    isDownloading = false
                    errorMessage = "Couldn't download files. Check your internet connection and try again."
                    showError = true
                }
            }
        }
    }

    // MARK: - Helpers

    private func amberButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(.body, design: .monospaced))
                .fontWeight(.semibold)
                .foregroundStyle(.black)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.amber)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .padding(.horizontal, 32)
    }
}

// MARK: - Color helpers

extension Color {
    static let amber = Color(hex: "#d4a04a")
    static let msBackground = Color(hex: "#0d0d0d")
    static let msSurface = Color(hex: "#161616")
    static let msBorder = Color(hex: "#2a2a2a")
    static let msText = Color(hex: "#e0e0e0")
    static let msMuted = Color(hex: "#888888")
    static let msActive = Color(hex: "#1e1e1e")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255.0
        let g = Double((int >> 8) & 0xFF) / 255.0
        let b = Double(int & 0xFF) / 255.0
        self.init(red: r, green: g, blue: b)
    }
}

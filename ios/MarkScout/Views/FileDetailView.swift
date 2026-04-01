import SwiftUI
import WebKit

struct FileDetailView: View {
    let file: FileEntry
    @Bindable var appState: AppState
    let folderManager: SyncFolderManager
    let cacheManager: LocalCacheManager

    @State private var content: String?
    @State private var isLoading = true
    @State private var showPalettePicker = false
    @State private var showTOC = false
    @State private var showSearch = false
    @State private var searchText = ""
    @State private var headings: [HeadingItem] = []
    @State private var activeHeadingId: String?
    @State private var showResumeToast = false
    @State private var scrollPercentage: Double = 0

    // Handoff
    @State private var userActivity: NSUserActivity?

    var body: some View {
        ZStack(alignment: .trailing) {
            VStack(spacing: 0) {
                // Search bar overlay
                if showSearch {
                    searchBar
                }

                // File header
                fileHeader

                // Markdown content
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let content {
                    MarkdownWebView(
                        markdownContent: content,
                        paletteId: appState.activePalette,
                        zoomLevel: appState.zoomLevel,
                        onScrollPosition: { pct in
                            scrollPercentage = pct
                            appState.saveReadingPosition(for: file.relativePath, percentage: pct, contentHash: file.contentHash)
                        },
                        onHeadingsExtracted: { items in
                            headings = items
                        },
                        onActiveHeading: { id in
                            activeHeadingId = id
                        },
                        onLinkTapped: { url in
                            UIApplication.shared.open(url)
                        },
                        restoreScrollPercentage: appState.readingPosition(for: file.relativePath, contentHash: file.contentHash)
                    )
                } else {
                    Text("Unable to load file")
                        .foregroundStyle(Color.msMuted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }

            // Scroll progress rail on right edge
            if !isLoading && content != nil {
                scrollProgressRail
            }
        }
        .background(Color.msBackground)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                // Search
                Button { showSearch.toggle() } label: {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(Color.msMuted)
                }

                // TOC
                Button { showTOC.toggle() } label: {
                    Image(systemName: "list.bullet")
                        .foregroundStyle(Color.msMuted)
                }

                // Zoom controls
                Menu {
                    Button("A\u{2212} Smaller") {
                        appState.zoomLevel = max(0.8, appState.zoomLevel - 0.1)
                    }
                    Button("A+ Larger") {
                        appState.zoomLevel = min(2.0, appState.zoomLevel + 0.1)
                    }
                    Button("Reset") {
                        appState.zoomLevel = 1.0
                    }
                    Text("Zoom: \(Int(appState.zoomLevel * 100))%")
                } label: {
                    Image(systemName: "textformat.size")
                        .foregroundStyle(Color.msMuted)
                }

                // Theme
                Button { showPalettePicker.toggle() } label: {
                    Image(systemName: "paintpalette")
                        .foregroundStyle(Color.msMuted)
                }

                // Share
                ShareLink(item: file.name) {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundStyle(Color.msMuted)
                }
            }
        }
        .sheet(isPresented: $showPalettePicker) {
            PalettePickerSheet(selectedPalette: $appState.activePalette)
                .presentationDetents([.medium])
        }
        .sheet(isPresented: $showTOC) {
            TOCSheet(headings: headings, activeHeadingId: activeHeadingId) { headingId in
                showTOC = false
                NotificationCenter.default.post(name: .scrollToHeading, object: headingId)
            }
            .presentationDetents([.medium, .large])
        }
        .overlay {
            if showResumeToast {
                VStack {
                    Spacer()
                    Text("Resuming from where you left off")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial)
                        .clipShape(Capsule())
                        .padding(.bottom, 24)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .allowsHitTesting(false)
            }
        }
        .task {
            await loadContent()
            setupHandoff()
        }
        .onDisappear {
            userActivity?.resignCurrent()
        }
    }

    // MARK: - Scroll Progress Rail

    private var scrollProgressRail: some View {
        GeometryReader { geo in
            let trackHeight = geo.size.height * 0.6
            let indicatorHeight: CGFloat = 40
            let maxOffset = trackHeight - indicatorHeight
            let offset = maxOffset * scrollPercentage

            ZStack(alignment: .top) {
                // Track
                RoundedRectangle(cornerRadius: 1.5)
                    .fill(Color.msBorder.opacity(0.4))
                    .frame(width: 3, height: trackHeight)

                // Thumb
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.amber.opacity(0.7))
                    .frame(width: 3, height: indicatorHeight)
                    .offset(y: offset)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
            .padding(.trailing, 2)
            .padding(.vertical, geo.size.height * 0.2)
        }
        .allowsHitTesting(false)
        .opacity(scrollPercentage > 0.01 ? 1 : 0)
        .animation(.easeInOut(duration: 0.2), value: scrollPercentage)
    }

    // MARK: - File Header

    private var fileHeader: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(file.name)
                .font(.system(.headline, design: .monospaced))
                .foregroundStyle(Color.msText)
            HStack(spacing: 8) {
                Text(file.project)
                    .foregroundStyle(Color.amber)
                Text("·")
                    .foregroundStyle(Color.msMuted)
                Text(file.modifiedDate, format: .relative(presentation: .named))
                    .foregroundStyle(Color.msMuted)
                if let wc = wordCount {
                    Text("·")
                        .foregroundStyle(Color.msMuted)
                    Text("\(wc) words · \(max(1, wc / 200)) min")
                        .foregroundStyle(Color.msMuted)
                }
                Spacer()
                // Scroll percentage
                Text("\(Int(scrollPercentage * 100))%")
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundStyle(Color.msMuted)
                if appState.isFavorite(file.relativePath) {
                    Image(systemName: "star.fill")
                        .foregroundStyle(Color.amber)
                        .font(.caption)
                }
            }
            .font(.caption)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.msSurface)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.msMuted)
            TextField("Find in document", text: $searchText)
                .textFieldStyle(.plain)
                .foregroundStyle(Color.msText)
                .onSubmit {
                    performSearch()
                }
            Button { showSearch = false; searchText = "" } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(Color.msMuted)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.msSurface.opacity(0.95))
    }

    // MARK: - Content Loading

    private func loadContent() async {
        isLoading = true
        if DemoDataManager.shared.isActive {
            content = try? DemoDataManager.shared.readFileContent(relativePath: file.relativePath)
        } else if let text = try? await folderManager.readFileContent(relativePath: file.relativePath) {
            content = text
        } else if let cached = cacheManager.readCachedContent(relativePath: file.relativePath) {
            content = cached
        }
        isLoading = false

        // Restore reading position
        if let pos = appState.readingPosition(for: file.relativePath, contentHash: file.contentHash) {
            scrollPercentage = pos
            showResumeToast = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation { showResumeToast = false }
            }
        }
    }

    private var wordCount: Int? {
        content?.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }

    private func performSearch() {
        // WKWebView find-in-page would require a reference to the webview
    }

    // MARK: - Handoff

    private func setupHandoff() {
        let activity = NSUserActivity(activityType: "com.markscout.viewing")
        activity.title = "Reading \(file.name)"
        activity.userInfo = ["relativePath": file.relativePath]
        activity.isEligibleForHandoff = true
        activity.isEligibleForSearch = true
        activity.becomeCurrent()
        userActivity = activity
    }
}

extension Notification.Name {
    static let scrollToHeading = Notification.Name("scrollToHeading")
}

// MARK: - Palette Picker Sheet

struct PalettePickerSheet: View {
    @Binding var selectedPalette: PaletteId
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    ForEach(paletteCategories) { category in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(category.name)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(Color.msMuted)
                                .textCase(.uppercase)

                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 70))], spacing: 8) {
                                ForEach(category.palettes) { p in
                                    Button {
                                        selectedPalette = p.id
                                        dismiss()
                                    } label: {
                                        VStack(spacing: 4) {
                                            RoundedRectangle(cornerRadius: 8)
                                                .fill(Color(hex: p.vars["--bg"] ?? "#0d0d0d"))
                                                .frame(height: 40)
                                                .overlay(
                                                    Text("Aa")
                                                        .font(.system(.body, design: .serif))
                                                        .foregroundStyle(Color(hex: p.vars["--prose-h1"] ?? "#fff"))
                                                )
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(selectedPalette == p.id ? Color.amber : Color.msBorder, lineWidth: selectedPalette == p.id ? 2 : 1)
                                                )
                                            Text(p.label)
                                                .font(.system(size: 10, design: .monospaced))
                                                .foregroundStyle(Color.msMuted)
                                                .lineLimit(1)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .background(Color.msBackground)
            .navigationTitle("Theme")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - TOC Sheet

struct TOCSheet: View {
    let headings: [HeadingItem]
    let activeHeadingId: String?
    let onSelect: (String) -> Void

    var body: some View {
        NavigationStack {
            List {
                if headings.isEmpty {
                    Text("No headings found")
                        .foregroundStyle(Color.msMuted)
                } else {
                    ForEach(headings) { heading in
                        Button {
                            onSelect(heading.id)
                        } label: {
                            Text(heading.text)
                                .font(.system(heading.level <= 2 ? .body : .callout, design: .monospaced))
                                .fontWeight(heading.level == 1 ? .bold : .regular)
                                .foregroundStyle(activeHeadingId == heading.id ? Color.amber : Color.msText)
                                .padding(.leading, CGFloat((heading.level - 1) * 16))
                        }
                        .listRowBackground(Color.msSurface)
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.msBackground)
            .navigationTitle("Table of Contents")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

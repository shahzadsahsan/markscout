import SwiftUI
import WebKit

struct MarkdownWebView: UIViewRepresentable {
    let markdownContent: String
    let paletteId: PaletteId
    let zoomLevel: Double
    var onScrollPosition: ((Double) -> Void)?
    var onHeadingsExtracted: (([HeadingItem]) -> Void)?
    var onActiveHeading: ((String) -> Void)?
    var onLinkTapped: ((URL) -> Void)?
    var restoreScrollPercentage: Double?

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "scrollPosition")
        contentController.add(context.coordinator, name: "headings")
        contentController.add(context.coordinator, name: "activeHeading")
        contentController.add(context.coordinator, name: "linkTapped")
        config.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.bounces = true
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = context.coordinator

        // Load reader.html from bundle
        if let htmlURL = Bundle.main.url(forResource: "reader", withExtension: "html") {
            webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        }

        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let coord = context.coordinator

        // Only re-render if content changed
        if coord.lastContent != markdownContent {
            coord.lastContent = markdownContent
            coord.pendingScrollRestore = restoreScrollPercentage
            let escaped = markdownContent
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "`", with: "\\`")
                .replacingOccurrences(of: "${", with: "\\${")
            let js = "renderMarkdown(`\(escaped)`);"
            webView.evaluateJavaScript(js)
        }

        // Always update palette and zoom
        if coord.lastPalette != paletteId {
            coord.lastPalette = paletteId
            let p = palette(for: paletteId)
            let varsJson = p.vars.map { "\"\($0.key)\": \"\($0.value)\"" }.joined(separator: ", ")
            webView.evaluateJavaScript("setPalette({\(varsJson)});")
        }

        if coord.lastZoom != zoomLevel {
            coord.lastZoom = zoomLevel
            webView.evaluateJavaScript("setZoom(\(zoomLevel));")
        }
    }

    class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var parent: MarkdownWebView
        weak var webView: WKWebView?
        var lastContent: String?
        var lastPalette: PaletteId?
        var lastZoom: Double?
        var pendingScrollRestore: Double?

        init(_ parent: MarkdownWebView) {
            self.parent = parent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "scrollPosition":
                if let pct = message.body as? Double {
                    parent.onScrollPosition?(pct)
                }
            case "headings":
                if let json = message.body as? String,
                   let data = json.data(using: .utf8),
                   let items = try? JSONDecoder().decode([HeadingItem].self, from: data) {
                    parent.onHeadingsExtracted?(items)
                }
            case "activeHeading":
                if let id = message.body as? String {
                    parent.onActiveHeading?(id)
                }
            case "linkTapped":
                if let urlString = message.body as? String, let url = URL(string: urlString) {
                    parent.onLinkTapped?(url)
                }
            default:
                break
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Re-render content after page load
            if let content = lastContent {
                let escaped = content
                    .replacingOccurrences(of: "\\", with: "\\\\")
                    .replacingOccurrences(of: "`", with: "\\`")
                    .replacingOccurrences(of: "${", with: "\\${")
                webView.evaluateJavaScript("renderMarkdown(`\(escaped)`);")

                if let p = lastPalette {
                    let pal = palette(for: p)
                    let varsJson = pal.vars.map { "\"\($0.key)\": \"\($0.value)\"" }.joined(separator: ", ")
                    webView.evaluateJavaScript("setPalette({\(varsJson)});")
                }

                if let z = lastZoom {
                    webView.evaluateJavaScript("setZoom(\(z));")
                }

                // Restore scroll position after a brief delay for rendering
                if let pct = pendingScrollRestore, pct > 0 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        webView.evaluateJavaScript("setScrollPercentage(\(pct));")
                    }
                    pendingScrollRestore = nil
                }
            }
        }

        // Prevent navigation away from reader.html
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated {
                decisionHandler(.cancel)
                if let url = navigationAction.request.url {
                    parent.onLinkTapped?(url)
                }
            } else {
                decisionHandler(.allow)
            }
        }
    }
}

struct HeadingItem: Codable, Identifiable {
    let id: String
    let text: String
    let level: Int
}

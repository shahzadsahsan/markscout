# MarkScout

**A beautiful markdown reader for AI-assisted developers.**

![macOS](https://img.shields.io/badge/platform-macOS-black) ![Tauri](https://img.shields.io/badge/Tauri-2.0-black) ![Rust](https://img.shields.io/badge/Rust-backend-black) ![v0.6](https://img.shields.io/badge/version-0.6-d4a04a) ![License](https://img.shields.io/badge/license-MIT-black)

<img width="128" height="128" alt="MarkScout" src="icon-128.png" />

MarkScout turns the scattered markdown files from your AI coding sessions into a calm, focused reading experience. Plans, specs, architecture docs, memory files, research notes -- all surfaced instantly, beautifully rendered, with the noise hidden.

If you use Claude Code, Codex, Cursor, Windsurf, or Aider, your projects are full of `.md` artifacts you never actually read. MarkScout fixes that. It watches your folders, filters out framework junk, and presents your documents the way they deserve to be read -- with proper typography, warm color palettes, and zero distractions.

**11 MB download. Opens in under a second. Completely local.**

## The Reading Experience

MarkScout is designed for reading, not editing. Every detail serves that goal:

- **5 typography presets** -- Classic (serif), Modern (system sans), Literary (elegant serif), Developer (monospace), and Accessible (larger text, wider spacing, optimized for readability)
- **16 color palettes** -- 12 dark themes organized by tone (Warm, Cool, Vibrant) + 4 light themes. Includes Synthwave, Dracula, Tokyo Night, Sakura, and classics like Monokai, Solarized, Catppuccin, Nord
- **Antialiased text rendering** with proper font hierarchy -- serif for prose, sans for UI, monospace for code
- **Inline section tracking** -- current heading shows in the file header as you scroll, no extra chrome
- **Fill-screen mode** -- expand prose to 90% width for immersive reading
- **Zoom controls** -- 5 zoom levels (85% to 200%)
- **Code syntax highlighting** -- github-dark theme via highlight.js
- **Task list rendering** -- checkboxes rendered inline for markdown checklists

## Features

### Core
- **Live folder watching** -- Rust-powered file watcher updates the sidebar instantly when files change
- **Smart noise filtering** -- hides node_modules, build artifacts, changelogs, license files, and 11 toggleable filter presets for Claude Code artifacts
- **Full-text search** -- searches inside file content (not just names) with highlighted snippets and line numbers
- **Recent searches** -- last 10 queries saved and shown as dropdown suggestions
- **Keyboard-driven** -- `j`/`k` navigation, `/` search, `?` shortcuts panel

### Sidebar Views
- **Recents** -- all files sorted by last modified, with staleness indicators and collapsible folder grouping
- **Favorites** -- starred files and folders

### File Intelligence
- **Move tracking** -- if you rename or move a file, your favorites and history follow it via content hashing
- **Inline section indicator** -- shows the current heading in the file header as you scroll
- **Related files** -- see sibling files from the same folder at the bottom of each document
- **Reading position memory** -- scroll position saved per file and restored when you return

### Native macOS
- **11 MB app** -- Tauri 2.0 with Rust backend (96% smaller than Electron)
- **Native menu bar** with keyboard shortcuts
- **Window state persistence** -- remembers position and size between sessions
- **Reveal in Finder** -- click the path header or use the overflow menu

## Download

Grab the latest `.dmg` from [**Releases**](https://github.com/shahzadsahsan/markscout/releases).

### First Launch

The app is unsigned (code signing coming soon). On first launch:

1. Drag MarkScout to `/Applications`
2. Right-click > "Open" > click "Open" in the dialog
3. Or: System Settings > Privacy & Security > "Open Anyway"

You only need to do this once.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` `2` | Switch view (Recents, Favorites) |
| `j` / `k` | Navigate files up/down |
| `s` | Star / unstar file |
| `/` | Focus search |
| `Esc` | Clear search |
| `Cmd + B` | Toggle sidebar |
| `Cmd + Shift + F` | Toggle fill screen |
| `Cmd + =` / `-` / `0` | Zoom in / out / reset |
| `Cmd + ,` | Preferences |
| `?` | Shortcut help |

## Roadmap

### v0.7 -- Discovery
- Folder color indicators in sidebar
- Most-viewed sort
- Auto-update framework
- Source maps for debugging
- Performance improvements (event batching)

### v1.0 -- Distribution
- Code signing + notarization (no more Gatekeeper warnings)
- Homebrew cask (`brew install --cask markscout`)
- Windows + Linux support
- Plugin system for custom filters

## Development

```bash
npm install
npm run tauri dev    # Vite + Tauri hot reload
npm run tauri build  # Release DMG
```

Requires [Rust toolchain](https://rustup.rs/) and Xcode Command Line Tools.

## Stack

- **Tauri 2.0** -- Rust backend, native WebView frontend
- **Vite + React 19** -- fast frontend bundler
- **Rust** -- file watching (notify), state management, content hashing, search
- **markdown-it + highlight.js** -- rendering with syntax highlighting
- **Tailwind CSS 4** -- styling
- **Source Serif 4** -- prose typography
- **JetBrains Mono** -- code and metadata
- **System fonts** -- UI chrome (SF Pro on macOS)

## Privacy

Everything is local. No analytics, no accounts, no telemetry. The only network call is an optional update check to GitHub Releases on launch.

## License

MIT

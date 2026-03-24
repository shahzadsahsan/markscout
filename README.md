# MarkScout

**Browse your markdown files beautifully.**

![macOS](https://img.shields.io/badge/platform-macOS-black) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Electron](https://img.shields.io/badge/Electron-34-black) ![License](https://img.shields.io/badge/license-MIT-black)

<img width="824" height="832" alt="Screenshot 2026-03-23 at 11 46 04 PM" src="https://github.com/user-attachments/assets/469278db-01ba-4a43-b9db-ffe0e9e2d679" />


MarkScout watches your folders for markdown files and gives you a fast, distraction-free way to read them — no editing, no clutter, just clean rendering with syntax-colored headings, navigable file links, and instant live updates.

Built for developers who work with AI coding agents. If your workflow generates dozens of plans, specs, memory files, research notes, and architecture docs across nested project folders, MarkScout surfaces the ones that matter and hides the noise.

## What It Does

- Watches any folder for `.md` files and shows them in a live-updating sidebar
- Smart filters hide framework junk — `node_modules`, build artifacts, changelogs, license files
- **Full-text content search** — search inside all files, not just filenames, with highlighted match snippets
- Four sidebar views: **Recents**, **Folders**, **Favorites**
- Resizable sidebar with real folder hierarchy (expand/collapse project by project)
- Star files and folders — starred folders appear in Favorites with their files
- 12 color themes: 9 dark + 3 light (Daylight, Sepia, Arctic)
- Theme applies to the entire app (sidebar + reader)
- Click between linked markdown files instantly — inline references resolve and navigate automatically
- Fill-screen mode for focused reading with expanded prose width
- Keyboard-driven: `j`/`k` to navigate, `/` to search, `?` for shortcuts
- Reveal any file in Finder with one click
- Add, disable, or remove watch folders through Preferences
- **Auto-update checker** — checks GitHub Releases on launch, download updates in-app

## What It Does Not Do

- Edit files. This is a reader.
- Phone home. Everything is local (except the optional update check to GitHub).
- Slow down. Files load in single-digit milliseconds.

## Download

Grab the latest `.dmg` from [Releases](https://github.com/shahzadsahsan/markscout/releases).

> The app is unsigned. Right-click → Open on first launch to bypass Gatekeeper.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` `2` `3` | Switch sidebar view (Recents, Folders, Favorites) |
| `j` / `k` | Navigate files up / down |
| `s` | Toggle star on current file |
| `/` | Focus search |
| `Esc` | Clear search |
| `Cmd + S` | Toggle sidebar |
| `Cmd + Shift + F` | Toggle fill screen |
| `Cmd + =` / `Cmd + -` | Zoom in / out |
| `Cmd + 0` | Reset zoom |
| `Cmd + ,` | Preferences |
| `?` | Show shortcut help |

## Development

```bash
# Install dependencies
npm install

# Run the web app
npm run dev

# Run inside Electron
cd macos
npm install
npm run dev
```

## Building the macOS App

```bash
cd macos
npm run make
```

This builds Next.js, prunes to production dependencies only, and packages with Electron Forge. Artifacts land in `macos/out/make/` (DMG + ZIP). App size: ~470MB, DMG: ~160MB.

## Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS
- **chokidar** — file system watching via `instrumentation.ts`
- **markdown-it** — rendering with anchor links and syntax highlighting
- **highlight.js** — code block syntax highlighting (github-dark theme)
- **Electron 34** — native macOS wrapper with Forge packaging
- **JetBrains Mono** — sidebar, headings, code
- **Source Serif 4** — prose body text

## Architecture

The app runs a local Next.js server that watches configured directories. The Electron wrapper spawns this server on a random port and loads it in a BrowserWindow. State persists to `~/.markscout/state.json`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed implementation notes.

## Privacy

MarkScout does not collect, transmit, or store any data outside your machine. No analytics, no accounts. The only network call is an optional update check to the GitHub Releases API on launch.

## License

MIT

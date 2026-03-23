# MarkScout

**Browse your markdown files beautifully.**

![macOS](https://img.shields.io/badge/platform-macOS-black) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Electron](https://img.shields.io/badge/Electron-34-black) ![License](https://img.shields.io/badge/license-MIT-black)

MarkScout watches your folders for markdown files and gives you a fast, distraction-free way to read them — no editing, no clutter, just clean rendering with syntax-colored headings, navigable file links, and instant live updates.

Built for developers who work with AI coding agents. If your workflow generates dozens of plans, specs, memory files, research notes, and architecture docs across nested project folders, MarkScout surfaces the ones that matter and hides the noise.

## What It Does

- Watches any folder for `.md` files and shows them in a live-updating sidebar
- Smart filters hide framework junk — `node_modules`, build artifacts, changelogs, license files — so you see your actual documents
- Four sidebar views: **Recents**, **Folders**, **Favorites**, and **History**
- Click between linked markdown files instantly — inline code references like `BUILD.md` resolve and navigate automatically
- 9 color palettes from minimal to code-editor inspired
- Theater mode for focused reading with vignette and enhanced typography
- Keyboard-driven: arrow keys to browse, `/` to search, `Cmd+.` for reader mode
- Reveal any file in Finder with one click
- Add custom watch folders and filter categories through Preferences

## What It Does Not Do

- Edit files. This is a reader.
- Phone home. Everything is local.
- Slow down. Files load in single-digit milliseconds.

## Download

Grab the latest `.dmg` from [Releases](https://github.com/shahzadsahsan/markreader/releases).

> The app is unsigned. Right-click → Open on first launch to bypass Gatekeeper.

## Screenshots

*Coming soon*

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` `2` `3` `4` | Switch sidebar view (Recents, Folders, Favorites, History) |
| `j` / `k` or `↓` / `↑` | Navigate files in sidebar |
| `Enter` | Open selected file |
| `s` | Toggle star on current file |
| `/` | Focus search |
| `Cmd + .` | Toggle theater mode |
| `Cmd + +` / `Cmd + -` | Zoom text |
| `Escape` | Close search / exit theater mode |

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
# Build Next.js first
npm run build

# Build and package the Electron app
cd macos
npm run make
```

Artifacts land in `macos/out/make/` (DMG + ZIP).

## Stack

- **Next.js 16** — App Router, TypeScript, Tailwind CSS
- **chokidar** — file system watching via `instrumentation.ts`
- **markdown-it** — rendering with anchor links and syntax highlighting
- **highlight.js** — code block syntax highlighting (github-dark theme)
- **Electron 34** — native macOS wrapper with Forge packaging
- **JetBrains Mono** — sidebar, headings, code
- **Source Serif 4** — prose body text

## Architecture

The app runs a local Next.js server that watches configured directories. The Electron wrapper spawns this server on a random port and loads it in a BrowserWindow. State persists to `~/.markreader/state.json`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed implementation notes.

## Privacy

MarkScout does not collect, transmit, or store any data outside your machine. No analytics, no accounts, no network calls. Your files stay on your disk.

## License

MIT

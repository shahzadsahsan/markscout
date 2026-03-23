# MarkScout — Requirements & Specification

## Problem

Claude Code generates `.md` files across `~/Vibe Coding/` and `~/.claude/` — plans, memories, specs, notes — scattered across dozens of subdirectories. A survey found ~9,200 total `.md` files, but only ~610 are human-readable after filtering out `node_modules/` (8,605), build directories (813), and agent-generated workflow files (103). No existing app offers multi-folder watching + multi-view sidebar + favorites + move tracking + smart filtering.

### Existing Apps Evaluated

| App | Verdict |
|-----|---------|
| **Marked 2** ($13.99) | Watches one folder, shows most recently edited file. No file list sidebar, no favorites, no multi-folder, no move tracking. |
| **Obsidian** | Requires vault structure. FolderBridge plugin exists but hacky. No native read-only mode. Overkill. |
| **md-fileserver** | Local server with auto-refresh. Single folder, no sidebar, no favorites, no state. Good markdown-it rendering approach borrowed. |
| **QLMarkdown / Quick Look** | Preview extension only. No folder watching, no favorites. |
| **Browser extensions** | Can render `.md` files but no folder watching or favorites. |

## Product Definition

A local-only web app that watches directories for `.md` files, filters out code/framework noise, and provides a fast read-only viewer with a multi-view sidebar, favorites, history, and a pleasant reading experience. Runs locally in Chrome as an "installed" web app.

### V1 Features

#### Multi-View Sidebar

| View | What It Shows | Sort |
|------|---------------|------|
| **Recents** (default) | All files sorted by last modified time | Most recent first |
| **Folders** | Tree view: watched root → project → subdirectory | Alphabetical with file counts |
| **Favorites** | Only starred files | Most recently starred first |
| **History** | Files opened in MarkScout | Most recently opened first |

#### Smart File Filtering

Automatically excludes non-human-readable `.md` files:
- **Path exclusions**: `node_modules/`, `.next/`, `.vercel/`, `.git/`, `dist/`, `build/`, `out/`, `venv/`, `.venv/`, `.pytest_cache/`, `site-packages/`, `.dist-info/`, `coverage/`, `__pycache__/`, `.claude/plugins/cache/`
- **Filename exclusions**: `LICENSE.md`, `LICENCE.md`, `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `.project-description.md`, `99-harvest.md`, agent workflow steps (`00-enter.md`, `01-orient.md`, `02-scope-*.md`, `03-scope-*.md`)
- **Configurable**: Users can add/remove patterns via state.json

#### Core Functionality

1. **Watch two directories recursively**: `~/Vibe Coding/` and `~/.claude/` for `.md` files
2. **Smart filtering**: Exclude ~8,600 framework/generated files, show ~610 human-readable ones
3. **Multi-view sidebar**: 4 switchable views (Recents, Folders, Favorites, History)
4. **Markdown preview pane**: Optimized reading experience with syntax highlighting, GFM tables, task lists
5. **Star/favorite files**: Persists across sessions with timestamps
6. **Opening history**: Last 50 files opened, persists across sessions
7. **File move tracking**: Content hash (first 1KB + filesize → SHA-256) detects moved files
8. **Auto-refresh preview**: Live update when currently viewed file changes on disk
9. **Live file discovery**: New files appear via SSE (Server-Sent Events)
10. **Auto-select most recent file on launch**
11. **Preview header**: Path breadcrumb + modified time + word count + reading time
12. **Relative timestamps** on each file ("2m ago")
13. **Collapsible project groups** in Folders view
14. **Status bar**: File count + filtered count + SSE connection indicator
15. **Sync-ready state**: Timestamps on all entries, instanceId, atomic writes, version field

#### Reading Experience

- **Body text**: Source Serif 4 at 18px / 1.7 line-height — warm, readable serif
- **Headings**: JetBrains Mono — creates contrast, ties to dev-tool context
- **Code blocks**: JetBrains Mono 14px with `github-dark` highlighting
- **Max content width**: 720px centered — optimal 65-75 character line length
- **Visual hierarchy**: Amber h1 borders, subtle h2 borders, zebra-striped tables, custom blockquotes
- **Scanability**: Reading time + word count in header, clear heading hierarchy, generous spacing

### V2 Ideas (Logged for Future)

- Full-text search (lunr or Pagefind)
- Keyboard shortcuts: `j`/`k` nav, `s` star, `/` search, `1-4` switch views
- Split view (two files side by side)
- Tags/labels beyond stars
- "Read later" queue
- Configurable watch directories via settings UI
- Table of contents sidebar for long files
- Sort options within each view
- Filter management UI
- iCloud sync via `~/Library/Mobile Documents/`

### V3 Ideas (Longer Term)

- Desktop notifications for new files
- PWA manifest for Chrome "Install as app"
- AI summary of file contents
- Wiki-style link detection between markdown files
- Dark/light theme toggle
- Export/share starred file lists
- Drag-and-drop folders to add watch targets
- File diff view (compare versions if git-tracked)

## Non-Functional Requirements

- **Local only** — no auth, no deployment, no external API calls
- **Read-only** — never write to or modify watched `.md` files
- **Dark theme** — matches the user's working environment
- **Performance** — handle ~610 filtered files without lag (from ~9,200 total)
- **Security** — path validation prevents reading files outside watched directories
- **Persistence** — favorites, history, UI state survive restarts; moved files retain stars
- **Sync-ready** — state schema supports future multi-machine sync

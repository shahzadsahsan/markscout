# MarkReader — Architecture & Implementation Plan

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15** (App Router, TypeScript) | Fast to build, local dev server, API routes for file ops |
| Styling | **Tailwind CSS** | Dark theme, rapid iteration |
| File watching | **chokidar** | Superior to native `fs.watch` — handles renames, recursive dirs, cross-platform |
| Markdown rendering | **markdown-it** + plugins | Battle-tested (borrowed from md-fileserver), GFM, highlight.js, task lists |
| Live updates | **SSE** (Server-Sent Events) | Simpler than WebSocket for one-way server→client updates |
| State | **JSON file** (`~/.markreader/state.json`) | Sync-ready schema with timestamps, instanceId, atomic writes |
| Fonts | **JetBrains Mono** (sidebar/headings/code) + **Source Serif 4** (prose) via next/font | Distinctive, readable |

## File Structure

```
markreader/
├── package.json
├── next.config.ts
├── tsconfig.json
├── src/
│   ├── instrumentation.ts                # Boots chokidar on server start
│   ├── lib/
│   │   ├── types.ts                      # FileEntry, AppState, SSEEvent, FilterConfig
│   │   ├── hash.ts                       # Content hash (first 1KB + filesize → SHA-256)
│   │   ├── filters.ts                    # Path/filename exclusion logic + defaults
│   │   ├── state.ts                      # Read/write/merge ~/.markreader/state.json
│   │   └── watcher.ts                    # Chokidar singleton, file registry, SSE broadcast
│   └── app/
│       ├── layout.tsx                    # Root layout, fonts, dark theme
│       ├── globals.css                   # Tailwind + markdown prose styles + highlight.js
│       ├── page.tsx                      # Server component shell
│       ├── components/
│       │   ├── AppShell.tsx              # Client: multi-view sidebar + preview + SSE
│       │   ├── Sidebar.tsx               # Tab bar + view switching container
│       │   ├── RecentsView.tsx           # Flat list sorted by modified time
│       │   ├── FoldersView.tsx           # Collapsible tree view
│       │   ├── FavoritesView.tsx         # Starred files only
│       │   ├── HistoryView.tsx           # Last-opened files
│       │   ├── FileItem.tsx              # File row: name, time, star, project badge
│       │   ├── MarkdownPreview.tsx       # Renders markdown + header with metadata
│       │   └── StatusBar.tsx             # File count, filter count, connection status
│       └── api/
│           ├── files/route.ts            # GET: file list with view/sort params
│           ├── file/route.ts             # GET ?path=: raw markdown content + metadata
│           ├── star/route.ts             # POST: toggle star with timestamp
│           ├── history/route.ts          # POST: record open; GET: history list
│           └── events/route.ts           # GET: SSE stream
```

## Core Architecture

### Smart File Filtering (`src/lib/filters.ts`)

Chokidar-level path exclusions (never even scanned):

```ts
const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/.vercel/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/venv/**',
  '**/.venv/**',
  '**/.pytest_cache/**',
  '**/site-packages/**',
  '**/.dist-info/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/.claude/plugins/cache/**',
];
```

Post-discovery filename exclusions (regex):

```ts
const EXCLUDED_FILENAMES = [
  /^LICENSE\.md$/i,
  /^LICENCE\.md$/i,
  /^CHANGELOG\.md$/i,
  /^CHANGES\.md$/i,
  /^HISTORY\.md$/i,
  /^CODE_OF_CONDUCT\.md$/i,
  /^SECURITY\.md$/i,
  /^CONTRIBUTING\.md$/i,
  /^\.project-description\.md$/,
  /^99-harvest\.md$/,
  /^0[0-3]-(enter|orient|scope-).*\.md$/,
];
```

User can add/remove patterns via `state.json.filters`.

### Watcher Singleton (`src/lib/watcher.ts`)

```
┌─────────────────────────────────────────────────┐
│              watcher.ts (singleton)              │
│                                                  │
│  ┌──────────────┐    ┌────────────────────┐     │
│  │   chokidar    │──▶│  filters.ts         │     │
│  │  (fs events)  │    │  (path + name check)│     │
│  └──────────────┘    └────────┬───────────┘     │
│                               │ (if passes)      │
│                    ┌──────────▼──────────┐       │
│                    │  Map<path, FileEntry>│       │
│                    │  (file registry)     │       │
│                    └──────────┬──────────┘       │
│                               │                  │
│                    ┌──────────▼──────────┐       │
│                    │  Set<controller>     │       │
│                    │  (SSE clients)       │       │
│                    └──────────┬──────────┘       │
│                               │                  │
└───────────────────────────────┼──────────────────┘
                                │
                     SSE events to browser
```

**FileEntry**:
- `path` — absolute file path
- `name` — filename without `.md`
- `project` — first directory segment after watched root
- `relativePath` — path relative to watched root (for breadcrumb display)
- `modifiedAt` — mtime as epoch ms
- `size` — file size in bytes
- `contentHash` — SHA-256 of first 1KB + size string

**Watched directories**:
- `~/Vibe Coding/` — project = first child dir (e.g., `markreader`)
- `~/.claude/` — project = first child dir (e.g., `memory`, `plans`)

**Debouncing**: 100ms per file path.

### SSE Events

- `file-added` — new file, payload: FileEntry
- `file-changed` — modified, payload: FileEntry (includes new hash)
- `file-removed` — deleted, payload: `{ path }`
- `scan-complete` — initial scan finished, payload: `{ totalFiles, filteredCount }`

Client: `new EventSource('/api/events')` with 2s auto-reconnect.

### Sync-Ready State (`src/lib/state.ts`)

```ts
interface AppState {
  version: 2;
  instanceId: string;          // UUID per machine
  lastSyncedAt: number | null;

  favorites: Array<{
    path: string;
    contentHash: string;
    starredAt: number;         // Epoch ms — sort order + conflict resolution
  }>;

  history: Array<{
    path: string;
    contentHash: string;
    lastOpenedAt: number;
  }>;

  filters: {
    excludedPaths: string[];   // User-added path globs
    excludedNames: string[];   // User-added filename regexes
  };

  ui: {
    sidebarView: 'recents' | 'folders' | 'favorites' | 'history';
    sidebarWidth: number;
    lastSelectedPath: string | null;
    collapsedGroups: string[];
  };
}
```

**Sync design**: Timestamps on everything enable last-write-wins merge. Content hashes identify files across machines even if paths differ. Instance ID distinguishes sources. Atomic writes (`.tmp` → rename) prevent corruption. Version field enables migrations.

**Move tracking**: On startup, validate each favorite/history path. If gone, search registry by `contentHash`. If found at new path, update and save.

### Path Security

```
1. Resolve requested path (handle symlinks, relative segments)
2. Verify starts with ~/Vibe Coding/ OR ~/.claude/
3. Verify extension is .md
4. Any check fails → 403
```

## UI Layout

```
┌───────────────────────────────────────────────────────┐
│                      MarkReader                        │
├──────────────┬────────────────────────────────────────┤
│              │                                        │
│ [⏱][📁][⭐][📖] │  project / subdir / filename.md       │
│ ─────────── │  Modified 2m ago  •  1,234 words  •  4m │
│              │  ──────────────────────────────────── │
│  file-a.md   │                                        │
│   proj • 2m  │  # Heading with amber border           │
│              │                                        │
│  file-b.md   │  Body text in Source Serif 4 at 18px,  │
│   proj • 5m  │  max-width 720px, comfortable reading. │
│              │                                        │
│  file-c.md   │  ```ts                                 │
│   proj • 1h  │  const x = "highlighted code"          │
│              │  ```                                   │
│              │                                        │
│  file-d.md   │  > Blockquotes with amber left border  │
│   .claude 3h │                                        │
│              │                                        │
├──────────────┴────────────────────────────────────────┤
│  612 files  •  14 filtered  •  🟢 Connected            │
└───────────────────────────────────────────────────────┘
```

Sidebar tabs: ⏱ Recents | 📁 Folders | ⭐ Favorites | 📖 History

## Design Direction

- **Background**: `#0d0d0d` with subtle radial gradient to `#080808`
- **Surface**: `#161616` for sidebar
- **Border**: `#2a2a2a`
- **Text**: `#e0e0e0` primary, `#888` muted
- **Accent**: Amber `#d4a04a` for stars, active states, h1 borders
- **Code blocks**: `#111` background, highlight.js `github-dark` theme
- **Blockquotes**: amber left border, `#1a1a1a` background
- **Tables**: zebra-striped `#161616` / `#1a1a1a`, sticky headers
- **Sidebar active**: `#1e1e1e` background + amber left border

## Reading Experience

- **Body**: Source Serif 4, 18px, line-height 1.7 — warm serif for extended reading
- **Headings**: JetBrains Mono — monospace contrast with body
- **Code**: JetBrains Mono, 14px, `github-dark` highlighting
- **Max width**: 720px centered (65-75 chars per line)
- **h1**: 28px, amber bottom border, 32px top margin
- **h2**: 22px, subtle `#2a2a2a` bottom border
- **Links**: amber underline on hover
- **HR**: thin amber gradient, extra spacing
- **Task lists**: custom checkboxes, completed items muted

## Implementation Steps

### Step 1: Scaffold & install

```bash
npx create-next-app@latest markreader --typescript --tailwind --app --src-dir --no-turbopack
cd markreader
npm install chokidar markdown-it markdown-it-anchor highlight.js
npm install -D @types/markdown-it
```

### Step 2: Core types (`src/lib/types.ts`)

Define `FileEntry`, `AppState` (v2 schema), `SSEEvent`, `FilterConfig`, `SidebarView`.

### Step 3: Filters (`src/lib/filters.ts`)

- `IGNORED_PATHS` for chokidar `ignored` option
- `isExcludedFile(filename, userFilters)` regex matcher
- `getActiveFilterCount()` for status bar

### Step 4: Hash utility (`src/lib/hash.ts`)

First 1KB + file size → SHA-256 hex.

### Step 5: State persistence (`src/lib/state.ts`)

- Atomic read/write to `~/.markreader/state.json`
- Initialize with defaults on first run (v2, generated instanceId)
- Move tracking on startup (validate paths, search by hash)
- Favorites: `toggleFavorite(path, hash)`, `getFavorites()`
- History: `recordOpen(path, hash)`, `getHistory(limit)`, `clearHistory()`
- UI state: `saveSidebarView()`, `saveCollapsedGroups()`

### Step 6: Watcher singleton (`src/lib/watcher.ts`)

- chokidar with `IGNORED_PATHS` + `**/*.md`
- `isExcludedFile()` post-filter on add events
- File registry Map, SSE client Set
- Debounced broadcasts (100ms per path)
- Project grouping from path segments

### Step 7: Instrumentation (`src/instrumentation.ts`)

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initWatcher } = await import('./lib/watcher');
    await initWatcher();
  }
}
```

### Step 8: API routes

1. **`/api/files`** — GET with `?view=recents|folders|favorites|history`. Returns filtered/sorted file list.
2. **`/api/file?path=`** — GET reads content + computes word count + reading time. Path security validation.
3. **`/api/star`** — POST `{ path }` toggles favorite with timestamp.
4. **`/api/history`** — POST `{ path }` records open. GET returns history.
5. **`/api/events`** — SSE stream.

### Step 9: UI components

Build in order:
1. `globals.css` — dark theme, prose styles, highlight.js, tab styling
2. `layout.tsx` — fonts (Source Serif 4 + JetBrains Mono), dark html class
3. `AppShell.tsx` — state management, SSE listener, view routing, file selection
4. `Sidebar.tsx` — tab bar (4 icons), renders active view
5. `RecentsView.tsx` — flat list with project badges
6. `FoldersView.tsx` — collapsible tree with file counts
7. `FavoritesView.tsx` — starred files, empty state
8. `HistoryView.tsx` — last 50 opened, "opened Xm ago"
9. `FileItem.tsx` — shared row component
10. `MarkdownPreview.tsx` — markdown-it rendering + metadata header
11. `StatusBar.tsx` — file count, filtered count, connection dot

### Step 10: `next.config.ts`

```ts
const nextConfig = {
  serverExternalPackages: ['chokidar'],
};
```

### Step 11: Test & verify

- `npm run dev` — sidebar populates with ~610 files (filtered from ~9,200)
- Status bar shows "612 files • 14 filtered • 🟢 Connected"
- All 4 sidebar views work
- Create new `.md` file → appears in Recents within 1s
- Open a file → appears in History view
- Star a file → appears in Favorites view
- Edit viewed file → preview auto-refreshes
- Restart server → favorites, history, sidebar view all persist
- Move a starred file → star follows it on next launch
- Excluded files (LICENSE.md, node_modules, agent files) don't appear

## What We Borrowed from md-fileserver

| Pattern | How We Use It |
|---------|---------------|
| markdown-it + plugin config | Same rendering approach: markdown-it with anchor, highlight.js |
| GitHub-style markdown CSS | Adapted github.css, inverted for dark mode, enhanced for reading |
| Debounced file watching | 100ms debounce per file path on chokidar events |
| Path security | Directory whitelisting, symlink-safe path resolution |

What we **don't** borrow: Express (→ Next.js), WebSocket (→ SSE), serve-index (→ multi-view sidebar), Webpack (→ Next.js bundler).

# MarkScout — Project Instructions

## What This Is

A local-only Next.js web app for previewing markdown files. Watches `~/Vibe Coding/` and `~/.claude/` for `.md` files, smart-filters out ~8,600 framework/generated files to show ~610 human-readable ones, and provides a multi-view sidebar (Recents, Folders, Favorites, History) with a pleasant reading experience.

## Read First

- `REQUIREMENTS.md` — product requirements, feature list, evaluated alternatives
- `ARCHITECTURE.md` — tech stack, file structure, implementation plan with steps

## Key Constraints

- **Local only** — no auth, no deployment, no external API calls
- **Read-only** — never write to or modify the watched `.md` files
- **Dark theme only** for V1
- **chokidar** for file watching, initialized via `instrumentation.ts`
- **markdown-it** for rendering (not react-markdown)
- **SSE** for live updates (not WebSocket)
- **State** persists to `~/.markscout/state.json` (v2 sync-ready schema)
- **Security**: all `/api/file` requests must validate path is under a watched directory
- **Filtering**: exclude node_modules, build dirs, LICENSE/CHANGELOG, agent workflow files

## Stack

- Next.js 15, App Router, TypeScript, Tailwind CSS
- chokidar, markdown-it, markdown-it-anchor, highlight.js
- JetBrains Mono (sidebar, headings, code) + Source Serif 4 (prose body)

## Style

- Background: `#0d0d0d`, surface: `#161616`, border: `#2a2a2a`
- Text: `#e0e0e0` primary, `#888` muted
- Accent: amber `#d4a04a` for stars, active states, h1 borders
- Code blocks: `#111` background, highlight.js `github-dark`
- No purple gradients, no Inter/Roboto, no generic AI aesthetics
- Max prose width: 720px centered, 18px/1.7 body text

## Sidebar Views

4 views switchable via tab bar:
1. **Recents** (default) — all files by modified time
2. **Folders** — collapsible tree by project
3. **Favorites** — starred files by starred time
4. **History** — last 50 opened files

## Implementation Order

Follow ARCHITECTURE.md steps 1-11 in order. Build: types → filters → hash → state → watcher → instrumentation → API routes → UI components → config → test.

## File Filtering

The app excludes non-human-readable `.md` files at two levels:
1. **chokidar ignored paths**: node_modules, .next, .git, dist, build, venv, etc.
2. **Filename regex**: LICENSE, CHANGELOG, CODE_OF_CONDUCT, agent workflow files (99-harvest, 00-enter, etc.)

See `src/lib/filters.ts` for the full list. Users can customize via `state.json.filters`.

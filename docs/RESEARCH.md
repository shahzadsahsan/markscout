# Research Notes: Markdown Readers

## Landscape Analysis

Evaluated 12 markdown readers before building MarkScout. None solved the core problem: surfacing AI-generated docs from scattered project folders.

### What Exists

| App | Pros | Cons |
|-----|------|------|
| Obsidian | Powerful, plugins | Heavy, vault-based, not a reader |
| Typora | Beautiful rendering | Editor-first, single file |
| MacDown | Fast, native | No folder watching, dated UI |
| Marked 2 | Good rendering | No multi-folder, no filtering |
| iA Writer | Gorgeous typography | Editor, no multi-folder watch |

### The Gap

No existing tool:
1. Watches multiple directories simultaneously
2. Filters out framework noise (node_modules, build artifacts)
3. Understands AI agent file patterns (SKILL.md, .planning/, .rvry/)
4. Provides session intelligence (what changed since last time)

MarkScout fills this gap.

## Technical Research

### File Watching
- `chokidar` (Node.js): mature but heavy, 500ms+ latency
- `notify` (Rust): native OS integration, ~100ms debounce, much lighter
- Decision: moved to `notify` with Tauri rewrite for 5x less memory

### Rendering
- `react-markdown`: easy but slow for large files, no syntax highlighting OOTB
- `markdown-it`: fast, plugin ecosystem, server-side compatible
- Decision: `markdown-it` with `highlight.js` for code blocks

### Content Hashing
- SHA-256 of first 1024 bytes + file size string
- Enables move tracking without full-file reads
- ~0.1ms per file on M-series chips

# MarkScout Development Plan

## Current Phase: v0.5 — Session Intelligence

The goal of this phase is to make MarkScout aware of your workflow sessions. When you come back after a break, you should immediately see what changed.

### Completed

- What's New sidebar view with change badges
- Staleness indicators in Recents
- Smart Collections (auto-grouping by document type)
- Typography presets (5 options including Accessible)

### Next Up

- Code signing and notarization
- Homebrew cask distribution
- Windows and Linux builds

## Architecture Decisions

All state persists to `~/.markscout/state.json`. The Rust backend handles file watching, filtering, and search. The React frontend handles rendering and user interaction.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [REQUIREMENTS.md](REQUIREMENTS.md) for the full picture.

## Timeline

| Phase | Version | Status |
|-------|---------|--------|
| Tauri rewrite | v0.4.0 | Done |
| Session intelligence | v0.5.0 | Done |
| Polish & distribution | v0.6.0 | Planned |
| Cross-platform | v1.0.0 | Planned |

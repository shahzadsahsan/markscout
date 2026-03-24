// MarkScout — Workflow Awareness Commands (v0.6)
// Smart collections and file link graph.

use std::path::Path;

use regex::Regex;
use tauri::Manager;

use crate::state::AppStateManager;
use crate::types::{FileEntry, FileLink, SmartCollection};
use crate::watcher::FileWatcher;

// ---------------------------------------------------------------------------
// Collection definitions
// ---------------------------------------------------------------------------

struct CollectionDef {
    id: &'static str,
    label: &'static str,
    icon: &'static str,
    matcher: fn(&FileEntry) -> bool,
}

fn name_contains_any(name: &str, keywords: &[&str]) -> bool {
    let lower = name.to_lowercase();
    keywords.iter().any(|k| lower.contains(k))
}

fn path_contains_any(path: &str, segments: &[&str]) -> bool {
    let lower = path.to_lowercase();
    segments.iter().any(|s| lower.contains(s))
}

static COLLECTION_DEFS: &[CollectionDef] = &[
    CollectionDef {
        id: "plans",
        label: "Plans",
        icon: "\u{1F4CB}",  // clipboard
        matcher: |f| {
            name_contains_any(&f.name, &["plan"])
                || path_contains_any(&f.path, &[".planning/"])
        },
    },
    CollectionDef {
        id: "architecture",
        label: "Architecture Docs",
        icon: "\u{1F3D7}",  // building construction
        matcher: |f| name_contains_any(&f.name, &["architecture"]),
    },
    CollectionDef {
        id: "requirements",
        label: "Requirements & Specs",
        icon: "\u{1F4DD}",  // memo
        matcher: |f| name_contains_any(&f.name, &["requirements", "spec"]),
    },
    CollectionDef {
        id: "memory",
        label: "Memory Files",
        icon: "\u{1F9E0}",  // brain
        matcher: |f| {
            name_contains_any(&f.name, &["memory"])
                || path_contains_any(&f.path, &["/memory/"])
        },
    },
    CollectionDef {
        id: "research",
        label: "Research",
        icon: "\u{1F50D}",  // magnifying glass
        matcher: |f| {
            name_contains_any(&f.name, &["research"])
                || path_contains_any(&f.path, &[".rvry/", "/research/"])
        },
    },
    CollectionDef {
        id: "readme",
        label: "READMEs",
        icon: "\u{1F4D6}",  // open book
        matcher: |f| {
            let filename = Path::new(&f.path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            filename.eq_ignore_ascii_case("readme.md")
        },
    },
    CollectionDef {
        id: "guides",
        label: "Guides & Tutorials",
        icon: "\u{1F9ED}",  // compass
        matcher: |f| name_contains_any(&f.name, &["guide", "tutorial"]),
    },
    CollectionDef {
        id: "changelogs",
        label: "Changelogs",
        icon: "\u{1F4E6}",  // package
        matcher: |f| name_contains_any(&f.name, &["changelog", "changes"]),
    },
];

// ---------------------------------------------------------------------------
// get_collections — returns smart collections with matching files
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_collections(
    app_handle: tauri::AppHandle,
) -> Result<Vec<SmartCollection>, String> {
    let watcher = app_handle.state::<FileWatcher>();
    let all_files = watcher.get_all_files();

    let mut collections: Vec<SmartCollection> = Vec::new();

    for def in COLLECTION_DEFS {
        let mut matching: Vec<FileEntry> = all_files
            .iter()
            .filter(|f| (def.matcher)(f))
            .cloned()
            .collect();

        if matching.is_empty() {
            continue;
        }

        // Sort by modified time descending
        matching.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

        let count = matching.len() as u32;

        collections.push(SmartCollection {
            id: def.id.to_string(),
            label: def.label.to_string(),
            icon: def.icon.to_string(),
            files: matching,
            count,
        });
    }

    Ok(collections)
}

// ---------------------------------------------------------------------------
// get_file_links — find markdown references to other .md files
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_file_links(
    path: String,
    app_handle: tauri::AppHandle,
) -> Result<Vec<FileLink>, String> {
    let watcher = app_handle.state::<FileWatcher>();
    let state_mgr = app_handle.state::<AppStateManager>();

    // Security: validate the path is under a watched directory
    let resolved = std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| path.clone());

    if !watcher.is_valid_path(&resolved) {
        return Err("Access denied: path is not under a watched directory".to_string());
    }

    // Read file content
    let content = tokio::fs::read_to_string(&resolved)
        .await
        .map_err(|e| format!("Could not read file: {}", e))?;

    let file_dir = Path::new(&resolved)
        .parent()
        .unwrap_or(Path::new("/"));

    let mut links: Vec<FileLink> = Vec::new();
    let mut seen_targets: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Pattern 1: Markdown links like [text](path.md) or [text](./path.md)
    let md_link_re = Regex::new(r"\[([^\]]*)\]\(([^)]*\.md)\)").unwrap();

    // Pattern 2: Bare .md file references like ARCHITECTURE.md, PLAN.md
    let bare_ref_re = Regex::new(r"\b([A-Za-z][A-Za-z0-9_-]*\.md)\b").unwrap();

    for (line_idx, line) in content.lines().enumerate() {
        let line_number = (line_idx + 1) as u32;

        // Check markdown links
        for cap in md_link_re.captures_iter(line) {
            let link_text = cap.get(1).map(|m| m.as_str()).unwrap_or("");
            let link_path = cap.get(2).map(|m| m.as_str()).unwrap_or("");

            if let Some(target) = resolve_link_target(link_path, file_dir, &watcher) {
                if seen_targets.insert(target.clone()) {
                    let target_name = Path::new(&target)
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    links.push(FileLink {
                        target_path: target,
                        target_name,
                        link_text: link_text.to_string(),
                        line_number,
                    });
                }
            }
        }

        // Check bare references (skip if already found via markdown link on this line)
        for cap in bare_ref_re.captures_iter(line) {
            let filename = cap.get(1).map(|m| m.as_str()).unwrap_or("");

            // Skip if this is inside a markdown link (already caught above)
            if line.contains(&format!("({})", filename))
                || line.contains(&format!("(./{}", filename))
            {
                continue;
            }

            // Try to find this file in the registry by name
            if let Some(target) = find_file_by_name(filename, &watcher) {
                if seen_targets.insert(target.clone()) {
                    let target_name = Path::new(&target)
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    links.push(FileLink {
                        target_path: target,
                        target_name,
                        link_text: filename.to_string(),
                        line_number,
                    });
                }
            }
        }
    }

    // Drop unused state_mgr binding (kept for potential future use)
    let _ = state_mgr;

    Ok(links)
}

// ---------------------------------------------------------------------------
// Link resolution helpers
// ---------------------------------------------------------------------------

/// Try to resolve a relative link path to an absolute path in the registry.
fn resolve_link_target(
    link_path: &str,
    file_dir: &Path,
    watcher: &tauri::State<'_, FileWatcher>,
) -> Option<String> {
    // Try resolving relative to the current file's directory
    let candidate = file_dir.join(link_path);
    if let Ok(resolved) = std::fs::canonicalize(&candidate) {
        let resolved_str = resolved.to_string_lossy().to_string();
        if watcher.contains(&resolved_str) {
            return Some(resolved_str);
        }
    }

    // Try finding by filename in the registry
    let filename = Path::new(link_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())?;

    find_file_by_name(&filename, watcher)
}

/// Find a file in the watcher registry by its filename.
fn find_file_by_name(
    filename: &str,
    watcher: &tauri::State<'_, FileWatcher>,
) -> Option<String> {
    let all_files = watcher.get_all_files();
    let lower = filename.to_lowercase();

    all_files
        .iter()
        .find(|f| {
            let f_name = Path::new(&f.path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string().to_lowercase())
                .unwrap_or_default();
            f_name == lower
        })
        .map(|f| f.path.clone())
}

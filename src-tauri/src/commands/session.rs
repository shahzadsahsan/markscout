// MarkScout — Session Intelligence Commands (v0.5)

use std::collections::HashMap;

use tauri::Manager;

use crate::state::AppStateManager;
use crate::types::{FileEntry, ProjectGroup, WhatsNewResponse};
use crate::watcher::FileWatcher;

// ---------------------------------------------------------------------------
// record_session_start — saves current time, returns previous session time
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn record_session_start(
    app_handle: tauri::AppHandle,
) -> Result<Option<u64>, String> {
    let state_mgr = app_handle.state::<AppStateManager>();
    state_mgr
        .record_session_start()
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// get_whats_new — files changed since the last session
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_whats_new(
    app_handle: tauri::AppHandle,
) -> Result<WhatsNewResponse, String> {
    let state_mgr = app_handle.state::<AppStateManager>();
    let watcher = app_handle.state::<FileWatcher>();

    let last_session_at = state_mgr.get_last_session_at().await;

    let all_files = watcher.get_all_files();

    // If there's no previous session, return empty — everything is "new"
    let changed_files = match last_session_at {
        Some(ts) => {
            // Find all files modified after the last session
            let mut changed: Vec<FileEntry> = all_files
                .into_iter()
                .filter(|f| f.modified_at > ts)
                .collect();

            // Sort by modified time descending
            changed.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
            changed
        }
        None => vec![],
    };

    let total_changes = changed_files.len() as u32;

    // Group by project
    let groups = group_by_project(changed_files);

    Ok(WhatsNewResponse {
        last_session_at,
        changed_files: groups,
        total_changes,
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn group_by_project(files: Vec<FileEntry>) -> Vec<ProjectGroup> {
    let mut map: HashMap<String, Vec<FileEntry>> = HashMap::new();

    for file in files {
        map.entry(file.project.clone())
            .or_default()
            .push(file);
    }

    let mut groups: Vec<ProjectGroup> = map
        .into_iter()
        .map(|(project, files)| ProjectGroup { project, files })
        .collect();

    // Sort groups alphabetically by project name
    groups.sort_by(|a, b| a.project.to_lowercase().cmp(&b.project.to_lowercase()));

    groups
}

use serde::Serialize;
use tauri::{Manager, State};
use crate::filters::{self, DEFAULT_PRESETS};
use crate::state::AppStateManager;
use crate::types::{FilterConfig, FilterPresetId};
use crate::watcher::FileWatcher;

/// Enriched preset with active status and match count for the UI
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetInfo {
    pub id: FilterPresetId,
    pub label: String,
    pub description: String,
    pub category: String,
    pub active: bool,
    pub match_count: usize,
}

/// Full preferences response matching what the frontend expects
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesResponse {
    pub presets: Vec<PresetInfo>,
    pub custom_watch_dirs: Vec<String>,
    pub min_file_length: Option<u64>,
    pub excluded_folders: Vec<String>,
}

#[tauri::command]
pub async fn get_preferences(
    state: State<'_, AppStateManager>,
    app_handle: tauri::AppHandle,
) -> Result<PreferencesResponse, String> {
    let prefs = state.get_preferences().await;
    let app_state = state.get_state().await;

    // Get files from watcher for match counting
    let watcher = app_handle.state::<FileWatcher>();
    let all_files = watcher.get_all_files();

    let presets: Vec<PresetInfo> = DEFAULT_PRESETS
        .iter()
        .map(|preset| {
            let active = prefs.active_presets.contains(&preset.id);
            let match_count = all_files
                .iter()
                .filter(|f| {
                    let filename = std::path::Path::new(&f.path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    filters::matches_preset(&f.path, &filename, preset)
                })
                .count();

            PresetInfo {
                id: preset.id.clone(),
                label: preset.label.clone(),
                description: preset.description.clone(),
                category: preset.category.clone(),
                active,
                match_count,
            }
        })
        .collect();

    Ok(PreferencesResponse {
        presets,
        custom_watch_dirs: prefs.watch_dirs,
        min_file_length: prefs.min_file_length,
        excluded_folders: app_state.excluded_folders,
    })
}

#[tauri::command]
pub async fn toggle_preset(
    state: State<'_, AppStateManager>,
    preset_id: FilterPresetId,
) -> Result<serde_json::Value, String> {
    let is_active = state.toggle_preset(preset_id).await.map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "active": is_active }))
}

#[tauri::command]
pub async fn add_watch_dir(
    state: State<'_, AppStateManager>,
    path: String,
) -> Result<(), String> {
    // Expand ~ to home directory
    let expanded = if path.starts_with('~') {
        if let Some(home) = dirs::home_dir() {
            path.replacen('~', &home.to_string_lossy(), 1)
        } else {
            path
        }
    } else {
        path
    };
    state.add_watch_dir(&expanded).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_watch_dir(
    state: State<'_, AppStateManager>,
    path: String,
) -> Result<(), String> {
    state.remove_watch_dir(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_min_file_length(
    state: State<'_, AppStateManager>,
    bytes: u64,
) -> Result<(), String> {
    state.save_min_file_length(bytes).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_filter(
    state: State<'_, AppStateManager>,
    action: String,
    path: String,
) -> Result<(), String> {
    match action.as_str() {
        "add" => state.add_excluded_path(&path).await.map_err(|e| e.to_string()),
        "remove" => state.remove_excluded_path(&path).await.map_err(|e| e.to_string()),
        _ => Err(format!("Unknown action: {}", action)),
    }
}

#[tauri::command]
pub async fn get_filters(
    state: State<'_, AppStateManager>,
) -> Result<FilterConfig, String> {
    Ok(state.get_filters().await)
}

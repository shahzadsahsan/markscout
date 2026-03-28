// Stub — will be implemented later

use std::collections::HashMap;
use tauri::State;
use crate::state::AppStateManager;
use crate::types::{UiStateResponse, SidebarView};

#[tauri::command]
pub async fn get_ui_state(
    state: State<'_, AppStateManager>,
) -> Result<UiStateResponse, String> {
    let app_state = state.get_state().await;
    Ok(UiStateResponse {
        sidebar_view: app_state.ui.sidebar_view,
        sidebar_width: app_state.ui.sidebar_width,
        sidebar_collapsed: app_state.ui.sidebar_collapsed,
        last_selected_path: app_state.ui.last_selected_path,
        collapsed_groups: app_state.ui.collapsed_groups,
        expanded_groups: app_state.ui.expanded_groups,
        zoom_level: app_state.ui.zoom_level,
        fill_screen: app_state.ui.fill_screen,
        content_search: app_state.ui.content_search,
        favorites: app_state.favorites,
        favorite_folders: app_state.favorite_folders,
        history: app_state.history,
        scroll_positions: app_state.ui.scroll_positions,
    })
}

#[tauri::command]
pub async fn save_ui_state(
    state: State<'_, AppStateManager>,
    sidebar_view: Option<SidebarView>,
    sidebar_width: Option<f64>,
    sidebar_collapsed: Option<bool>,
    last_selected_path: Option<String>,
    collapsed_groups: Option<Vec<String>>,
    expanded_groups: Option<Vec<String>>,
    zoom_level: Option<f64>,
    fill_screen: Option<bool>,
    content_search: Option<bool>,
    scroll_positions: Option<HashMap<String, f64>>,
) -> Result<(), String> {
    if let Some(v) = sidebar_view {
        state.save_sidebar_view(v).await.map_err(|e| e.to_string())?;
    }
    if let Some(w) = sidebar_width {
        state.save_sidebar_width(w).await.map_err(|e| e.to_string())?;
    }
    if let Some(c) = sidebar_collapsed {
        state.save_sidebar_collapsed(c).await.map_err(|e| e.to_string())?;
    }
    if let Some(p) = last_selected_path {
        state.save_last_selected_path(Some(p)).await.map_err(|e| e.to_string())?;
    }
    if let Some(g) = collapsed_groups {
        state.save_collapsed_groups(g).await.map_err(|e| e.to_string())?;
    }
    if let Some(g) = expanded_groups {
        state.save_expanded_groups(g).await.map_err(|e| e.to_string())?;
    }
    if let Some(z) = zoom_level {
        state.save_zoom_level(z).await.map_err(|e| e.to_string())?;
    }
    if let Some(f) = fill_screen {
        state.save_fill_screen(f).await.map_err(|e| e.to_string())?;
    }
    if let Some(c) = content_search {
        state.save_content_search(c).await.map_err(|e| e.to_string())?;
    }
    if let Some(sp) = scroll_positions {
        state.save_scroll_positions(sp).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_favorite(
    state: State<'_, AppStateManager>,
    path: String,
    content_hash: String,
) -> Result<bool, String> {
    state.toggle_favorite(&path, &content_hash).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_folder_star(
    state: State<'_, AppStateManager>,
    path: String,
) -> Result<bool, String> {
    state.toggle_favorite_folder(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn record_history(
    state: State<'_, AppStateManager>,
    path: String,
    content_hash: String,
) -> Result<(), String> {
    state.record_history(&path, &content_hash).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_history(
    state: State<'_, AppStateManager>,
) -> Result<Vec<crate::types::HistoryEntry>, String> {
    Ok(state.get_history().await)
}

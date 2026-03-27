// MarkScout — Core Types (Rust port of src/lib/types.ts)

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

// --- Sidebar View ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SidebarView {
    Recents,
    Folders,
    Favorites,
}

// --- Filter Preset ID ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum FilterPresetId {
    ReadmeFiles,
    LicenseFiles,
    ChangelogFiles,
    DotfileConfigs,
    ClaudePlugins,
    ClaudeSkills,
    ClaudeSessions,
    ClaudePipeline,
    ClaudeMemory,
    ClaudePlans,
    ClaudeCognition,
}

// --- File Entry ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub path: String,
    pub name: String,
    pub project: String,
    pub relative_path: String,
    pub modified_at: u64,
    pub size: u64,
    pub content_hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_count: Option<u32>,
}

// --- Favorite Entry ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteEntry {
    pub path: String,
    pub content_hash: String,
    pub starred_at: u64,
}

// --- History Entry ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub path: String,
    pub content_hash: String,
    pub last_opened_at: u64,
    #[serde(default = "default_view_count")]
    pub view_count: u32,
}

fn default_view_count() -> u32 { 1 }

// --- Filter Config ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterConfig {
    pub excluded_paths: Vec<String>,
    pub excluded_names: Vec<String>,
}

// --- Filter Preset ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterPreset {
    pub id: FilterPresetId,
    pub label: String,
    pub description: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub match_count: Option<u32>,
    pub path_patterns: Vec<String>,
    pub name_patterns: Vec<String>,
}

// --- Preferences State ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesState {
    pub active_presets: Vec<FilterPresetId>,
    pub watch_dirs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_file_length: Option<u64>,
}

// --- UI State ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub sidebar_view: SidebarView,
    pub sidebar_width: f64,
    pub sidebar_collapsed: bool,
    pub last_selected_path: Option<String>,
    pub collapsed_groups: Vec<String>,
    pub expanded_groups: Vec<String>,
    pub zoom_level: f64,
    pub fill_screen: bool,
    pub content_search: bool,
    #[serde(default)]
    pub scroll_positions: HashMap<String, f64>,
}

// --- App State (v2) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub version: u32,
    pub instance_id: String,
    pub last_synced_at: Option<u64>,

    pub favorites: Vec<FavoriteEntry>,
    pub favorite_folders: Vec<String>,
    pub history: Vec<HistoryEntry>,

    pub filters: FilterConfig,
    pub preferences: PreferencesState,
    pub ui: UiState,

    #[serde(default)]
    pub excluded_folders: Vec<String>,

    #[serde(default)]
    pub last_session_at: Option<u64>,
}

// --- v0.5 / v0.6 Response Types ---

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WhatsNewResponse {
    pub last_session_at: Option<u64>,
    pub changed_files: Vec<ProjectGroup>,
    pub total_changes: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectGroup {
    pub project: String,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartCollection {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub files: Vec<FileEntry>,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileLink {
    pub target_path: String,
    pub target_name: String,
    pub link_text: String,
    pub line_number: u32,
}

// --- Folder Node ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderNode {
    pub name: String,
    pub path: String,
    pub files: Vec<FileEntry>,
    pub children: Vec<FolderNode>,
    pub file_count: u32,
}

// --- Search Result ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub file: FileEntry,
    pub snippet: String,
    pub match_count: u32,
    pub line_number: u32,
}

// --- File Content Response ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContentResponse {
    pub path: String,
    pub content: String,
    pub name: String,
    pub project: String,
    pub relative_path: String,
    pub modified_at: u64,
    pub size: u64,
    pub word_count: u32,
    pub reading_time: u32,
    pub is_favorite: bool,
    pub content_hash: String,
}

// --- SSE Event Types (for Tauri events) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: FileEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: RemoveEventData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveEventData {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompleteEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub data: ScanCompleteData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanCompleteData {
    pub total_files: u32,
    pub filtered_count: u32,
}

// --- UI State Response (full payload for frontend) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiStateResponse {
    pub sidebar_view: SidebarView,
    pub sidebar_width: f64,
    pub sidebar_collapsed: bool,
    pub last_selected_path: Option<String>,
    pub collapsed_groups: Vec<String>,
    pub expanded_groups: Vec<String>,
    pub zoom_level: f64,
    pub fill_screen: bool,
    pub content_search: bool,
    pub favorites: Vec<FavoriteEntry>,
    pub favorite_folders: Vec<String>,
    pub history: Vec<HistoryEntry>,
    #[serde(default)]
    pub scroll_positions: HashMap<String, f64>,
}

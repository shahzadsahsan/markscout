// MarkScout — State Persistence (Rust port of src/lib/state.ts)
// Reads/writes ~/.markscout/state.json with atomic writes.

use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::sync::Mutex;

use std::collections::HashMap;
use crate::types::{
    AppState, FavoriteEntry, FilterConfig, FilterPresetId, HistoryEntry, PreferencesState,
    SidebarView, UiState,
};

const HISTORY_LIMIT: usize = 50;

fn state_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not determine home directory")
        .join(".markscout")
}

fn state_file() -> PathBuf {
    state_dir().join("state.json")
}

fn state_tmp() -> PathBuf {
    state_dir().join("state.json.tmp")
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn default_state() -> AppState {
    AppState {
        version: 2,
        instance_id: uuid::Uuid::new_v4().to_string(),
        last_synced_at: None,
        favorites: vec![],
        favorite_folders: vec![],
        history: vec![],
        filters: FilterConfig {
            excluded_paths: vec![],
            excluded_names: vec![],
        },
        preferences: PreferencesState {
            active_presets: vec![],
            watch_dirs: vec![],
            min_file_length: Some(0),
        },
        ui: UiState {
            sidebar_view: SidebarView::Recents,
            sidebar_width: 280.0,
            sidebar_collapsed: false,
            last_selected_path: None,
            collapsed_groups: vec![],
            expanded_groups: vec![],
            zoom_level: 1.0,
            fill_screen: false,
            content_search: false,
            scroll_positions: HashMap::new(),
        },
        excluded_folders: vec![],
        last_session_at: None,
    }
}

// ---------------------------------------------------------------------------
// AppStateManager
// ---------------------------------------------------------------------------

pub struct AppStateManager {
    state: Mutex<AppState>,
    first_run: Mutex<bool>,
}

impl AppStateManager {
    /// Load state from disk, or create a default if missing/corrupt.
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let path = state_file();
        let (state, first_run) = if path.exists() {
            match std::fs::read_to_string(&path) {
                Ok(raw) => match serde_json::from_str::<AppState>(&raw) {
                    Ok(mut parsed) => {
                        if parsed.version != 2 {
                            (default_state(), false)
                        } else {
                            // Migrate missing V2 fields
                            if parsed.preferences.min_file_length.is_none() {
                                parsed.preferences.min_file_length = Some(0);
                            }
                            (parsed, false)
                        }
                    }
                    Err(_) => (default_state(), true),
                },
                Err(_) => (default_state(), true),
            }
        } else {
            let s = default_state();
            // Write initial state
            let dir = state_dir();
            std::fs::create_dir_all(&dir)?;
            atomic_write_sync(&s)?;
            (s, true)
        };

        Ok(Self {
            state: Mutex::new(state),
            first_run: Mutex::new(first_run),
        })
    }

    /// Whether this is the first run (no prior state file).
    pub async fn is_first_run(&self) -> bool {
        *self.first_run.lock().await
    }

    /// Save current state to disk atomically.
    async fn save(&self, state: &AppState) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let dir = state_dir();
        tokio::fs::create_dir_all(&dir).await?;
        let json = serde_json::to_string_pretty(state)?;
        tokio::fs::write(state_tmp(), &json).await?;
        tokio::fs::rename(state_tmp(), state_file()).await?;
        Ok(())
    }

    // --- State access ---

    /// Get a clone of the full state.
    pub async fn get_state(&self) -> AppState {
        self.state.lock().await.clone()
    }

    // --- Favorites ---

    /// Toggle a file as favorite. Returns true if now starred, false if unstarred.
    pub async fn toggle_favorite(
        &self,
        path: &str,
        content_hash: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        if let Some(idx) = state.favorites.iter().position(|f| f.path == path) {
            state.favorites.remove(idx);
            self.save(&state).await?;
            Ok(false)
        } else {
            state.favorites.push(FavoriteEntry {
                path: path.to_string(),
                content_hash: content_hash.to_string(),
                starred_at: now_millis(),
            });
            self.save(&state).await?;
            Ok(true)
        }
    }

    /// Get favorites sorted by starred time (newest first).
    pub async fn get_favorites(&self) -> Vec<FavoriteEntry> {
        let state = self.state.lock().await;
        let mut favs = state.favorites.clone();
        favs.sort_by(|a, b| b.starred_at.cmp(&a.starred_at));
        favs
    }

    /// Check if a path is a favorite.
    pub async fn is_favorite(&self, path: &str) -> bool {
        let state = self.state.lock().await;
        state.favorites.iter().any(|f| f.path == path)
    }

    // --- History ---

    /// Record a file open in history. Moves existing entries to the top.
    pub async fn record_history(
        &self,
        path: &str,
        content_hash: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;

        // Find existing entry to carry forward view_count
        let prev_count = state.history.iter()
            .find(|h| h.path == path)
            .map(|h| h.view_count)
            .unwrap_or(0);

        // Remove existing entry for this path
        state.history.retain(|h| h.path != path);

        // Add at beginning with incremented count
        state.history.insert(
            0,
            HistoryEntry {
                path: path.to_string(),
                content_hash: content_hash.to_string(),
                last_opened_at: now_millis(),
                view_count: prev_count + 1,
            },
        );

        // Trim to limit
        state.history.truncate(HISTORY_LIMIT);

        self.save(&state).await?;
        Ok(())
    }

    /// Get history entries (already in newest-first order).
    pub async fn get_history(&self) -> Vec<HistoryEntry> {
        let state = self.state.lock().await;
        state.history.clone()
    }

    // --- UI State ---

    /// Update sidebar view.
    pub async fn save_sidebar_view(
        &self,
        view: SidebarView,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.sidebar_view = view;
        self.save(&state).await
    }

    /// Update sidebar width.
    pub async fn save_sidebar_width(
        &self,
        width: f64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.sidebar_width = width;
        self.save(&state).await
    }

    /// Update sidebar collapsed state.
    pub async fn save_sidebar_collapsed(
        &self,
        collapsed: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.sidebar_collapsed = collapsed;
        self.save(&state).await
    }

    /// Save the last selected file path.
    pub async fn save_last_selected_path(
        &self,
        path: Option<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.last_selected_path = path;
        self.save(&state).await
    }

    /// Save collapsed groups.
    pub async fn save_collapsed_groups(
        &self,
        groups: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.collapsed_groups = groups;
        self.save(&state).await
    }

    /// Save expanded groups.
    pub async fn save_expanded_groups(
        &self,
        groups: Vec<String>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.expanded_groups = groups;
        self.save(&state).await
    }

    /// Save zoom level.
    pub async fn save_zoom_level(
        &self,
        zoom_level: f64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.zoom_level = zoom_level;
        self.save(&state).await
    }

    /// Save fill-screen preference.
    pub async fn save_fill_screen(
        &self,
        fill_screen: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.fill_screen = fill_screen;
        self.save(&state).await
    }

    /// Save content search preference.
    pub async fn save_content_search(
        &self,
        content_search: bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.content_search = content_search;
        self.save(&state).await
    }

    /// Save scroll positions (capped at 200 entries).
    pub async fn save_scroll_positions(
        &self,
        positions: HashMap<String, f64>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.ui.scroll_positions = positions;
        // Cap at 200 most recent entries
        if state.ui.scroll_positions.len() > 200 {
            // Keep only the 200 entries — since HashMap has no order, just truncate
            let keys: Vec<String> = state.ui.scroll_positions.keys().skip(200).cloned().collect();
            for key in keys {
                state.ui.scroll_positions.remove(&key);
            }
        }
        self.save(&state).await
    }

    /// Get the current UI state.
    pub async fn get_ui_state(&self) -> UiState {
        let state = self.state.lock().await;
        state.ui.clone()
    }

    // --- Favorite Folders ---

    /// Toggle a folder as starred. Returns true if now starred.
    pub async fn toggle_favorite_folder(
        &self,
        folder_path: &str,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        if let Some(idx) = state
            .favorite_folders
            .iter()
            .position(|p| p == folder_path)
        {
            state.favorite_folders.remove(idx);
            self.save(&state).await?;
            Ok(false)
        } else {
            state.favorite_folders.push(folder_path.to_string());
            self.save(&state).await?;
            Ok(true)
        }
    }

    /// Get starred folders.
    pub async fn get_favorite_folders(&self) -> Vec<String> {
        let state = self.state.lock().await;
        state.favorite_folders.clone()
    }

    // --- Excluded Paths ---

    /// Add a path glob to user exclusions.
    pub async fn add_excluded_path(
        &self,
        path_glob: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        if !state.filters.excluded_paths.contains(&path_glob.to_string()) {
            state.filters.excluded_paths.push(path_glob.to_string());
            self.save(&state).await?;
        }
        Ok(())
    }

    /// Remove a path glob from user exclusions.
    pub async fn remove_excluded_path(
        &self,
        path_glob: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.filters.excluded_paths.retain(|p| p != path_glob);
        self.save(&state).await
    }

    /// Get user-configured filter config.
    pub async fn get_filters(&self) -> FilterConfig {
        let state = self.state.lock().await;
        state.filters.clone()
    }

    // --- Preferences ---

    /// Get preferences.
    pub async fn get_preferences(&self) -> PreferencesState {
        let state = self.state.lock().await;
        state.preferences.clone()
    }

    /// Toggle a filter preset. Returns true if now active.
    pub async fn toggle_preset(
        &self,
        preset_id: FilterPresetId,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        if let Some(idx) = state
            .preferences
            .active_presets
            .iter()
            .position(|p| p == &preset_id)
        {
            state.preferences.active_presets.remove(idx);
            self.save(&state).await?;
            Ok(false)
        } else {
            state.preferences.active_presets.push(preset_id);
            self.save(&state).await?;
            Ok(true)
        }
    }

    /// Get active preset IDs.
    pub async fn get_active_presets(&self) -> Vec<FilterPresetId> {
        let state = self.state.lock().await;
        state.preferences.active_presets.clone()
    }

    /// Add a watch directory.
    pub async fn add_watch_dir(
        &self,
        dir_path: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        if !state.preferences.watch_dirs.contains(&dir_path.to_string()) {
            state.preferences.watch_dirs.push(dir_path.to_string());
            self.save(&state).await?;
        }
        Ok(())
    }

    /// Remove a watch directory.
    pub async fn remove_watch_dir(
        &self,
        dir_path: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.preferences.watch_dirs.retain(|d| d != dir_path);
        self.save(&state).await
    }

    /// Get watch directories.
    pub async fn get_watch_dirs(&self) -> Vec<String> {
        let state = self.state.lock().await;
        state.preferences.watch_dirs.clone()
    }

    /// Get minimum file length.
    pub async fn get_min_file_length(&self) -> u64 {
        let state = self.state.lock().await;
        state.preferences.min_file_length.unwrap_or(0)
    }

    /// Set minimum file length.
    pub async fn save_min_file_length(
        &self,
        bytes: u64,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        state.preferences.min_file_length = Some(bytes);
        self.save(&state).await
    }

    // --- Move Tracking ---

    /// Reconcile favorite/history paths against a known file registry.
    /// If a path no longer exists but the hash is found at a new path, update it.
    pub async fn reconcile_paths(
        &self,
        registry: &std::collections::HashMap<String, String>, // path -> contentHash
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        let mut changed = false;

        // Build hash -> path lookup
        let hash_to_path: std::collections::HashMap<&str, &str> = registry
            .iter()
            .map(|(path, hash)| (hash.as_str(), path.as_str()))
            .collect();

        // Reconcile favorites
        for fav in state.favorites.iter_mut() {
            if !registry.contains_key(&fav.path) {
                if let Some(&new_path) = hash_to_path.get(fav.content_hash.as_str()) {
                    fav.path = new_path.to_string();
                    changed = true;
                }
            }
        }

        // Reconcile history
        for hist in state.history.iter_mut() {
            if !registry.contains_key(&hist.path) {
                if let Some(&new_path) = hash_to_path.get(hist.content_hash.as_str()) {
                    hist.path = new_path.to_string();
                    changed = true;
                }
            }
        }

        if changed {
            self.save(&state).await?;
        }
        Ok(())
    }

    // --- Session Tracking ---

    /// Record that a new session has started. Returns the PREVIOUS session timestamp
    /// so the frontend knows "changes since X".
    pub async fn record_session_start(
        &self,
    ) -> Result<Option<u64>, Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        let previous = state.last_session_at;
        state.last_session_at = Some(now_millis());
        self.save(&state).await?;
        Ok(previous)
    }

    /// Get the last session timestamp.
    pub async fn get_last_session_at(&self) -> Option<u64> {
        let state = self.state.lock().await;
        state.last_session_at
    }

    /// Live move tracking: check if a newly added file's hash matches any
    /// favorite/history entry with a missing path.
    pub async fn check_live_move(
        &self,
        new_path: &str,
        content_hash: &str,
        registry_has: impl Fn(&str) -> bool,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut state = self.state.lock().await;
        let mut changed = false;

        for fav in state.favorites.iter_mut() {
            if fav.content_hash == content_hash
                && fav.path != new_path
                && !registry_has(&fav.path)
            {
                fav.path = new_path.to_string();
                changed = true;
            }
        }

        for hist in state.history.iter_mut() {
            if hist.content_hash == content_hash
                && hist.path != new_path
                && !registry_has(&hist.path)
            {
                hist.path = new_path.to_string();
                changed = true;
            }
        }

        if changed {
            self.save(&state).await?;
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Sync atomic write (used only during initialization)
// ---------------------------------------------------------------------------

fn atomic_write_sync(state: &AppState) -> Result<(), Box<dyn std::error::Error>> {
    let json = serde_json::to_string_pretty(state)?;
    std::fs::write(state_tmp(), &json)?;
    std::fs::rename(state_tmp(), state_file())?;
    Ok(())
}

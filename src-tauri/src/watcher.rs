// MarkScout — File Watcher (Rust port of src/lib/watcher.ts)
// Watches configured directories for .md files, maintains a registry,
// and emits Tauri events to the frontend on changes.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use dashmap::DashMap;
use notify::RecursiveMode;
use notify_debouncer_full::{
    new_debouncer, DebounceEventResult, DebouncedEvent, Debouncer, RecommendedCache,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::filters::{self, IGNORED_DIRS};
use crate::hash::compute_content_hash;
use crate::state::AppStateManager;
use crate::types::FileEntry;

// ---------------------------------------------------------------------------
// FileWatcher — Tauri-managed state
// ---------------------------------------------------------------------------

pub struct FileWatcher {
    /// All tracked .md files, keyed by absolute path.
    pub registry: Arc<DashMap<String, FileEntry>>,
    /// The notify debouncer (behind a mutex so we can add/remove watch paths).
    watcher: Mutex<Option<Debouncer<notify::RecommendedWatcher, RecommendedCache>>>,
    /// Tauri app handle for emitting events and accessing other managed state.
    app_handle: AppHandle,
    /// True once the initial directory scan is complete.
    scan_complete: AtomicBool,
    /// Directories currently being watched.
    watched_dirs: Mutex<Vec<String>>,
}

impl FileWatcher {
    /// Create a new FileWatcher, load watch dirs from state, perform initial
    /// scan, and start the notify watcher.
    pub fn new(handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        // Read watch dirs directly from state file (synchronous, no async runtime needed)
        let watch_dirs = Self::read_watch_dirs_sync();
        let has_dirs = !watch_dirs.is_empty();

        let fw = Self {
            registry: Arc::new(DashMap::new()),
            watcher: Mutex::new(None),
            app_handle: handle.clone(),
            scan_complete: AtomicBool::new(!has_dirs),
            watched_dirs: Mutex::new(watch_dirs.clone()),
        };

        if has_dirs {
            // Perform initial scan synchronously so files are ready before UI loads
            let ctx = load_filter_context_sync(&handle);
            for dir in &watch_dirs {
                scan_directory_sync(&fw.registry, dir, &ctx);
            }
            fw.scan_complete.store(true, Ordering::SeqCst);

            // Reconcile move tracking
            reconcile_sync(&handle, &fw.registry);

            // Emit scan-complete
            let count = fw.registry.len() as u32;
            let _ = handle.emit(
                "file-event",
                serde_json::json!({
                    "type": "scan-complete",
                    "count": count,
                }),
            );

            // Start the async file watcher in a background thread
            let registry = fw.registry.clone();
            let app = handle.clone();
            let dirs = watch_dirs.clone();
            std::thread::spawn(move || {
                if let Err(e) = start_notify_watcher_blocking(registry, app, dirs) {
                    log::error!("[MarkScout] Failed to start notify watcher: {}", e);
                }
            });
        }

        Ok(fw)
    }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    /// Get all tracked files as a Vec.
    pub fn get_all_files(&self) -> Vec<FileEntry> {
        self.registry.iter().map(|r| r.value().clone()).collect()
    }

    /// Get all files sorted by modified time descending.
    pub fn get_all_files_sorted_by_modified(&self) -> Vec<FileEntry> {
        let mut files = self.get_all_files();
        files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
        files
    }

    /// Get a single file entry by path.
    pub fn get_entry(&self, path: &str) -> Option<FileEntry> {
        self.registry.get(path).map(|r| r.value().clone())
    }

    /// Whether the initial scan has completed.
    pub fn is_scan_complete(&self) -> bool {
        self.scan_complete.load(Ordering::SeqCst)
    }

    /// Synchronously read watch dirs from state file (for init)
    fn read_watch_dirs_sync() -> Vec<String> {
        read_state_sync().preferences.watch_dirs
    }

    /// Get the list of currently watched directories.
    pub fn get_watched_dirs(&self) -> Vec<String> {
        // Use try_lock for non-async contexts
        if let Ok(guard) = self.watched_dirs.try_lock() {
            return guard.clone();
        }
        // Fallback: read from disk
        Self::read_watch_dirs_sync()
    }

    /// Total number of files in registry.
    pub fn total_files(&self) -> usize {
        self.registry.len()
    }

    /// Validate that a resolved path falls under one of the watched directories.
    pub fn is_valid_path(&self, path: &str) -> bool {
        let resolved = match std::fs::canonicalize(path) {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => path.to_string(),
        };
        let dirs = self.get_watched_dirs();
        dirs.iter().any(|d| {
            let canon_dir = std::fs::canonicalize(d)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| d.clone());
            resolved.starts_with(&canon_dir)
        })
    }

    /// Check whether the registry contains a path.
    pub fn contains(&self, path: &str) -> bool {
        self.registry.contains_key(path)
    }

    /// Insert or update a file entry.
    pub fn upsert(&self, entry: FileEntry) {
        self.registry.insert(entry.path.clone(), entry);
    }

    /// Remove a file entry by path.
    pub fn remove(&self, path: &str) {
        self.registry.remove(path);
    }

    // -----------------------------------------------------------------------
    // Dynamic watch management
    // -----------------------------------------------------------------------

    /// Add a directory to be watched. Scans it immediately and starts
    /// watching for changes.
    pub async fn add_watch_dir(&self, dir_path: String) {
        {
            let mut dirs = self.watched_dirs.lock().await;
            if dirs.contains(&dir_path) {
                return;
            }
            dirs.push(dir_path.clone());
        }

        // Scan the new directory
        let ctx = load_filter_context_async(&self.app_handle).await;
        let registry = self.registry.clone();
        let dir = dir_path.clone();
        tokio::task::spawn_blocking(move || {
            scan_directory_sync(&registry, &dir, &ctx);
        })
        .await
        .ok();

        // Add to the notify watcher
        let mut watcher_guard = self.watcher.lock().await;
        if let Some(ref mut debouncer) = *watcher_guard {
            let _ = debouncer.watch(Path::new(&dir_path), RecursiveMode::Recursive);
        }

        // Emit event so frontend knows about the new files
        let count = self.registry.len() as u32;
        let _ = self.app_handle.emit(
            "file-event",
            serde_json::json!({
                "type": "scan-complete",
                "count": count,
            }),
        );
    }

    /// Remove a directory from being watched. Removes all its files from
    /// the registry and emits removal events.
    pub async fn remove_watch_dir(&self, dir_path: String) {
        {
            let mut dirs = self.watched_dirs.lock().await;
            dirs.retain(|d| d != &dir_path);
        }

        // Unwatch from notify
        let mut watcher_guard = self.watcher.lock().await;
        if let Some(ref mut debouncer) = *watcher_guard {
            let _ = debouncer.unwatch(Path::new(&dir_path));
        }

        // Remove all files under this directory from registry
        let to_remove: Vec<String> = self
            .registry
            .iter()
            .filter(|r| r.value().path.starts_with(&dir_path))
            .map(|r| r.key().clone())
            .collect();

        for path in &to_remove {
            self.registry.remove(path);
            let _ = self.app_handle.emit(
                "file-event",
                serde_json::json!({
                    "type": "file-removed",
                    "path": path,
                }),
            );
        }
    }

    /// Re-scan all watched directories. Called after filter changes.
    pub async fn refresh(&self) {
        self.registry.clear();

        let dirs = self.watched_dirs.lock().await.clone();
        let ctx = load_filter_context_async(&self.app_handle).await;

        let registry = self.registry.clone();
        let dirs_clone = dirs.clone();
        tokio::task::spawn_blocking(move || {
            for dir in &dirs_clone {
                scan_directory_sync(&registry, dir, &ctx);
            }
        })
        .await
        .ok();

        let count = self.registry.len() as u32;
        let _ = self.app_handle.emit(
            "file-event",
            serde_json::json!({
                "type": "scan-complete",
                "count": count,
            }),
        );
    }

    // -----------------------------------------------------------------------
    // Static helpers for path derivation
    // -----------------------------------------------------------------------

    /// Derive the project name from a file path relative to the watch dirs.
    pub fn project_for_path(path: &str, watched_dirs: &[String]) -> String {
        for dir in watched_dirs {
            let prefix = if dir.ends_with('/') {
                dir.clone()
            } else {
                format!("{}/", dir)
            };
            if path.starts_with(&prefix) {
                let rel = &path[prefix.len()..];
                if let Some(first_seg) = rel.split('/').next() {
                    return first_seg.to_string();
                }
            }
        }
        String::new()
    }

    /// Derive the relative path from a file path relative to the deepest watch dir.
    pub fn relative_path_for(path: &str, watched_dirs: &[String]) -> String {
        let mut best: Option<&str> = None;
        for dir in watched_dirs {
            if path.starts_with(dir.as_str()) {
                if best.map_or(true, |b| dir.len() > b.len()) {
                    best = Some(dir.as_str());
                }
            }
        }
        if let Some(base) = best {
            let trimmed = base.trim_end_matches('/');
            if path.len() > trimmed.len() + 1 {
                return path[trimmed.len() + 1..].to_string();
            }
        }
        path.to_string()
    }
}

// ---------------------------------------------------------------------------
// FilterContext — snapshot of filter settings for a scan pass
// ---------------------------------------------------------------------------

#[derive(Clone)]
struct FilterContext {
    active_presets: Vec<crate::types::FilterPresetId>,
    user_filters: crate::types::FilterConfig,
    min_size: u64,
    excluded_folders: Vec<String>,
}

// ---------------------------------------------------------------------------
// Async helper — block on a future from a sync context
// ---------------------------------------------------------------------------

/// Run an async future from a synchronous context.
///
/// If a tokio runtime is active on this thread, uses `block_in_place` +
/// `block_on` (requires multi-threaded runtime).  Otherwise, creates a
/// throwaway single-threaded runtime.
fn run_async<F: std::future::Future>(f: F) -> F::Output {
    match tokio::runtime::Handle::try_current() {
        Ok(rt) => tokio::task::block_in_place(|| rt.block_on(f)),
        Err(_) => {
            let rt = tokio::runtime::Runtime::new().expect("Failed to create runtime");
            rt.block_on(f)
        }
    }
}

// ---------------------------------------------------------------------------
// FileEntry builder
// ---------------------------------------------------------------------------

/// Build a FileEntry from a file path and its watch root.
fn build_file_entry(path: &Path, watch_root: &Path) -> Option<FileEntry> {
    let metadata = fs::metadata(path).ok()?;
    let modified_at = metadata
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;
    let size = metadata.len();

    let content_hash = compute_content_hash(path).unwrap_or_default();

    // Line count
    let line_count = fs::read_to_string(path)
        .ok()
        .map(|c| c.lines().count() as u32);

    let abs_str = path.to_string_lossy().to_string();

    // Relative path from watch root
    let relative_path = path
        .strip_prefix(watch_root)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| abs_str.clone());

    // Project name = first path component of relative path
    let project = relative_path
        .split(std::path::MAIN_SEPARATOR)
        .next()
        .unwrap_or("unknown")
        .to_string();

    // Display name = filename without .md extension
    let name = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    Some(FileEntry {
        path: abs_str,
        name,
        project,
        relative_path,
        modified_at,
        size,
        content_hash,
        line_count,
    })
}

// ---------------------------------------------------------------------------
// Directory scanning
// ---------------------------------------------------------------------------

/// Synchronous recursive scan of a directory, adding matching .md files to the registry.
fn scan_directory_sync(registry: &DashMap<String, FileEntry>, dir: &str, ctx: &FilterContext) {
    let root = PathBuf::from(dir);
    if !root.exists() || !root.is_dir() {
        return;
    }
    walk_dir(&root, &root, ctx, registry);
}

fn walk_dir(current: &Path, root: &Path, ctx: &FilterContext, registry: &DashMap<String, FileEntry>) {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if path.is_dir() {
            // Skip hidden directories (except .claude and .rvry)
            if name_str.starts_with('.') {
                if name_str.as_ref() != ".claude" && name_str.as_ref() != ".rvry" {
                    continue;
                }
            }

            // Skip ignored directory names
            if IGNORED_DIRS.contains(&name_str.as_ref()) {
                continue;
            }

            walk_dir(&path, root, ctx, registry);
            continue;
        }

        // Only process .md files
        if !name_str.ends_with(".md") {
            continue;
        }

        let abs_path = path.to_string_lossy().to_string();
        let filename = name_str.to_string();
        let file_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        if !filters::should_include_file(
            &abs_path,
            &filename,
            &ctx.active_presets,
            &ctx.user_filters,
            ctx.min_size,
            file_size,
            &ctx.excluded_folders,
        ) {
            continue;
        }

        if let Some(fe) = build_file_entry(&path, root) {
            registry.insert(abs_path, fe);
        }
    }
}

// ---------------------------------------------------------------------------
// Filter context loaders
// ---------------------------------------------------------------------------

fn load_filter_context_sync(_handle: &AppHandle) -> FilterContext {
    // Read state directly from disk to avoid async runtime issues during setup
    let state = read_state_sync();
    FilterContext {
        active_presets: state.preferences.active_presets,
        user_filters: state.filters,
        min_size: state.preferences.min_file_length.unwrap_or(0),
        excluded_folders: state.excluded_folders,
    }
}

/// Read state.json synchronously (no async runtime needed)
fn read_state_sync() -> crate::types::AppState {
    let path = dirs::home_dir()
        .unwrap_or_default()
        .join(".markscout")
        .join("state.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(state) = serde_json::from_str::<crate::types::AppState>(&data) {
            return state;
        }
    }
    // Return defaults if file doesn't exist or is invalid
    crate::types::AppState {
        version: 2,
        instance_id: String::new(),
        last_synced_at: None,
        favorites: vec![],
        favorite_folders: vec![],
        history: vec![],
        filters: crate::types::FilterConfig {
            excluded_paths: vec![],
            excluded_names: vec![],
        },
        preferences: crate::types::PreferencesState {
            active_presets: vec![],
            watch_dirs: vec![],
            min_file_length: Some(0),
        },
        ui: crate::types::UiState {
            sidebar_view: crate::types::SidebarView::Recents,
            sidebar_width: 280.0,
            sidebar_collapsed: false,
            last_selected_path: None,
            collapsed_groups: vec![],
            expanded_groups: vec![],
            zoom_level: 1.0,
            fill_screen: false,
            content_search: false,
            scroll_positions: std::collections::HashMap::new(),
        },
        excluded_folders: vec![],
        last_session_at: None,
    }
}

async fn load_filter_context_async(handle: &AppHandle) -> FilterContext {
    let state_mgr: tauri::State<'_, AppStateManager> = handle.state();
    let prefs = state_mgr.get_preferences().await;
    let filters = state_mgr.get_filters().await;
    FilterContext {
        active_presets: prefs.active_presets,
        user_filters: filters,
        min_size: prefs.min_file_length.unwrap_or(0),
        excluded_folders: vec![],
    }
}

fn reconcile_sync(_handle: &AppHandle, _registry: &Arc<DashMap<String, FileEntry>>) {
    // Move tracking reconciliation is deferred to after the async runtime is available.
    // The frontend will trigger this via the session start command.
}

// ---------------------------------------------------------------------------
// Notify watcher (runs on a dedicated thread)
// ---------------------------------------------------------------------------

/// Start the notify debouncer on a blocking thread. This function blocks
/// indefinitely to keep the watcher alive.
fn start_notify_watcher_blocking(
    registry: Arc<DashMap<String, FileEntry>>,
    app_handle: AppHandle,
    watch_dirs: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let registry_clone = registry.clone();
    let app_clone = app_handle.clone();

    let mut debouncer = new_debouncer(
        std::time::Duration::from_millis(100),
        None,
        move |result: DebounceEventResult| {
            match result {
                Ok(events) => {
                    handle_debounced_events(&events, &registry_clone, &app_clone);
                }
                Err(errors) => {
                    for e in errors {
                        log::error!("[MarkScout] Watcher error: {:?}", e);
                    }
                }
            }
        },
    )?;

    for dir in &watch_dirs {
        let p = Path::new(dir);
        if p.exists() {
            debouncer.watch(p, RecursiveMode::Recursive)?;
        }
    }

    // Store the debouncer in the FileWatcher so add/remove_watch_dir can use it.
    let fw: tauri::State<'_, FileWatcher> = app_handle.state();
    run_async(async {
        let mut guard = fw.watcher.lock().await;
        *guard = Some(debouncer);
    });

    // Periodic re-scan: every 30s, walk the watched dirs and reconcile
    // with the registry. This catches files/dirs that FSEvents missed
    // (common on macOS when new subdirectories are created after watch start).
    let rescan_registry = registry.clone();
    let rescan_app = app_handle.clone();
    let rescan_dirs = watch_dirs.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            periodic_rescan(&rescan_registry, &rescan_app, &rescan_dirs);
        }
    });

    // Park this thread forever so the debouncer stays alive
    loop {
        std::thread::park();
    }
}

// ---------------------------------------------------------------------------
// Periodic re-scan (safety net for missed FSEvents)
// ---------------------------------------------------------------------------

/// Lightweight re-scan: walk all watched dirs, find files not in registry
/// (additions) and registry entries whose files no longer exist (removals).
/// Only builds full FileEntry for genuinely new files to keep CPU low.
fn periodic_rescan(
    registry: &DashMap<String, FileEntry>,
    app_handle: &AppHandle,
    watch_dirs: &[String],
) {
    let ctx = load_filter_context_sync(app_handle);
    let mut found_paths = std::collections::HashSet::new();

    for dir in watch_dirs {
        let root = PathBuf::from(dir);
        if !root.exists() || !root.is_dir() {
            continue;
        }
        collect_paths(&root, &root, &ctx, &mut found_paths);
    }

    // Additions: paths on disk but not in registry
    let mut added = 0u32;
    for abs_path in &found_paths {
        if !registry.contains_key(abs_path) {
            let path = Path::new(abs_path);
            // Determine the watch root
            let watch_root = watch_dirs
                .iter()
                .find(|d| abs_path.starts_with(d.as_str()))
                .map(|d| PathBuf::from(d))
                .unwrap_or_else(|| path.parent().unwrap_or(Path::new("/")).to_path_buf());

            if let Some(entry) = build_file_entry(path, &watch_root) {
                registry.insert(abs_path.clone(), entry.clone());
                let _ = app_handle.emit(
                    "file-event",
                    serde_json::json!({
                        "type": "file-added",
                        "file": entry,
                    }),
                );
                added += 1;
            }
        }
    }

    // Removals: paths in registry but no longer on disk
    let mut removed = 0u32;
    let stale: Vec<String> = registry
        .iter()
        .filter(|r| !Path::new(r.key()).exists())
        .map(|r| r.key().clone())
        .collect();
    for path in &stale {
        registry.remove(path);
        let _ = app_handle.emit(
            "file-event",
            serde_json::json!({
                "type": "file-removed",
                "path": path,
            }),
        );
        removed += 1;
    }

    if added > 0 || removed > 0 {
        log::info!(
            "[MarkScout] Periodic rescan: +{} added, -{} removed (registry: {})",
            added,
            removed,
            registry.len()
        );
    }
}

/// Fast recursive walk that only collects absolute paths of eligible .md files
/// (no content hash, no line count). Used by periodic_rescan.
fn collect_paths(
    current: &Path,
    root: &Path,
    ctx: &FilterContext,
    out: &mut std::collections::HashSet<String>,
) {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let name_str = file_name.to_string_lossy();

        if path.is_dir() {
            if name_str.starts_with('.') {
                if name_str.as_ref() != ".claude" && name_str.as_ref() != ".rvry" {
                    continue;
                }
            }
            if IGNORED_DIRS.contains(&name_str.as_ref()) {
                continue;
            }
            collect_paths(&path, root, ctx, out);
            continue;
        }

        if !name_str.ends_with(".md") {
            continue;
        }

        let abs_path = path.to_string_lossy().to_string();
        let filename = name_str.to_string();
        let file_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

        if filters::should_include_file(
            &abs_path,
            &filename,
            &ctx.active_presets,
            &ctx.user_filters,
            ctx.min_size,
            file_size,
            &ctx.excluded_folders,
        ) {
            out.insert(abs_path);
        }
    }
}

/// Process a batch of debounced file system events.
fn handle_debounced_events(
    events: &[DebouncedEvent],
    registry: &DashMap<String, FileEntry>,
    app_handle: &AppHandle,
) {
    let ctx = load_filter_context_sync(app_handle);

    for event in events {
        use notify::EventKind;

        for path in &event.paths {
            let path_str = path.to_string_lossy().to_string();

            match &event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    if !path_str.ends_with(".md") {
                        continue;
                    }

                    // File may have been deleted between event and processing
                    if !path.exists() {
                        continue;
                    }

                    let filename = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let file_size = fs::metadata(path).map(|m| m.len()).unwrap_or(0);

                    if !filters::should_include_file(
                        &path_str,
                        &filename,
                        &ctx.active_presets,
                        &ctx.user_filters,
                        ctx.min_size,
                        file_size,
                        &ctx.excluded_folders,
                    ) {
                        // If file was previously tracked but now excluded, remove it
                        if registry.contains_key(&path_str) {
                            registry.remove(&path_str);
                            let _ = app_handle.emit(
                                "file-event",
                                serde_json::json!({
                                    "type": "file-removed",
                                    "path": path_str,
                                }),
                            );
                        }
                        continue;
                    }

                    // Find the watch root for this file
                    let watch_root = find_watch_root(app_handle, &path_str);

                    if let Some(entry) = build_file_entry(path, &watch_root) {
                        let is_new = !registry.contains_key(&path_str);
                        let event_type = if is_new { "file-added" } else { "file-changed" };

                        registry.insert(path_str.clone(), entry.clone());

                        // Live move tracking for new files
                        if is_new {
                            let state_mgr: tauri::State<'_, AppStateManager> = app_handle.state();
                            let hash = entry.content_hash.clone();
                            let p = path_str.clone();
                            let reg_ref = registry.clone();
                            let _ = run_async(async {
                                state_mgr
                                    .check_live_move(&p, &hash, |check_path| {
                                        reg_ref.contains_key(check_path)
                                    })
                                    .await
                            });
                        }

                        let _ = app_handle.emit(
                            "file-event",
                            serde_json::json!({
                                "type": event_type,
                                "file": entry,
                            }),
                        );
                    }
                }

                EventKind::Remove(_) => {
                    if registry.contains_key(&path_str) {
                        registry.remove(&path_str);
                        let _ = app_handle.emit(
                            "file-event",
                            serde_json::json!({
                                "type": "file-removed",
                                "path": path_str,
                            }),
                        );
                    }
                }

                _ => {}
            }
        }
    }
}

/// Find the watch root directory for a given file path.
fn find_watch_root(app_handle: &AppHandle, file_path: &str) -> PathBuf {
    let fw: tauri::State<'_, FileWatcher> = app_handle.state();
    let dirs = fw.get_watched_dirs();

    for dir in &dirs {
        if file_path.starts_with(dir.as_str()) {
            return PathBuf::from(dir);
        }
    }

    // Fallback: use parent directory
    Path::new(file_path)
        .parent()
        .unwrap_or(Path::new("/"))
        .to_path_buf()
}

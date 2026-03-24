// MarkScout — Tauri invoke() wrappers
// Typed API layer that replaces all fetch('/api/...') calls from the Next.js version.

import { invoke } from '@tauri-apps/api/core';
import type {
  FileEntry,
  FolderNode,
  FileContentResponse,
  SearchResult,
  FavoriteEntry,
  HistoryEntry,
  FilterConfig,
  FilterPresetId,
  PreferencesResponse,
  SidebarView,
  WhatsNewResponse,
  SmartCollection,
  FileLink,
} from './types';

// ---------------------------------------------------------------------------
// Response envelopes (matching Rust serde output)
// ---------------------------------------------------------------------------

export interface FilesResponse {
  files: FileEntry[] | null;
  folders: FolderNode[] | null;
  scanComplete: boolean;
  totalFiles: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export interface UiStateResponse {
  sidebarView: SidebarView;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  lastSelectedPath: string | null;
  collapsedGroups: string[];
  expandedGroups: string[];
  zoomLevel: number;
  fillScreen: boolean;
  contentSearch: boolean;
  favorites: FavoriteEntry[];
  favoriteFolders: string[];
  history: HistoryEntry[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string;
  currentVersion: string;
}

// ---------------------------------------------------------------------------
// save_ui_state accepts individual optional fields (not a JSON string)
// ---------------------------------------------------------------------------

export interface SaveUiStateParams {
  sidebarView?: SidebarView;
  sidebarWidth?: number;
  sidebarCollapsed?: boolean;
  lastSelectedPath?: string;
  collapsedGroups?: string[];
  expandedGroups?: string[];
  zoomLevel?: number;
  fillScreen?: boolean;
  contentSearch?: boolean;
}

// ---------------------------------------------------------------------------
// API object — one method per Tauri command
// ---------------------------------------------------------------------------

export const api = {
  // --- Files ---
  getFiles: (view?: string) =>
    invoke<FilesResponse>('get_files', { view }),

  getFileContent: (path: string) =>
    invoke<FileContentResponse>('get_file_content', { path }),

  // --- Search ---
  searchFiles: (query: string, limit?: number) =>
    invoke<SearchResponse>('search_files', { query, limit }),

  // --- UI State ---
  getUiState: () =>
    invoke<UiStateResponse>('get_ui_state'),

  saveUiState: (params: SaveUiStateParams) =>
    invoke<void>('save_ui_state', params as Record<string, unknown>),

  // --- Favorites & History ---
  toggleFavorite: (path: string, contentHash: string) =>
    invoke<boolean>('toggle_favorite', { path, contentHash }),

  toggleFolderStar: (path: string) =>
    invoke<boolean>('toggle_folder_star', { path }),

  recordHistory: (path: string, contentHash: string) =>
    invoke<void>('record_history', { path, contentHash }),

  getHistory: () =>
    invoke<HistoryEntry[]>('get_history'),

  // --- Preferences ---
  getPreferences: () =>
    invoke<PreferencesResponse>('get_preferences'),

  togglePreset: (presetId: FilterPresetId) =>
    invoke<{ active: boolean }>('toggle_preset', { presetId }),

  addWatchDir: (path: string) =>
    invoke<void>('add_watch_dir', { path }),

  removeWatchDir: (path: string) =>
    invoke<void>('remove_watch_dir', { path }),

  setMinFileLength: (bytes: number) =>
    invoke<void>('set_min_file_length', { bytes }),

  // --- Filters ---
  updateFilter: (action: string, path: string) =>
    invoke<void>('update_filter', { action, path }),

  getFilters: () =>
    invoke<FilterConfig>('get_filters'),

  // --- System ---
  revealInFinder: (path: string) =>
    invoke<void>('reveal_in_finder', { path }),

  checkForUpdate: () =>
    invoke<UpdateCheckResult>('check_for_update'),

  openExternal: (url: string) =>
    invoke<void>('open_external', { url }),

  // --- v0.5: Session Intelligence ---
  getWhatsNew: () =>
    invoke<WhatsNewResponse>('get_whats_new'),

  recordSessionStart: () =>
    invoke<{ previousSessionAt: number | null }>('record_session_start'),

  // --- v0.6: Smart Collections ---
  getCollections: () =>
    invoke<SmartCollection[]>('get_collections'),

  getFileLinks: (path: string) =>
    invoke<FileLink[]>('get_file_links', { path }),
};

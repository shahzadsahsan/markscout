// MarkScout — Core Types (Tauri frontend)

export type SidebarView = 'recents' | 'favorites';

export interface FileEntry {
  path: string;           // Absolute file path
  name: string;           // Filename without .md extension
  project: string;        // First directory segment after watched root
  relativePath: string;   // Path relative to watched root (for breadcrumb)
  modifiedAt: number;     // mtime as epoch ms
  size: number;           // File size in bytes
  contentHash: string;    // SHA-256 of first 1KB + size (for move tracking)
  lineCount?: number;     // Number of lines in the file
}

export interface FavoriteEntry {
  path: string;
  contentHash: string;
  starredAt: number;      // Epoch ms — sort order + conflict resolution
}

export interface HistoryEntry {
  path: string;
  contentHash: string;
  lastOpenedAt: number;   // Epoch ms
  viewCount?: number;     // v0.7: how many times opened
}

export interface FilterConfig {
  excludedPaths: string[];   // User-added path globs
  excludedNames: string[];   // User-added filename regex strings
}

// Filter presets — toggleable categories
export type FilterPresetId =
  | 'readme-files'
  | 'license-files'
  | 'changelog-files'
  | 'dotfile-configs'
  | 'claude-plugins'
  | 'claude-skills'
  | 'claude-sessions'
  | 'claude-pipeline'
  | 'claude-memory'
  | 'claude-plans'
  | 'claude-cognition';

export interface FilterPreset {
  id: FilterPresetId;
  label: string;
  description: string;
  matchCount?: number;
  pathPatterns: string[];
  namePatterns: string[];
}

export interface PreferencesState {
  activePresets: FilterPresetId[];
  watchDirs: string[];
  minFileLength?: number;
}

export interface PresetInfo {
  id: FilterPresetId;
  label: string;
  description: string;
  category: string;
  active: boolean;
  matchCount: number;
}

export interface PreferencesResponse {
  presets: PresetInfo[];
  customWatchDirs: string[];
  minFileLength?: number;
  excludedFolders: string[];
}

export interface AppState {
  version: 2;
  instanceId: string;
  lastSyncedAt: number | null;

  favorites: FavoriteEntry[];
  favoriteFolders: string[];
  history: HistoryEntry[];

  filters: FilterConfig;
  preferences: PreferencesState;

  ui: {
    sidebarView: SidebarView;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
    lastSelectedPath: string | null;
    collapsedGroups: string[];
    expandedGroups: string[];
    zoomLevel: number;
    fillScreen: boolean;
    contentSearch: boolean;
  };
}

// Tauri event types (emitted via app_handle.emit("file-event", ...))
export interface TauriFileEvent {
  type: 'file-added' | 'file-changed';
  data: FileEntry;
}

export interface TauriRemoveEvent {
  type: 'file-removed';
  data: { path: string };
}

export interface TauriScanCompleteEvent {
  type: 'scan-complete';
  data: { totalFiles: number; filteredCount: number };
}

export type TauriEvent = TauriFileEvent | TauriRemoveEvent | TauriScanCompleteEvent;

// Search result type
export interface SearchResult {
  file: FileEntry;
  snippet: string;
  matchCount: number;
  lineNumber: number;
}

// API response types
export interface FileContentResponse {
  path: string;
  content: string;
  name: string;
  project: string;
  relativePath: string;
  modifiedAt: number;
  size: number;
  wordCount: number;
  readingTime: number;
  isFavorite: boolean;
  contentHash: string;
}

export interface FolderNode {
  name: string;
  path: string;
  files: FileEntry[];
  children: FolderNode[];
  fileCount: number;
}

// v0.5 — Session Intelligence
export interface ProjectGroup {
  project: string;
  files: FileEntry[];
}

export interface WhatsNewResponse {
  lastSessionAt: number | null;
  newFiles: ProjectGroup[];
  updatedFiles: ProjectGroup[];
  totalChanges: number;
}

// v0.6 — Smart Collections
export interface SmartCollection {
  id: string;
  label: string;
  icon: string;
  files: FileEntry[];
  count: number;
}

export interface FileLink {
  targetPath: string;
  targetName: string;
  linkText: string;
  lineNumber: number;
}

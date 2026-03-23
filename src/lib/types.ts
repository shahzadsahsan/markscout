// MarkScout — Core Types

export type SidebarView = 'recents' | 'folders' | 'favorites';

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
}

export interface FilterConfig {
  excludedPaths: string[];   // User-added path globs
  excludedNames: string[];   // User-added filename regex strings
}

// Filter presets — toggleable categories
// Generic presets (useful for any developer)
// Claude Code presets (for Claude Code users)
export type FilterPresetId =
  | 'readme-files'        // README.md files
  | 'license-files'       // LICENSE, CONTRIBUTING
  | 'changelog-files'     // CHANGELOG, CHANGES
  | 'dotfile-configs'     // .github/*.md
  | 'claude-plugins'      // Plugin/agent docs
  | 'claude-skills'       // SKILL.md files
  | 'claude-sessions'     // RVRY/deepthink sessions
  | 'claude-pipeline'     // GSD pipeline artifacts
  | 'claude-memory'       // Project memory files
  | 'claude-plans'        // Plan files
  | 'claude-cognition';   // Scheduled tasks, cognition

export interface FilterPreset {
  id: FilterPresetId;
  label: string;
  description: string;
  matchCount?: number;       // Populated at runtime
  pathPatterns: string[];    // Path substring matches
  namePatterns: string[];    // Filename regex patterns
}

export interface PreferencesState {
  activePresets: FilterPresetId[];  // Which presets are enabled (filtering out)
  watchDirs: string[];               // User-added watch directories
  minFileLength?: number;            // Hide files shorter than this many bytes (0 = disabled)
}

export interface AppState {
  version: 2;
  instanceId: string;           // UUID per machine
  lastSyncedAt: number | null;

  favorites: FavoriteEntry[];
  favoriteFolders: string[];       // Folder paths starred by user (sorted to top)
  history: HistoryEntry[];

  filters: FilterConfig;
  preferences: PreferencesState;

  ui: {
    sidebarView: SidebarView;
    sidebarWidth: number;
    sidebarCollapsed: boolean;
    lastSelectedPath: string | null;
    collapsedGroups: string[];     // Folder paths that are collapsed (all start collapsed)
    expandedGroups: string[];      // Folder paths user has expanded (persisted)
    zoomLevel: number;             // Text magnification (0.85, 1, 1.25, 1.5, 2)
    fillScreen: boolean;           // Expand prose to fill screen width
  };
}

// SSE event types
export type SSEEventType = 'file-added' | 'file-changed' | 'file-removed' | 'scan-complete';

export interface SSEFileEvent {
  type: 'file-added' | 'file-changed';
  data: FileEntry;
}

export interface SSERemoveEvent {
  type: 'file-removed';
  data: { path: string };
}

export interface SSEScanCompleteEvent {
  type: 'scan-complete';
  data: { totalFiles: number; filteredCount: number };
}

export type SSEEvent = SSEFileEvent | SSERemoveEvent | SSEScanCompleteEvent;

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
  readingTime: number;    // Minutes
  isFavorite: boolean;
}

export interface FolderNode {
  name: string;
  path: string;           // Full path to this folder
  files: FileEntry[];
  children: FolderNode[];
  fileCount: number;      // Total files in this subtree
}

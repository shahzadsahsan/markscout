// MarkReader — Core Types

export type SidebarView = 'recents' | 'folders' | 'favorites' | 'history';

export interface FileEntry {
  path: string;           // Absolute file path
  name: string;           // Filename without .md extension
  project: string;        // First directory segment after watched root
  relativePath: string;   // Path relative to watched root (for breadcrumb)
  modifiedAt: number;     // mtime as epoch ms
  size: number;           // File size in bytes
  contentHash: string;    // SHA-256 of first 1KB + size (for move tracking)
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

// Filter presets — toggleable categories seeded from real file analysis
export type FilterPresetId =
  | 'claude-skills'      // SKILL.md files in .claude/ (67 files)
  | 'claude-plugins'     // Plugin/agent reference docs (345 files)
  | 'claude-memory'      // Project memory files (29 files)
  | 'claude-plans'       // Plan files in .claude/plans/ (24 files)
  | 'claude-requirements' // Requirements pipeline artifacts (8 files)
  | 'rvry-sessions'      // .rvry/sessions/ deepthink logs (53 files)
  | 'gsd-pipeline'       // .planning/ pipeline artifacts (50 files)
  | 'readme-files'       // README.md across all projects (61 files)
  | 'agents-md'          // AGENTS.md files from Next.js scaffold
  | 'claude-cognition';  // Scheduled tasks, cognition sessions

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

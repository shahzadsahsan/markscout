// MarkScout — State Persistence
// Reads/writes ~/.markscout/state.json with atomic writes and a write queue.

import { readFile, writeFile, mkdir, rename, access } from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';
import type { AppState, FavoriteEntry, HistoryEntry, SidebarView, FileEntry, FilterPresetId, PreferencesState } from './types';
import { DEFAULT_ACTIVE_PRESETS } from './presets';

const STATE_DIR = path.join(os.homedir(), '.markscout');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const STATE_TMP = path.join(STATE_DIR, 'state.json.tmp');
const HISTORY_LIMIT = 50;

// --- Write queue (mitigation #2: prevents concurrent write races) ---
let writePromise: Promise<void> = Promise.resolve();

function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  writePromise = writePromise.then(fn, fn);
  return writePromise;
}

// --- First-run detection ---
let firstRunDetected = false;

export function isFirstRun(): boolean {
  return firstRunDetected;
}

// --- State cache ---
let cachedState: AppState | null = null;

function defaultState(): AppState {
  return {
    version: 2,
    instanceId: randomUUID(),
    lastSyncedAt: null,
    favorites: [],
    favoriteFolders: [],
    history: [],
    filters: {
      excludedPaths: [],
      excludedNames: [],
    },
    preferences: {
      activePresets: [...DEFAULT_ACTIVE_PRESETS],
      watchDirs: [],
      minFileLength: 0,
    },
    ui: {
      sidebarView: 'recents',
      sidebarWidth: 280,
      sidebarCollapsed: false,
      lastSelectedPath: null,
      collapsedGroups: [],
      expandedGroups: [],
      zoomLevel: 1,
      fillScreen: false,
    },
  };
}

/**
 * Load state from disk. Creates default state on first run.
 */
export async function loadState(): Promise<AppState> {
  if (cachedState) return cachedState;

  try {
    await access(STATE_FILE);
    const raw = await readFile(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as AppState;
    // Version check — migrate if needed in the future
    if (parsed.version !== 2) {
      cachedState = defaultState();
    } else {
      // Migrate: add V2 fields if missing from older state files
      if (!parsed.favoriteFolders) parsed.favoriteFolders = [];
      if (!parsed.ui.expandedGroups) parsed.ui.expandedGroups = [];
      if (parsed.ui.sidebarCollapsed === undefined) parsed.ui.sidebarCollapsed = false;
      if (!parsed.preferences) {
        parsed.preferences = {
          activePresets: [...DEFAULT_ACTIVE_PRESETS],
          watchDirs: [],
        };
      }
      if (!parsed.preferences.watchDirs) parsed.preferences.watchDirs = [];
      if (!parsed.preferences.activePresets) parsed.preferences.activePresets = [...DEFAULT_ACTIVE_PRESETS];
      if (parsed.preferences.minFileLength === undefined) parsed.preferences.minFileLength = 0;
      if (parsed.ui.zoomLevel === undefined) parsed.ui.zoomLevel = 1;
      if (parsed.ui.fillScreen === undefined) parsed.ui.fillScreen = false;
      cachedState = parsed;
    }
  } catch {
    // File doesn't exist or is corrupted — create default
    firstRunDetected = true;
    cachedState = defaultState();
    await ensureDir();
    await atomicWrite(cachedState);
  }

  return cachedState;
}

/**
 * Save state to disk with atomic write (write tmp, rename).
 */
async function atomicWrite(state: AppState): Promise<void> {
  await ensureDir();
  await writeFile(STATE_TMP, JSON.stringify(state, null, 2), 'utf-8');
  await rename(STATE_TMP, STATE_FILE);
}

async function ensureDir(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
}

async function saveState(): Promise<void> {
  if (!cachedState) return;
  await atomicWrite(cachedState);
}

// --- Favorites ---

export async function toggleFavorite(filePath: string, contentHash: string): Promise<boolean> {
  const state = await loadState();
  const idx = state.favorites.findIndex(f => f.path === filePath);

  if (idx >= 0) {
    state.favorites.splice(idx, 1);
    await enqueueWrite(saveState);
    return false; // Unstarred
  } else {
    state.favorites.push({
      path: filePath,
      contentHash,
      starredAt: Date.now(),
    });
    await enqueueWrite(saveState);
    return true; // Starred
  }
}

export async function getFavorites(): Promise<FavoriteEntry[]> {
  const state = await loadState();
  return [...state.favorites].sort((a, b) => b.starredAt - a.starredAt);
}

export async function isFavorite(filePath: string): Promise<boolean> {
  const state = await loadState();
  return state.favorites.some(f => f.path === filePath);
}

// --- History ---

export async function recordOpen(filePath: string, contentHash: string): Promise<void> {
  const state = await loadState();

  // Remove existing entry for this path (will re-add at top)
  state.history = state.history.filter(h => h.path !== filePath);

  // Add at beginning
  state.history.unshift({
    path: filePath,
    contentHash,
    lastOpenedAt: Date.now(),
  });

  // Trim to limit
  if (state.history.length > HISTORY_LIMIT) {
    state.history = state.history.slice(0, HISTORY_LIMIT);
  }

  await enqueueWrite(saveState);
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const state = await loadState();
  return [...state.history];
}

// --- UI State ---

export async function saveSidebarView(view: SidebarView): Promise<void> {
  const state = await loadState();
  state.ui.sidebarView = view;
  await enqueueWrite(saveState);
}

export async function saveSidebarWidth(width: number): Promise<void> {
  const state = await loadState();
  state.ui.sidebarWidth = width;
  await enqueueWrite(saveState);
}

export async function saveSidebarCollapsed(collapsed: boolean): Promise<void> {
  const state = await loadState();
  state.ui.sidebarCollapsed = collapsed;
  await enqueueWrite(saveState);
}

export async function saveLastSelectedPath(filePath: string | null): Promise<void> {
  const state = await loadState();
  state.ui.lastSelectedPath = filePath;
  await enqueueWrite(saveState);
}

export async function saveCollapsedGroups(groups: string[]): Promise<void> {
  const state = await loadState();
  state.ui.collapsedGroups = groups;
  await enqueueWrite(saveState);
}

export async function saveZoomLevel(zoomLevel: number): Promise<void> {
  const state = await loadState();
  state.ui.zoomLevel = zoomLevel;
  await enqueueWrite(saveState);
}

export async function saveFillScreen(fillScreen: boolean): Promise<void> {
  const state = await loadState();
  state.ui.fillScreen = fillScreen;
  await enqueueWrite(saveState);
}

export async function savePalette(palette: string): Promise<void> {
  const state = await loadState();
  (state.ui as Record<string, unknown>).palette = palette;
  await enqueueWrite(saveState);
}

export async function getUIState(): Promise<AppState['ui']> {
  const state = await loadState();
  return { ...state.ui };
}

// --- Favorite Folders ---

export async function toggleFavoriteFolder(folderPath: string): Promise<boolean> {
  const state = await loadState();
  const idx = state.favoriteFolders.indexOf(folderPath);
  if (idx >= 0) {
    state.favoriteFolders.splice(idx, 1);
    await enqueueWrite(saveState);
    return false;
  } else {
    state.favoriteFolders.push(folderPath);
    await enqueueWrite(saveState);
    return true;
  }
}

export async function getFavoriteFolders(): Promise<string[]> {
  const state = await loadState();
  return [...state.favoriteFolders];
}

// --- Expanded Groups (folders the user has opened) ---

export async function saveExpandedGroups(groups: string[]): Promise<void> {
  const state = await loadState();
  state.ui.expandedGroups = groups;
  await enqueueWrite(saveState);
}

export async function getExpandedGroups(): Promise<string[]> {
  const state = await loadState();
  return [...(state.ui.expandedGroups || [])];
}

// --- Exclude/Include Paths ---

export async function addExcludedPath(pathGlob: string): Promise<void> {
  const state = await loadState();
  if (!state.filters.excludedPaths.includes(pathGlob)) {
    state.filters.excludedPaths.push(pathGlob);
    await enqueueWrite(saveState);
  }
}

export async function removeExcludedPath(pathGlob: string): Promise<void> {
  const state = await loadState();
  state.filters.excludedPaths = state.filters.excludedPaths.filter(p => p !== pathGlob);
  await enqueueWrite(saveState);
}

export async function getExcludedPaths(): Promise<string[]> {
  const state = await loadState();
  return [...state.filters.excludedPaths];
}

// --- Filters ---

export async function getFilters(): Promise<AppState['filters']> {
  const state = await loadState();
  return { ...state.filters };
}

// --- Move Tracking ---

/**
 * On startup, validate favorite/history paths against the file registry.
 * If a path is gone but the contentHash exists at a new path, update it.
 */
export async function reconcilePaths(
  registry: Map<string, FileEntry>
): Promise<void> {
  const state = await loadState();
  let changed = false;

  // Build hash→path lookup from registry
  const hashToPath = new Map<string, string>();
  for (const [p, entry] of registry) {
    hashToPath.set(entry.contentHash, p);
  }

  // Reconcile favorites
  for (const fav of state.favorites) {
    if (!registry.has(fav.path)) {
      const newPath = hashToPath.get(fav.contentHash);
      if (newPath) {
        fav.path = newPath;
        changed = true;
      }
    }
  }

  // Reconcile history
  for (const hist of state.history) {
    if (!registry.has(hist.path)) {
      const newPath = hashToPath.get(hist.contentHash);
      if (newPath) {
        hist.path = newPath;
        changed = true;
      }
    }
  }

  if (changed) {
    await enqueueWrite(saveState);
  }
}

/**
 * Live move tracking (mitigation #4): check if a newly added file's hash
 * matches any favorite/history entry with a missing path.
 */
export async function checkLiveMove(
  newPath: string,
  contentHash: string,
  registryHas: (path: string) => boolean
): Promise<void> {
  const state = await loadState();
  let changed = false;

  for (const fav of state.favorites) {
    if (fav.contentHash === contentHash && fav.path !== newPath && !registryHas(fav.path)) {
      fav.path = newPath;
      changed = true;
    }
  }

  for (const hist of state.history) {
    if (hist.contentHash === contentHash && hist.path !== newPath && !registryHas(hist.path)) {
      hist.path = newPath;
      changed = true;
    }
  }

  if (changed) {
    await enqueueWrite(saveState);
  }
}

// --- Preferences (presets + watch dirs) ---

export async function getPreferences(): Promise<PreferencesState> {
  const state = await loadState();
  return { ...state.preferences };
}

export async function togglePreset(presetId: FilterPresetId): Promise<boolean> {
  const state = await loadState();
  const idx = state.preferences.activePresets.indexOf(presetId);
  if (idx >= 0) {
    state.preferences.activePresets.splice(idx, 1);
    await enqueueWrite(saveState);
    return false; // Deactivated
  } else {
    state.preferences.activePresets.push(presetId);
    await enqueueWrite(saveState);
    return true; // Activated
  }
}

export async function getActivePresets(): Promise<FilterPresetId[]> {
  const state = await loadState();
  return [...state.preferences.activePresets];
}

export async function addWatchDir(dirPath: string): Promise<void> {
  const state = await loadState();
  if (!state.preferences.watchDirs.includes(dirPath)) {
    state.preferences.watchDirs.push(dirPath);
    await enqueueWrite(saveState);
  }
}

export async function removeWatchDir(dirPath: string): Promise<void> {
  const state = await loadState();
  state.preferences.watchDirs = state.preferences.watchDirs.filter(d => d !== dirPath);
  await enqueueWrite(saveState);
}

export async function getWatchDirs(): Promise<string[]> {
  const state = await loadState();
  return [...state.preferences.watchDirs];
}

export async function getMinFileLength(): Promise<number> {
  const state = await loadState();
  return state.preferences.minFileLength ?? 0;
}

export async function saveMinFileLength(bytes: number): Promise<void> {
  const state = await loadState();
  state.preferences.minFileLength = bytes;
  enqueueWrite(saveState);
}

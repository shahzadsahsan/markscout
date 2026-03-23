// MarkScout — Chokidar File Watcher Singleton
// All shared state lives on globalThis to survive Next.js module isolation
// between instrumentation.ts and API route contexts (mitigation #1).

// Type-only import — erased at compile time, no Turbopack bundling
import type { FSWatcher } from 'chokidar';
import * as fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import type { FileEntry, SSEEvent, FilterConfig, FilterPresetId } from './types';
import { IGNORED_PATHS, isExcludedFile, isExcludedPath } from './filters';
import { matchesActivePreset } from './presets';
import type { Stats } from 'fs';
import { computeContentHash } from './hash';
import { getFilters, reconcilePaths, checkLiveMove, getActivePresets, getWatchDirs, getMinFileLength } from './state';

// Default watched directories — only include dirs that actually exist
function getDefaultWatchDirs(): string[] {
  const candidates = [
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), 'Documents'),
  ];
  return candidates.filter(dir => {
    try { return fs.existsSync(dir); } catch { return false; }
  });
}
const DEFAULT_WATCH_DIRS = getDefaultWatchDirs();

const DEBOUNCE_MS = 100;

// --- ALL shared state on globalThis ---
interface MarkScoutGlobal {
  __mrWatcher?: FSWatcher;
  __mrInitPromise?: Promise<void>;
  __mrRegistry: Map<string, FileEntry>;
  __mrSSEClients: Set<ReadableStreamDefaultController>;
  __mrScanComplete: boolean;
  __mrTotalScanned: number;
  __mrDebounceTimers: Map<string, NodeJS.Timeout>;
  __mrUserFilters?: FilterConfig;
  __mrActivePresets: FilterPresetId[];
  __mrWatchedDirs: string[];
  __mrMinFileLength: number;
}

const g = globalThis as unknown as MarkScoutGlobal;

// Initialize shared state containers (only if not already present)
if (!g.__mrRegistry) g.__mrRegistry = new Map();
if (!g.__mrSSEClients) g.__mrSSEClients = new Set();
if (g.__mrScanComplete === undefined) g.__mrScanComplete = false;
if (g.__mrTotalScanned === undefined) g.__mrTotalScanned = 0;
if (!g.__mrDebounceTimers) g.__mrDebounceTimers = new Map();
if (!g.__mrActivePresets) g.__mrActivePresets = [];
if (!g.__mrWatchedDirs) g.__mrWatchedDirs = [...DEFAULT_WATCH_DIRS];
if (g.__mrMinFileLength === undefined) g.__mrMinFileLength = 0;

function getProject(filePath: string): string {
  for (const dir of g.__mrWatchedDirs) {
    if (filePath.startsWith(dir)) {
      const relative = filePath.slice(dir.length + 1);
      const firstSlash = relative.indexOf(path.sep);
      if (firstSlash > 0) return relative.slice(0, firstSlash);
      return relative;
    }
  }
  return 'unknown';
}

function getRelativePath(filePath: string): string {
  for (const dir of g.__mrWatchedDirs) {
    if (filePath.startsWith(dir)) return filePath.slice(dir.length + 1);
  }
  return filePath;
}

async function buildFileEntry(filePath: string): Promise<FileEntry> {
  const fileStat = await stat(filePath);
  const contentHash = await computeContentHash(filePath);
  let lineCount: number | undefined;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    lineCount = content.split('\n').length;
  } catch { /* ignore unreadable files */ }
  return {
    path: filePath,
    name: path.basename(filePath, '.md'),
    project: getProject(filePath),
    relativePath: getRelativePath(filePath),
    modifiedAt: fileStat.mtimeMs,
    size: fileStat.size,
    contentHash,
    lineCount,
  };
}

function broadcast(event: SSEEvent): void {
  const data = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  const dead: ReadableStreamDefaultController[] = [];
  for (const controller of g.__mrSSEClients) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      dead.push(controller);
    }
  }
  for (const d of dead) g.__mrSSEClients.delete(d);
}

function handleFileEvent(filePath: string, eventType: 'add' | 'change'): void {
  const existing = g.__mrDebounceTimers.get(filePath);
  if (existing) clearTimeout(existing);

  g.__mrDebounceTimers.set(filePath, setTimeout(async () => {
    g.__mrDebounceTimers.delete(filePath);
    try {
      const filename = path.basename(filePath);
      if (isExcludedFile(filename, g.__mrUserFilters)) return;
      if (isExcludedPath(filePath, g.__mrUserFilters)) return;
      // Check preset filters
      if (matchesActivePreset(filePath, filename, g.__mrActivePresets)) return;

      // Check minimum file length filter
      if (g.__mrMinFileLength > 0) {
        try {
          const fileStat = fs.statSync(filePath);
          if (fileStat.size < g.__mrMinFileLength) return;
        } catch { return; }
      }

      const entry = await buildFileEntry(filePath);
      g.__mrRegistry.set(filePath, entry);

      if (eventType === 'add') {
        await checkLiveMove(entry.path, entry.contentHash, (p) => g.__mrRegistry.has(p));
      }

      const sseType = eventType === 'add' ? 'file-added' : 'file-changed';
      broadcast({ type: sseType, data: entry } as SSEEvent);
    } catch {
      // File deleted between event and processing
    }
  }, DEBOUNCE_MS));
}

function handleRemoveEvent(filePath: string): void {
  if (g.__mrRegistry.has(filePath)) {
    g.__mrRegistry.delete(filePath);
    broadcast({ type: 'file-removed', data: { path: filePath } });
  }
}

async function createWatcher(): Promise<FSWatcher> {
  const filters = await getFilters();
  g.__mrUserFilters = filters;

  // Load active presets, custom watch dirs, and min file length
  const activePresets = await getActivePresets();
  g.__mrActivePresets = activePresets;
  const customDirs = await getWatchDirs();
  g.__mrWatchedDirs = [...DEFAULT_WATCH_DIRS, ...customDirs];
  g.__mrMinFileLength = await getMinFileLength();

  const ignoredPatterns = IGNORED_PATHS.map(glob => {
    const pattern = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    return new RegExp(pattern);
  });

  // Load chokidar at runtime via require to avoid Turbopack's static analysis
  // and external module aliasing bug with serverExternalPackages.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { watch: chokidarWatch } = require('chokidar') as typeof import('chokidar');

  const watcher = chokidarWatch(g.__mrWatchedDirs, {
    ignored: (filePath: string, stats?: Stats) => {
      if (stats?.isFile() && !filePath.endsWith('.md')) return true;
      for (const re of ignoredPatterns) {
        if (re.test(filePath)) return true;
      }
      return false;
    },
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  watcher.on('add', (filePath: string) => {
    g.__mrTotalScanned++;
    handleFileEvent(filePath, 'add');
  });

  watcher.on('change', (filePath: string) => handleFileEvent(filePath, 'change'));
  watcher.on('unlink', (filePath: string) => handleRemoveEvent(filePath));
  watcher.on('error', (err: unknown) => console.error('[MarkScout] Watcher error:', err));

  watcher.on('ready', async () => {
    g.__mrScanComplete = true;
    await reconcilePaths(g.__mrRegistry);
    broadcast({
      type: 'scan-complete',
      data: { totalFiles: g.__mrRegistry.size, filteredCount: getFilteredCount() },
    });
  });

  return watcher;
}

// --- Public API (all reads from globalThis) ---

export async function initWatcher(): Promise<void> {
  if (g.__mrWatcher) return;
  if (g.__mrInitPromise) return g.__mrInitPromise;
  g.__mrInitPromise = (async () => {
    g.__mrWatcher = await createWatcher();
  })();
  return g.__mrInitPromise;
}

export function getFileRegistry(): Map<string, FileEntry> {
  return g.__mrRegistry;
}

export function isScanComplete(): boolean {
  return g.__mrScanComplete;
}

export function getFilteredCount(): number {
  return g.__mrTotalScanned - g.__mrRegistry.size;
}

export function addSSEClient(controller: ReadableStreamDefaultController): void {
  g.__mrSSEClients.add(controller);
}

export function removeSSEClient(controller: ReadableStreamDefaultController): void {
  g.__mrSSEClients.delete(controller);
}

export function getFilesForView(view: string): FileEntry[] {
  const files = Array.from(g.__mrRegistry.values());
  switch (view) {
    case 'recents':
      return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
    case 'folders':
      return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    default:
      return files.sort((a, b) => b.modifiedAt - a.modifiedAt);
  }
}

export function getWatchedDirs(): string[] {
  return [...g.__mrWatchedDirs];
}

export function getFileEntry(filePath: string): FileEntry | undefined {
  return g.__mrRegistry.get(filePath);
}

export function isValidPath(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  if (!resolved.endsWith('.md')) return false;
  for (const dir of g.__mrWatchedDirs) {
    if (resolved.startsWith(dir + path.sep) || resolved === dir) return true;
  }
  return false;
}

/**
 * Refresh active presets from state. Called when presets are toggled.
 * Re-evaluates registry: removes files that now match active presets,
 * or triggers rescan for files that were previously hidden.
 */
export async function refreshPresets(): Promise<void> {
  const newPresets = await getActivePresets();
  const oldPresets = g.__mrActivePresets;
  g.__mrActivePresets = newPresets;

  // Remove files from registry that now match a newly activated preset
  const toRemove: string[] = [];
  for (const [filePath, entry] of g.__mrRegistry) {
    const filename = path.basename(filePath);
    if (matchesActivePreset(filePath, filename, newPresets)) {
      toRemove.push(filePath);
    }
  }

  for (const p of toRemove) {
    g.__mrRegistry.delete(p);
    broadcast({ type: 'file-removed', data: { path: p } });
  }

  // If a preset was DEACTIVATED, those files need to be rediscovered.
  // Rather than rescanning, we trigger a full SSE event so the client re-fetches.
  const deactivated = oldPresets.filter(p => !newPresets.includes(p));
  if (deactivated.length > 0) {
    // The simplest approach: tell client to refetch everything
    broadcast({
      type: 'scan-complete',
      data: { totalFiles: g.__mrRegistry.size, filteredCount: getFilteredCount() },
    });
  }
}

/**
 * Dynamically add a watch directory without restarting the watcher.
 */
export function addWatchPath(dir: string): void {
  if (!g.__mrWatcher) return;
  if (g.__mrWatchedDirs.includes(dir)) return;
  g.__mrWatchedDirs.push(dir);
  g.__mrWatcher.add(dir);
}

/**
 * Dynamically remove a watch directory and clean up its files from the registry.
 */
export function removeWatchPath(dir: string): void {
  if (!g.__mrWatcher) return;
  g.__mrWatcher.unwatch(dir);
  g.__mrWatchedDirs = g.__mrWatchedDirs.filter(d => d !== dir);
  for (const [filePath] of g.__mrRegistry) {
    if (filePath.startsWith(dir)) {
      g.__mrRegistry.delete(filePath);
      broadcast({ type: 'file-removed', data: { path: filePath } });
    }
  }
}

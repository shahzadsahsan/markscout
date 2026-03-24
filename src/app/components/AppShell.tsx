'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { MarkdownPreview, PALETTES, type PaletteId } from './MarkdownPreview';
import { StatusBar } from './StatusBar';
import { PreferencesPanel } from './PreferencesPanel';
import type { FileEntry, SidebarView, FileContentResponse, FolderNode, SearchResult } from '@/lib/types';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function AppShell() {
  // File state
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  // Sidebar state
  const [sidebarView, setSidebarView] = useState<SidebarView>('recents');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const sidebarWidthRef = useRef(280);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // V2: Folder features
  const [favoriteFolders, setFavoriteFolders] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set());

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [totalFiles, setTotalFiles] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  // Refs
  const abortRef = useRef<AbortController | null>(null);
  const contentCacheRef = useRef<Map<string, FileContentResponse>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingFilesRef = useRef<FileEntry[]>([]); // SSE batch buffer
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const stateRestoredRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Preferences panel
  const [prefsOpen, setPrefsOpen] = useState(false);

  // Custom watch dirs (for folder removal in FoldersView)
  const [customWatchDirs, setCustomWatchDirs] = useState<string[]>([]);

  // First-run welcome screen
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeDismissedRef = useRef(false);

  // Content search
  const [contentSearch, setContentSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Update notification
  const [updateInfo, setUpdateInfo] = useState<{ latestVersion: string; releaseUrl: string; dmgUrl?: string | null } | null>(null);
  const [updateDownloading, setUpdateDownloading] = useState(false);

  // Shortcuts cheat sheet
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Zoom & display
  const ZOOM_STEPS = [0.85, 1, 1.25, 1.5, 2];
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fillScreen, setFillScreen] = useState(false);
  const [activePalette, setActivePalette] = useState<PaletteId>('parchment-dusk');
  const [minLines, setMinLines] = useState(20);
  const mainRef = useRef<HTMLElement>(null);

  // --- Restore persisted UI state on mount ---
  useEffect(() => {
    fetch('/api/ui')
      .then(r => r.json())
      .then(data => {
        if (data.ui) {
          setSidebarView(data.ui.sidebarView || 'recents');
          setSidebarCollapsed(data.ui.sidebarCollapsed || false);
          if (data.ui.sidebarWidth) {
            setSidebarWidth(data.ui.sidebarWidth);
            sidebarWidthRef.current = data.ui.sidebarWidth;
          }
          if (data.ui.lastSelectedPath) {
            setSelectedPath(data.ui.lastSelectedPath);
          }
          if (data.ui.expandedGroups) {
            setExpandedGroups(new Set(data.ui.expandedGroups));
          }
          if (data.ui.zoomLevel !== undefined) setZoomLevel(data.ui.zoomLevel);
          if (data.ui.fillScreen !== undefined) setFillScreen(data.ui.fillScreen);
          if (data.ui.contentSearch !== undefined) setContentSearch(data.ui.contentSearch);
          if (data.ui.palette) setActivePalette(data.ui.palette);
        }
        if (data.favoriteFolders) {
          setFavoriteFolders(new Set(data.favoriteFolders));
        }
        if (data.excludedPaths) {
          setExcludedPaths(new Set(data.excludedPaths));
        }
        if (data.customWatchDirs) {
          setCustomWatchDirs(data.customWatchDirs);
        }
        if (data.firstRun) {
          setShowWelcome(true);
        }
        stateRestoredRef.current = true;
        // Re-fetch files for the restored view (initial fetch used default 'recents')
        const restoredView = data.ui?.sidebarView || 'recents';
        if (restoredView !== 'recents') {
          fetchFiles(restoredView);
        }
      })
      .catch(() => { stateRestoredRef.current = true; });
  }, []);

  // --- Known paths for instant link navigation ---
  const knownPaths = useMemo(() => new Set(files.map(f => f.path)), [files]);

  // --- Debounced search for snappy typing ---
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // --- Filter files by search query + minLines ---
  const filteredFiles = useMemo(() => {
    let result = files;
    if (minLines > 0) {
      result = result.filter(f => f.lineCount === undefined || f.lineCount >= minLines);
    }
    if (!debouncedSearch.trim()) return result;
    const q = debouncedSearch.toLowerCase();
    return result.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.project.toLowerCase().includes(q) ||
      f.relativePath.toLowerCase().includes(q)
    );
  }, [files, debouncedSearch, minLines]);

  // --- Content search effect ---
  useEffect(() => {
    if (!contentSearch || debouncedSearch.trim().length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!controller.signal.aborted) {
          setSearchResults(data.results || []);
          setSearchLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSearchResults([]);
          setSearchLoading(false);
        }
      });

    return () => controller.abort();
  }, [contentSearch, debouncedSearch]);

  // --- Toggle content search (persisted) ---
  const toggleContentSearch = useCallback(() => {
    setContentSearch(prev => {
      const next = !prev;
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentSearch: next }),
      }).catch(() => {});
      if (!next) {
        setSearchResults(null);
        setSearchLoading(false);
      }
      return next;
    });
  }, []);

  // --- Fetch files for current view ---
  const fetchFiles = useCallback(async (view?: SidebarView) => {
    const v = view || sidebarView;
    try {
      const res = await fetch(`/api/files?view=${v}`);
      const data = await res.json();

      if (data.folders) {
        setFolders(data.folders);
      }
      if (data.files) {
        setFiles(data.files);
      }

      setTotalFiles(data.totalFiles);
      if (data.scanComplete) {
        setScanComplete(true);
        setLoading(false);
      }
    } catch {
      // Retry silently
    }
  }, [sidebarView]);

  // --- Fetch file content (with AbortController + LRU cache) ---
  const fetchFileContent = useCallback(async (filePath: string) => {
    // Check cache first for instant back-navigation
    const cached = contentCacheRef.current.get(filePath);
    if (cached) {
      setFileContent(cached);
      document.title = `${cached.name} — MarkScout`;
      // Still record history + persist selected path
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      }).catch(() => {});
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSelectedPath: filePath }),
      }).catch(() => {});
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setContentLoading(true);

    try {
      const res = await fetch(
        `/api/file?path=${encodeURIComponent(filePath)}`,
        { signal: abortRef.current.signal }
      );
      const data: FileContentResponse = await res.json();
      setFileContent(data);
      document.title = `${data.name} — MarkScout`;

      // Store in LRU cache (cap at 20)
      contentCacheRef.current.set(filePath, data);
      if (contentCacheRef.current.size > 20) {
        const oldest = contentCacheRef.current.keys().next().value;
        if (oldest) contentCacheRef.current.delete(oldest);
      }

      if (data.isFavorite) {
        setFavorites(prev => new Set(prev).add(filePath));
      }

      // Record history + persist selected path (fire-and-forget)
      fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      }).catch(() => {});
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastSelectedPath: filePath }),
      }).catch(() => {});
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
    } finally {
      setContentLoading(false);
    }
  }, []);

  // --- Select a file ---
  const selectFile = useCallback((filePath: string) => {
    setSelectedPath(filePath);
    fetchFileContent(filePath);
  }, [fetchFileContent]);

  // --- Toggle star ---
  const toggleStar = useCallback(async (filePath: string) => {
    try {
      const res = await fetch('/api/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      });
      const data = await res.json();

      setFavorites(prev => {
        const next = new Set(prev);
        if (data.isFavorite) next.add(filePath);
        else next.delete(filePath);
        return next;
      });

      if (filePath === selectedPath && fileContent) {
        setFileContent({ ...fileContent, isFavorite: data.isFavorite });
      }
      if (sidebarView === 'favorites') fetchFiles('favorites');
    } catch { /* silent */ }
  }, [selectedPath, fileContent, sidebarView, fetchFiles]);

  // --- Toggle folder star ---
  const toggleFolderStar = useCallback(async (folderPath: string) => {
    try {
      const res = await fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toggleFolderStar: folderPath }),
      });
      const data = await res.json();
      setFavoriteFolders(prev => {
        const next = new Set(prev);
        if (data.isFavorite) next.add(folderPath);
        else next.delete(folderPath);
        return next;
      });
    } catch { /* silent */ }
  }, []);

  // --- Toggle folder expand/collapse (persisted) ---
  const toggleExpand = useCallback((folderPath: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      // Persist (fire-and-forget)
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expandedGroups: Array.from(next) }),
      }).catch(() => {});
      return next;
    });
  }, []);

  // --- Exclude/include folder ---
  const excludeFolder = useCallback(async (folderPath: string) => {
    try {
      const res = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exclude', path: folderPath }),
      });
      const data = await res.json();
      setExcludedPaths(new Set(data.excludedPaths));
      // Re-fetch to remove excluded files from other views
      fetchFiles();
    } catch { /* silent */ }
  }, [fetchFiles]);

  const includeFolder = useCallback(async (folderPath: string) => {
    try {
      const res = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'include', path: folderPath }),
      });
      const data = await res.json();
      setExcludedPaths(new Set(data.excludedPaths));
      fetchFiles();
    } catch { /* silent */ }
  }, [fetchFiles]);

  // --- Change sidebar view (persisted) ---
  const changeView = useCallback((view: SidebarView) => {
    setSidebarView(view);
    fetchFiles(view);
    fetch('/api/ui', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidebarView: view }),
    }).catch(() => {});
  }, [fetchFiles]);

  // --- Toggle sidebar collapse (persisted) ---
  // --- Remove a custom watch directory ---
  const removeWatchDir = useCallback(async (dir: string) => {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeWatchDir: dir }),
      });
      setCustomWatchDirs(prev => prev.filter(d => d !== dir));
      // Remove files from that directory
      setFiles(prev => prev.filter(f => !f.path.startsWith(dir)));
      fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  // --- Add a custom watch directory ---
  const addWatchDir = useCallback(async (dir: string) => {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addWatchDir: dir }),
      });
      setCustomWatchDirs(prev => [...prev, dir]);
      fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarCollapsed: next }),
      }).catch(() => {});
      return next;
    });
  }, []);

  // --- Sidebar resize drag ---
  const startSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMove = (ev: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(520, startWidth + ev.clientX - startX));
      sidebarWidthRef.current = newWidth;
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      fetch('/api/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarWidth: sidebarWidthRef.current }),
      }).catch(() => {});
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // --- Flush SSE batch buffer ---
  const flushPendingFiles = useCallback(() => {
    if (pendingFilesRef.current.length === 0) return;
    const pending = pendingFilesRef.current;
    pendingFilesRef.current = [];

    setFiles(prev => {
      const pathSet = new Set(prev.map(f => f.path));
      const newFiles = pending.filter(f => !pathSet.has(f.path));
      const updated = prev.map(f => {
        const newer = pending.find(p => p.path === f.path);
        return newer || f;
      });
      return [...newFiles, ...updated].sort((a, b) => b.modifiedAt - a.modifiedAt);
    });
    setTotalFiles(prev => prev + pendingFilesRef.current.length);
  }, []);

  // --- SSE connection ---
  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const es = new EventSource('/api/events');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus('connected');
        fetchFiles();
      };

      es.addEventListener('file-added', (e) => {
        const entry: FileEntry = JSON.parse(e.data);
        if (scanComplete) {
          // After scan: instant update
          setFiles(prev => {
            const filtered = prev.filter(f => f.path !== entry.path);
            return [entry, ...filtered].sort((a, b) => b.modifiedAt - a.modifiedAt);
          });
          setTotalFiles(prev => prev + 1);
        } else {
          // During scan: batch updates (Phase 4 optimization)
          pendingFilesRef.current.push(entry);
          if (!batchTimerRef.current) {
            batchTimerRef.current = setInterval(() => {
              flushPendingFiles();
            }, 500);
          }
        }
      });

      es.addEventListener('file-changed', (e) => {
        const entry: FileEntry = JSON.parse(e.data);
        setFiles(prev => prev.map(f => f.path === entry.path ? entry : f));
        // Invalidate cache so next view gets fresh content
        contentCacheRef.current.delete(entry.path);
        if (entry.path === selectedPath) {
          fetchFileContent(entry.path);
        }
      });

      es.addEventListener('file-removed', (e) => {
        const { path } = JSON.parse(e.data);
        setFiles(prev => prev.filter(f => f.path !== path));
        setTotalFiles(prev => Math.max(0, prev - 1));
      });

      es.addEventListener('scan-complete', (e) => {
        const data = JSON.parse(e.data);
        // Stop batch timer
        if (batchTimerRef.current) {
          clearInterval(batchTimerRef.current);
          batchTimerRef.current = null;
        }
        flushPendingFiles();
        setTotalFiles(data.totalFiles);
        setFilteredCount(data.filteredCount);
        setScanComplete(true);
        setLoading(false);
        fetchFiles();
      });

      es.onerror = () => {
        setConnectionStatus('reconnecting');
        es.close();
        eventSourceRef.current = null;
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();
    return () => {
      mountedRef.current = false;
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Initial file fetch ---
  useEffect(() => {
    fetchFiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-select file on first load (restore or most recent) ---
  useEffect(() => {
    if (!scanComplete || !stateRestoredRef.current || files.length === 0) return;
    if (fileContent) return; // Already showing a file

    if (selectedPath) {
      // Restore previously selected file
      const exists = files.some(f => f.path === selectedPath);
      if (exists) {
        fetchFileContent(selectedPath);
        return;
      }
    }
    // Fall back to most recent
    selectFile(files[0].path);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanComplete, files.length]);

  // --- Zoom controls ---
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      const next = idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : prev;
      fetch('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoomLevel: next }) }).catch(() => {});
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      const next = idx > 0 ? ZOOM_STEPS[idx - 1] : prev;
      fetch('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoomLevel: next }) }).catch(() => {});
      return next;
    });
  }, []);

  const zoomReset = useCallback(() => {
    setZoomLevel(1);
    fetch('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zoomLevel: 1 }) }).catch(() => {});
  }, []);

  const toggleFillScreen = useCallback(() => {
    setFillScreen(prev => {
      const next = !prev;
      fetch('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fillScreen: next }) }).catch(() => {});
      return next;
    });
  }, []);

  const changePalette = useCallback((id: PaletteId) => {
    setActivePalette(id);
    fetch('/api/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ palette: id }) }).catch(() => {});
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setSearchQuery('');
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // Meta/Ctrl shortcuts
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') { e.preventDefault(); zoomIn(); return; }
        if (e.key === '-') { e.preventDefault(); zoomOut(); return; }
        if (e.key === '0') { e.preventDefault(); zoomReset(); return; }
        if (e.key === ',') { e.preventDefault(); setPrefsOpen(true); return; }
        if (e.key === 's' || e.key === 'S') { e.preventDefault(); toggleCollapse(); return; }
        if (e.shiftKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); toggleFillScreen(); return; }
      }

      switch (e.key) {
        case 'Escape': {
          setSearchQuery('');
          break;
        }
        case '/': {
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        }
        case '1': changeView('recents'); break;
        case '2': changeView('folders'); break;
        case '3': changeView('favorites'); break;
        case 's': {
          if (selectedPath) toggleStar(selectedPath);
          break;
        }
        case '?': {
          setShowShortcuts(prev => !prev);
          break;
        }
        case 'j':
        case 'k':
        case 'ArrowDown':
        case 'ArrowUp': {
          e.preventDefault();
          const list = filteredFiles;
          if (list.length === 0) break;
          const currentIdx = selectedPath ? list.findIndex(f => f.path === selectedPath) : -1;
          const down = e.key === 'k' || e.key === 'ArrowDown';
          const nextIdx = down
            ? Math.min(currentIdx + 1, list.length - 1)
            : Math.max(currentIdx - 1, 0);
          if (nextIdx >= 0 && nextIdx < list.length) {
            selectFile(list[nextIdx].path);
            // Scroll selected item into view
            requestAnimationFrame(() => {
              document.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
            });
          }
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [changeView, toggleStar, selectFile, selectedPath, filteredFiles, zoomIn, zoomOut, zoomReset, toggleFillScreen, toggleCollapse]);

  // Welcome screen is now triggered by firstRun flag from /api/ui (state.json didn't exist)

  // --- Trigger native folder picker (shared by welcome + menu) ---
  const triggerAddFolder = useCallback(async () => {
    const electron = (window as unknown as { electron?: { selectFolder: () => Promise<string | null> } }).electron;
    if (electron?.selectFolder) {
      const dir = await electron.selectFolder();
      if (dir) {
        await addWatchDir(dir);
        setShowWelcome(false);
        welcomeDismissedRef.current = true;
      }
    }
  }, [addWatchDir]);

  // --- Listen for Electron menu "Add Folder" command ---
  useEffect(() => {
    const electron = (window as unknown as { electron?: { onTriggerAddFolder?: (cb: () => void) => () => void } }).electron;
    if (electron?.onTriggerAddFolder) {
      return electron.onTriggerAddFolder(triggerAddFolder);
    }
  }, [triggerAddFolder]);

  // --- Listen for update-available IPC from Electron ---
  useEffect(() => {
    const electron = (window as unknown as { electron?: { onUpdateAvailable?: (cb: (info: { latestVersion: string; releaseUrl: string }) => void) => () => void } }).electron;
    if (electron?.onUpdateAvailable) {
      return electron.onUpdateAvailable((info) => {
        setUpdateInfo(info);
      });
    }
  }, []);

  // --- Welcome Screen Component ---
  if (showWelcome) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen gap-6"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <div className="text-center">
          <h1
            className="text-3xl font-bold mb-2"
            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: '#d4a04a' }}
          >
            MarkScout
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            A local markdown file viewer
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            className="px-6 py-3 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: '#d4a04a',
              color: '#0d0d0d',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={triggerAddFolder}
            onMouseEnter={e => (e.currentTarget.style.background = '#e0b060')}
            onMouseLeave={e => (e.currentTarget.style.background = '#d4a04a')}
          >
            Add Folder
          </button>

          <p className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: 300, textAlign: 'center' }}>
            Choose a folder containing markdown files to start reading.
          </p>
        </div>

        <button
          className="text-xs mt-4 transition-colors"
          style={{
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
          onClick={() => {
            setShowWelcome(false);
            welcomeDismissedRef.current = true;
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Skip — use defaults
        </button>
      </div>
    );
  }

  const paletteStyle = useMemo(() => {
    const p = PALETTES.find(pl => pl.id === activePalette);
    if (!p) return { background: 'var(--bg)' } as React.CSSProperties;
    const s: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.vars)) s[k] = v;
    s.backgroundColor = p.vars['--bg'];
    s.color = p.vars['--text'];
    s.transition = 'background-color 0.4s ease, color 0.4s ease';
    return s as React.CSSProperties;
  }, [activePalette]);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={paletteStyle}>
      {/* Update notification banner */}
      {updateInfo && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '6px 16px',
            background: 'var(--accent, #d4a04a)',
            color: '#0d0d0d',
            fontSize: 12,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontWeight: 500,
          }}
        >
          <span>MarkScout v{updateInfo.latestVersion} available</span>
          {updateInfo.dmgUrl && (
            <button
              onClick={async () => {
                const electron = (window as unknown as { electron?: { downloadUpdate?: (url: string) => Promise<{ ok: boolean }> } }).electron;
                if (electron?.downloadUpdate && updateInfo.dmgUrl) {
                  setUpdateDownloading(true);
                  const result = await electron.downloadUpdate(updateInfo.dmgUrl);
                  setUpdateDownloading(false);
                  if (result.ok) setUpdateInfo(null);
                }
              }}
              disabled={updateDownloading}
              style={{
                background: '#0d0d0d',
                color: 'var(--accent, #d4a04a)',
                border: 'none',
                borderRadius: 4,
                padding: '2px 10px',
                fontSize: 11,
                cursor: updateDownloading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                opacity: updateDownloading ? 0.6 : 1,
              }}
            >
              {updateDownloading ? 'Downloading...' : 'Download & Install'}
            </button>
          )}
          <button
            onClick={() => {
              const electron = (window as unknown as { electron?: { openExternal?: (url: string) => void } }).electron;
              if (electron?.openExternal) {
                electron.openExternal(updateInfo.releaseUrl);
              } else {
                window.open(updateInfo.releaseUrl, '_blank');
              }
            }}
            style={{
              background: 'none',
              color: '#0d0d0d',
              border: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 4,
              padding: '2px 10px',
              fontSize: 11,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Release Notes
          </button>
          <button
            onClick={() => setUpdateInfo(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0d0d0d',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: '0 4px',
              opacity: 0.6,
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <div className="sidebar-wrapper">
          <Sidebar
            view={sidebarView}
            onChangeView={changeView}
            files={filteredFiles}
            folders={folders}
            selectedPath={selectedPath}
            onSelectFile={selectFile}
            onToggleStar={toggleStar}
            favorites={favorites}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleCollapse}
            loading={loading}
            width={sidebarWidth}
            favoriteFolders={favoriteFolders}
            onToggleFolderStar={toggleFolderStar}
            expandedGroups={expandedGroups}
            onToggleExpand={toggleExpand}
            excludedPaths={excludedPaths}
            onExcludeFolder={excludeFolder}
            onIncludeFolder={includeFolder}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            customWatchDirs={customWatchDirs}
            onRemoveWatchDir={removeWatchDir}
            contentSearch={contentSearch}
            onToggleContentSearch={toggleContentSearch}
            searchResults={searchResults}
            searchLoading={searchLoading}
          />
        </div>

        {!sidebarCollapsed && (
          <div className="sidebar-resize-handle" onMouseDown={startSidebarDrag} />
        )}

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto content-area"
        >
          <MarkdownPreview
            fileContent={fileContent}
            loading={contentLoading}
            onToggleStar={toggleStar}
            onSelectFile={selectFile}
            knownPaths={knownPaths}
            zoomLevel={zoomLevel}
            fillScreen={fillScreen}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
            onToggleFillScreen={toggleFillScreen}
            activePalette={activePalette}
            onChangePalette={changePalette}
          />
        </main>
      </div>

      <div className="status-bar">
        <StatusBar
          totalFiles={totalFiles}
          filteredCount={filteredCount}
          connectionStatus={connectionStatus}
          scanComplete={scanComplete}
          onOpenPreferences={() => setPrefsOpen(true)}
          minLines={minLines}
          onChangeMinLines={setMinLines}
        />
      </div>

      {showShortcuts && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '36px 48px', maxWidth: 620,
              fontFamily: 'var(--font-jetbrains-mono), monospace',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 28, marginBottom: 24, color: 'var(--accent)' }}>Keyboard Shortcuts</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px 24px', fontSize: 20 }}>
              {([
                ['1 2 3', 'Switch sidebar view'],
                ['j / k', 'Navigate files (up / down)'],
                ['s', 'Star / unstar file'],
                ['/', 'Focus search'],
                ['Esc', 'Clear search'],
                ['Cmd + S', 'Hide / show sidebar'],
                ['Cmd + Shift + F', 'Toggle fill screen'],
                ['Cmd + =', 'Zoom in'],
                ['Cmd + -', 'Zoom out'],
                ['Cmd + 0', 'Reset zoom'],
                ['Cmd + ,', 'Preferences'],
                ['?', 'Show this help'],
              ] as const).map(([key, desc]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <kbd style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 18,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    color: 'var(--accent)', textAlign: 'right', whiteSpace: 'nowrap',
                  }}>{key}</kbd>
                  <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PreferencesPanel
        open={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        onPresetsChanged={() => {
          // Re-fetch files to reflect new preset filters
          fetchFiles();
        }}
      />
    </div>
  );
}

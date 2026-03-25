import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { api } from '../lib/api';
import type { FileEntry, SidebarView, FileContentResponse, FolderNode, SearchResult, TauriEvent } from '../lib/types';
import { Sidebar } from './Sidebar';
import { MarkdownPreview, PALETTES, type PaletteId } from './MarkdownPreview';
import { StatusBar } from './StatusBar';
import { PreferencesPanel } from './PreferencesPanel';
import { loadSavedTypography, getTypographyPreset, applyTypographyPreset } from '../lib/typography';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export default function AppShell() {
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

  // Folder features
  const [favoriteFolders, setFavoriteFolders] = useState<Set<string>>(new Set());
  const [excludedPaths, setExcludedPaths] = useState<Set<string>>(new Set());

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [totalFiles, setTotalFiles] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  // Refs
  const contentCacheRef = useRef<Map<string, FileContentResponse>>(new Map());
  const pendingFilesRef = useRef<FileEntry[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const stateRestoredRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const fetchingContentRef = useRef(false);

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

  // Update notification
  const [updateInfo, setUpdateInfo] = useState<{ latestVersion: string; downloadUrl: string } | null>(null);

  // Shortcuts cheat sheet
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Zoom & display
  const ZOOM_STEPS = [0.85, 1, 1.25, 1.5, 2];
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fillScreen, setFillScreen] = useState(false);
  const [activePalette, setActivePalette] = useState<PaletteId>('parchment-dusk');
  const [minLines, setMinLines] = useState(20);
  const mainRef = useRef<HTMLElement>(null);

  // --- Apply saved typography preset on mount ---
  useEffect(() => {
    const savedId = loadSavedTypography();
    const preset = getTypographyPreset(savedId);
    applyTypographyPreset(preset);
  }, []);

  // --- Restore persisted UI state on mount ---
  useEffect(() => {
    api.getUiState()
      .then(data => {
        // Guard: if saved view was 'folders' (removed in v0.6), fall back to 'recents'
        const raw = data.sidebarView || 'recents';
        setSidebarView((raw === 'recents' || raw === 'favorites') ? raw : 'recents');
        setSidebarCollapsed(data.sidebarCollapsed || false);
        if (data.sidebarWidth) {
          setSidebarWidth(data.sidebarWidth);
          sidebarWidthRef.current = data.sidebarWidth;
        }
        if (data.lastSelectedPath) {
          setSelectedPath(data.lastSelectedPath);
        }
        if (data.zoomLevel !== undefined) setZoomLevel(data.zoomLevel);
        if (data.fillScreen !== undefined) setFillScreen(data.fillScreen);
        if (data.contentSearch !== undefined) setContentSearch(data.contentSearch);
        if (data.favoriteFolders) {
          setFavoriteFolders(new Set(data.favoriteFolders));
        }
        if (data.favorites) {
          setFavorites(new Set(data.favorites.map(f => f.path)));
        }

        stateRestoredRef.current = true;
        // Re-fetch files for the restored view
        const restoredView = data.sidebarView || 'recents';
        if (restoredView !== 'recents') {
          fetchFiles(restoredView);
        }
      })
      .catch(() => { stateRestoredRef.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Check for updates on mount ---
  useEffect(() => {
    api.checkForUpdate()
      .then(result => {
        if (result.hasUpdate) {
          setUpdateInfo({
            latestVersion: result.latestVersion,
            downloadUrl: result.downloadUrl,
          });
        }
      })
      .catch(() => {});
  }, []);

  // --- Record session start on mount (v0.5) ---
  useEffect(() => {
    api.recordSessionStart().catch(() => {});
  }, []);

  // (folder-dropped listener is below, after addWatchDir is defined)

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

    setSearchLoading(true);
    let cancelled = false;

    api.searchFiles(debouncedSearch)
      .then(data => {
        if (!cancelled) {
          setSearchResults(data.results || []);
          setSearchLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([]);
          setSearchLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [contentSearch, debouncedSearch]);

  // --- Toggle content search (persisted) ---
  const toggleContentSearch = useCallback(() => {
    setContentSearch(prev => {
      const next = !prev;
      api.saveUiState({ contentSearch: next }).catch(() => {});
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
      const data = await api.getFiles(v);

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

  // --- Fetch file content (with LRU cache) ---
  const fetchFileContent = useCallback(async (filePath: string) => {
    // Check cache first for instant back-navigation
    const cached = contentCacheRef.current.get(filePath);
    if (cached) {
      setFileContent(cached);
      document.title = `${cached.name} — MarkScout`;
      // Still record history + persist selected path
      api.recordHistory(filePath, cached.contentHash || '').catch(() => {});
      api.saveUiState({ lastSelectedPath: filePath }).catch(() => {});
      return;
    }

    if (fetchingContentRef.current) return;
    fetchingContentRef.current = true;
    setContentLoading(true);

    try {
      const data = await api.getFileContent(filePath);
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
      api.recordHistory(filePath, data.contentHash || '').catch(() => {});
      api.saveUiState({ lastSelectedPath: filePath }).catch(() => {});
    } catch {
      // silent
    } finally {
      setContentLoading(false);
      fetchingContentRef.current = false;
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
      // Need the content hash for the command
      const entry = files.find(f => f.path === filePath);
      const contentHash = entry?.contentHash || fileContent?.contentHash || '';
      const isFavorite = await api.toggleFavorite(filePath, contentHash);

      setFavorites(prev => {
        const next = new Set(prev);
        if (isFavorite) next.add(filePath);
        else next.delete(filePath);
        return next;
      });

      if (filePath === selectedPath && fileContent) {
        setFileContent({ ...fileContent, isFavorite });
      }
      if (sidebarView === 'favorites') fetchFiles('favorites');
    } catch { /* silent */ }
  }, [selectedPath, fileContent, sidebarView, fetchFiles, files]);

  // --- Toggle folder star ---
  const toggleFolderStar = useCallback(async (folderPath: string) => {
    try {
      const isFavorite = await api.toggleFolderStar(folderPath);
      setFavoriteFolders(prev => {
        const next = new Set(prev);
        if (isFavorite) next.add(folderPath);
        else next.delete(folderPath);
        return next;
      });
    } catch { /* silent */ }
  }, []);


  // --- Exclude/include folder ---
  const excludeFolder = useCallback(async (folderPath: string) => {
    try {
      await api.updateFilter('add', folderPath);
      const filters = await api.getFilters();
      setExcludedPaths(new Set(filters.excludedPaths));
      fetchFiles();
    } catch { /* silent */ }
  }, [fetchFiles]);

  const includeFolder = useCallback(async (folderPath: string) => {
    try {
      await api.updateFilter('remove', folderPath);
      const filters = await api.getFilters();
      setExcludedPaths(new Set(filters.excludedPaths));
      fetchFiles();
    } catch { /* silent */ }
  }, [fetchFiles]);

  // --- Change sidebar view (persisted) ---
  const changeView = useCallback((view: SidebarView) => {
    setSidebarView(view);
    fetchFiles(view);
    api.saveUiState({ sidebarView: view }).catch(() => {});
  }, [fetchFiles]);

  // --- Remove a custom watch directory ---
  const removeWatchDir = useCallback(async (dir: string) => {
    try {
      await api.removeWatchDir(dir);
      setCustomWatchDirs(prev => prev.filter(d => d !== dir));
      setFiles(prev => prev.filter(f => !f.path.startsWith(dir)));
      fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  // --- Add a custom watch directory ---
  const addWatchDir = useCallback(async (dir: string) => {
    try {
      await api.addWatchDir(dir);
      setCustomWatchDirs(prev => [...prev, dir]);
      fetchFiles();
    } catch { /* ignore */ }
  }, [fetchFiles]);

  // --- Listen for folder-dropped Tauri event ---
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    (async () => {
      try {
        unlisten = await listen<{ path: string }>('folder-dropped', (event) => {
          const dir = event.payload?.path;
          if (dir) addWatchDir(dir);
        });
      } catch { /* event may not exist yet */ }
    })();
    return () => { if (unlisten) unlisten(); };
  }, [addWatchDir]);

  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      api.saveUiState({ sidebarCollapsed: next }).catch(() => {});
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
      api.saveUiState({ sidebarWidth: sidebarWidthRef.current }).catch(() => {});
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

  // --- Tauri event listener (replaces SSE EventSource) ---
  useEffect(() => {
    mountedRef.current = true;
    setConnectionStatus('connected');

    let unlisten: (() => void) | null = null;

    (async () => {
      unlisten = await listen<TauriEvent>('file-event', (event) => {
        if (!mountedRef.current) return;
        const payload = event.payload;

        switch (payload.type) {
          case 'file-added': {
            const entry = payload.data as FileEntry;
            if (scanComplete) {
              setFiles(prev => {
                const filtered = prev.filter(f => f.path !== entry.path);
                return [entry, ...filtered].sort((a, b) => b.modifiedAt - a.modifiedAt);
              });
              setTotalFiles(prev => prev + 1);
            } else {
              pendingFilesRef.current.push(entry);
              if (!batchTimerRef.current) {
                batchTimerRef.current = setInterval(() => {
                  flushPendingFiles();
                }, 500);
              }
            }
            break;
          }

          case 'file-changed': {
            const entry = payload.data as FileEntry;
            setFiles(prev => prev.map(f => f.path === entry.path ? entry : f));
            contentCacheRef.current.delete(entry.path);
            // Re-fetch if currently viewing this file
            if (entry.path === selectedPath) {
              fetchFileContent(entry.path);
            }
            break;
          }

          case 'file-removed': {
            const { path } = payload.data as { path: string };
            setFiles(prev => prev.filter(f => f.path !== path));
            setTotalFiles(prev => Math.max(0, prev - 1));
            break;
          }

          case 'scan-complete': {
            const data = payload.data as { totalFiles: number; filteredCount: number };
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
            break;
          }
        }
      });
    })();

    // Initial file fetch
    fetchFiles();

    return () => {
      mountedRef.current = false;
      if (unlisten) unlisten();
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-select file on first load (restore or most recent) ---
  useEffect(() => {
    if (!scanComplete || !stateRestoredRef.current || files.length === 0) return;
    if (fileContent) return; // Already showing a file

    if (selectedPath) {
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
      api.saveUiState({ zoomLevel: next }).catch(() => {});
      return next;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      const next = idx > 0 ? ZOOM_STEPS[idx - 1] : prev;
      api.saveUiState({ zoomLevel: next }).catch(() => {});
      return next;
    });
  }, []);

  const zoomReset = useCallback(() => {
    setZoomLevel(1);
    api.saveUiState({ zoomLevel: 1 }).catch(() => {});
  }, []);

  const toggleFillScreen = useCallback(() => {
    setFillScreen(prev => {
      const next = !prev;
      api.saveUiState({ fillScreen: next }).catch(() => {});
      return next;
    });
  }, []);

  const changePalette = useCallback((id: PaletteId) => {
    setActivePalette(id);
    // Palette is a frontend-only pref; save via saveUiState if the Rust side supports it,
    // otherwise store in localStorage as a fallback
    try {
      localStorage.setItem('markscout-palette', id);
    } catch { /* silent */ }
  }, []);

  // Restore palette from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('markscout-palette');
      if (saved) setActivePalette(saved as PaletteId);
    } catch { /* silent */ }
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setSearchQuery('');
          (e.target as HTMLElement).blur();
        }
        return;
      }

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
        case '2': changeView('favorites'); break;
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

  // --- Trigger native folder picker (Tauri dialog) ---
  const triggerAddFolder = useCallback(async () => {
    try {
      const dir = await open({ directory: true, multiple: false });
      if (dir && typeof dir === 'string') {
        await addWatchDir(dir);
        setShowWelcome(false);
        welcomeDismissedRef.current = true;
      }
    } catch { /* user cancelled */ }
  }, [addWatchDir]);

  // --- Onboarding: quick-add a suggested path ---
  const handleQuickAdd = useCallback(async (path: string) => {
    try {
      await addWatchDir(path);
      setShowWelcome(false);
      welcomeDismissedRef.current = true;
    } catch { /* silent */ }
  }, [addWatchDir]);

  // --- Welcome Screen Component (enhanced onboarding) ---
  if (showWelcome) {
    const suggestedPaths = [
      { path: '~/.claude/', desc: 'Claude config', icon: '\uD83E\uDD16' },
      { path: '~/Documents/', desc: 'Documents', icon: '\uD83D\uDCC4' },
      { path: '~/Desktop/', desc: 'Desktop', icon: '\uD83D\uDDA5' },
      { path: '~/Projects/', desc: 'Projects', icon: '\uD83D\uDCBB' },
    ];

    return (
      <div
        className="flex flex-col items-center justify-center h-screen"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <div style={{ maxWidth: 420, width: '100%', padding: '0 24px' }}>
          {/* Header */}
          <div className="text-center" style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 32,
                fontWeight: 700,
                color: '#d4a04a',
                marginBottom: 6,
              }}
            >
              MarkScout
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              A local markdown file viewer
            </p>
          </div>

          {/* Suggested paths */}
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 10,
                textAlign: 'center',
              }}
            >
              Common locations for vibe coders:
            </p>
            <div className="flex flex-col gap-2">
              {suggestedPaths.map(sp => (
                <button
                  key={sp.path}
                  className="onboard-path"
                  onClick={() => {
                    // Expand ~ to home directory path
                    handleQuickAdd(sp.path);
                  }}
                >
                  <span style={{ fontSize: 18 }}>{sp.icon}</span>
                  <div className="flex-1">
                    <div className="path-name">{sp.path}</div>
                    <div className="path-desc">{sp.desc}</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{'\u203A'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Instruction text */}
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            Click a path to add it, or:
          </p>

          {/* Choose Folder button */}
          <div className="flex justify-center" style={{ marginBottom: 20 }}>
            <button
              style={{
                padding: '10px 24px',
                borderRadius: 8,
                background: '#d4a04a',
                color: '#0d0d0d',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={triggerAddFolder}
              onMouseEnter={e => (e.currentTarget.style.background = '#e0b060')}
              onMouseLeave={e => (e.currentTarget.style.background = '#d4a04a')}
            >
              + Choose Folder
            </button>
          </div>

          {/* Skip */}
          <div className="text-center">
            <button
              style={{
                color: 'var(--text-muted)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'var(--font-ui)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                transition: 'color 0.12s',
              }}
              onClick={() => {
                setShowWelcome(false);
                welcomeDismissedRef.current = true;
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Skip {'\u2014'} start with no folders
            </button>
          </div>
        </div>
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
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
          }}
        >
          <span>MarkScout v{updateInfo.latestVersion} available</span>
          <button
            onClick={() => {
              api.openExternal(updateInfo.downloadUrl).catch(() => {
                window.open(updateInfo.downloadUrl, '_blank');
              });
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
            {'\u2715'}
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
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchInputRef={searchInputRef}
            contentSearch={contentSearch}
            onToggleContentSearch={toggleContentSearch}
            searchResults={searchResults}
            searchLoading={searchLoading}
            onOpenPreferences={() => setPrefsOpen(true)}
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
              fontFamily: 'var(--font-ui)',
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
          fetchFiles();
        }}
      />
    </div>
  );
}

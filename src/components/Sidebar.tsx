import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileEntry, SidebarView, FolderNode, SearchResult } from '../lib/types';
import { RecentsView } from './RecentsView';
import { FavoritesView } from './FavoritesView';
import { FileItem } from './FileItem';
import type { RefObject } from 'react';

const RECENT_SEARCHES_KEY = 'markscout-recent-searches';
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecentSearch(query: string): string[] {
  const searches = getRecentSearches().filter(s => s !== query);
  searches.unshift(query);
  const trimmed = searches.slice(0, MAX_RECENT_SEARCHES);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed));
  return trimmed;
}

function removeRecentSearch(query: string): string[] {
  const searches = getRecentSearches().filter(s => s !== query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  return searches;
}

function clearRecentSearches(): string[] {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
  return [];
}

interface SidebarProps {
  view: SidebarView;
  onChangeView: (view: SidebarView) => void;
  files: FileEntry[];
  folders: FolderNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  loading: boolean;
  width: number;
  favoriteFolders: Set<string>;
  onToggleFolderStar: (folderPath: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  contentSearch: boolean;
  onToggleContentSearch: () => void;
  searchResults: SearchResult[] | null;
  searchLoading: boolean;
  onOpenPreferences: () => void;
}

const TABS: { view: SidebarView; icon: string; label: string; shortcut: string }[] = [
  { view: 'recents', icon: '\u23F1', label: 'Recents', shortcut: '1' },
  { view: 'favorites', icon: '\u2B50', label: 'Favorites', shortcut: '2' },
];

function SkeletonList() {
  return (
    <div className="flex flex-col gap-2 p-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function Sidebar({
  view,
  onChangeView,
  files,
  folders,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
  collapsed,
  onToggleCollapse,
  loading,
  width,
  favoriteFolders,
  onToggleFolderStar,
  searchQuery,
  onSearchChange,
  searchInputRef,
  contentSearch,
  onToggleContentSearch,
  searchResults,
  searchLoading,
  onOpenPreferences,
}: SidebarProps) {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const [showRecents, setShowRecents] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Save search query when user presses Enter or submits a non-empty search
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
      setRecentSearches(saveRecentSearch(searchQuery.trim()));
      setShowRecents(false);
    }
    if (e.key === 'Escape') {
      setShowRecents(false);
    }
  }, [searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showRecents) return;
    const handler = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowRecents(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showRecents]);

  return (
    <aside
      className="flex flex-col border-r h-full shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? 48 : width,
        minWidth: collapsed ? 48 : width,
        maxWidth: collapsed ? 48 : width,
        borderColor: 'var(--border)',
        background: 'var(--surface)',
      }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center gap-1 px-2 py-2 border-b overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {collapsed ? (
          <div className="flex flex-col gap-1 w-full items-center">
            {TABS.map(tab => (
              <button
                key={tab.view}
                className={`tab-btn text-sm ${view === tab.view ? 'active' : ''}`}
                onClick={() => onChangeView(tab.view)}
                title={`${tab.label} (${tab.shortcut})`}
              >
                {tab.icon}
              </button>
            ))}
          </div>
        ) : (
          <>
            {TABS.map(tab => (
              <button
                key={tab.view}
                className={`tab-btn text-xs flex-1 ${view === tab.view ? 'active' : ''}`}
                onClick={() => onChangeView(tab.view)}
                title={`${tab.label} (${tab.shortcut})`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
            <button
              className="tab-btn text-xs"
              onClick={onOpenPreferences}
              title="Settings (Cmd+,)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 6px', fontSize: 'var(--text-base)', flexShrink: 0 }}
            >
              {'\u2699'}
            </button>
          </>
        )}
      </div>

      {/* Search bar */}
      {!collapsed && (
        <div ref={searchWrapperRef} className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)', position: 'relative' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={contentSearch ? "Search contents... ( / )" : "Filter files... ( / )"}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => { if (!searchQuery.trim() && recentSearches.length > 0) setShowRecents(true); }}
            onKeyDown={handleSearchKeyDown}
            className="w-full px-2 py-1 text-xs rounded"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
          {/* Recent searches dropdown */}
          {showRecents && !searchQuery.trim() && recentSearches.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 8,
                right: 8,
                zIndex: 100,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                padding: '4px 0',
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 8px 4px' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Recent</span>
                <button
                  onClick={() => setRecentSearches(clearRecentSearches())}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
                  }}
                >
                  Clear all
                </button>
              </div>
              {recentSearches.map(s => (
                <div
                  key={s}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '3px 8px', gap: 6,
                    cursor: 'pointer', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-ui)',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg, rgba(255,255,255,0.05))')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span
                    style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    onClick={() => { onSearchChange(s); setShowRecents(false); }}
                  >
                    {s}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRecentSearches(removeRecentSearch(s)); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: '0 2px',
                      lineHeight: 1, flexShrink: 0,
                    }}
                    title="Remove"
                  >
                    {'\u2715'}
                  </button>
                </div>
              ))}
            </div>
          )}
          <label
            className="flex items-center gap-1.5 mt-1 cursor-pointer select-none"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
          >
            <input
              type="checkbox"
              checked={contentSearch}
              onChange={onToggleContentSearch}
              style={{ accentColor: 'var(--accent)', width: 12, height: 12 }}
            />
            Search file contents
          </label>
        </div>
      )}

      {/* View content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {loading ? (
            <SkeletonList />
          ) : contentSearch && searchQuery.trim().length >= 2 ? (
            /* Content search results */
            searchLoading ? (
              <SkeletonList />
            ) : searchResults && searchResults.length > 0 ? (
              <div className="py-1">
                <div className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                  {searchResults.length} file{searchResults.length !== 1 ? 's' : ''} matched
                </div>
                {searchResults.map(r => (
                  <FileItem
                    key={r.file.path}
                    file={r.file}
                    selected={selectedPath === r.file.path}
                    starred={favorites.has(r.file.path)}
                    onSelect={onSelectFile}
                    onToggleStar={onToggleStar}
                    snippet={r.snippet}
                    searchQuery={searchQuery}
                    matchCount={r.matchCount}
                  />
                ))}
              </div>
            ) : (
              <div className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                No files contain &ldquo;{searchQuery}&rdquo;
              </div>
            )
          ) : (
            <>
              {view === 'recents' && (
                <RecentsView
                  files={files}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favorites={favorites}
                />
              )}
              {view === 'favorites' && (
                <FavoritesView
                  files={files}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favoriteFolders={favoriteFolders}
                  folders={folders}
                  onToggleFolderStar={onToggleFolderStar}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      {collapsed && <div className="flex-1" />}
      <button
        className="tab-btn mx-auto mb-2 mt-2 text-xs"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ fontSize: 'var(--text-base)' }}
      >
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>
    </aside>
  );
}

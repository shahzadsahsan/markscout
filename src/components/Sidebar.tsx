import { useState } from 'react';
import type { FileEntry, SidebarView, FolderNode, SearchResult, WhatsNewResponse, SmartCollection } from '../lib/types';
import { RecentsView } from './RecentsView';
import { FoldersView } from './FoldersView';
import { FavoritesView } from './FavoritesView';
import { WhatsNewView } from './WhatsNewView';
import { CollectionsView } from './CollectionsView';
import { FileItem } from './FileItem';
import type { RefObject } from 'react';

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
  // V2 props
  favoriteFolders: Set<string>;
  onToggleFolderStar: (folderPath: string) => void;
  expandedGroups: Set<string>;
  onToggleExpand: (folderPath: string) => void;
  excludedPaths: Set<string>;
  onExcludeFolder: (folderPath: string) => void;
  onIncludeFolder: (folderPath: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  customWatchDirs?: string[];
  onRemoveWatchDir?: (dir: string) => void;
  contentSearch: boolean;
  onToggleContentSearch: () => void;
  searchResults: SearchResult[] | null;
  searchLoading: boolean;
  // v0.5
  whatsNewData: WhatsNewResponse | null;
  whatsNewLoading: boolean;
  // v0.6
  collections: SmartCollection[];
  collectionsLoading: boolean;
  onOpenCollections: () => void;
}

const TABS: { view: SidebarView; icon: string; label: string; shortcut: string }[] = [
  { view: 'whats-new', icon: '\u2726', label: 'New', shortcut: '4' },
  { view: 'recents', icon: '\u23F1', label: 'Recents', shortcut: '1' },
  { view: 'folders', icon: '\uD83D\uDCC1', label: 'Folders', shortcut: '2' },
  { view: 'favorites', icon: '\u2B50', label: 'Faves', shortcut: '3' },
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
  expandedGroups,
  onToggleExpand,
  excludedPaths,
  onExcludeFolder,
  onIncludeFolder,
  searchQuery,
  onSearchChange,
  searchInputRef,
  customWatchDirs,
  onRemoveWatchDir,
  contentSearch,
  onToggleContentSearch,
  searchResults,
  searchLoading,
  whatsNewData,
  whatsNewLoading,
  collections,
  collectionsLoading,
  onOpenCollections,
}: SidebarProps) {
  const [showCollections, setShowCollections] = useState(false);

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
        className="flex items-center gap-1 px-2 py-2 border-b"
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
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Search bar */}
      {!collapsed && (
        <div className="px-2 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={contentSearch ? "Search contents... ( / )" : "Filter files... ( / )"}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-2 py-1 text-xs rounded"
            style={{
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              outline: 'none',
            }}
          />
          <label
            className="flex items-center gap-1.5 mt-1 cursor-pointer select-none"
            style={{ fontSize: 10, color: 'var(--text-muted)' }}
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
                <div className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
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
              <div className="px-3 py-6 text-center" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                No files contain &ldquo;{searchQuery}&rdquo;
              </div>
            )
          ) : (
            <>
              {view === 'whats-new' && (
                <WhatsNewView
                  data={whatsNewData}
                  loading={whatsNewLoading}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favorites={favorites}
                />
              )}
              {view === 'recents' && (
                <RecentsView
                  files={files}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favorites={favorites}
                />
              )}
              {view === 'folders' && (
                <FoldersView
                  folders={folders}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favorites={favorites}
                  favoriteFolders={favoriteFolders}
                  onToggleFolderStar={onToggleFolderStar}
                  expandedGroups={expandedGroups}
                  onToggleExpand={onToggleExpand}
                  excludedPaths={excludedPaths}
                  onExcludeFolder={onExcludeFolder}
                  onIncludeFolder={onIncludeFolder}
                  customWatchDirs={customWatchDirs}
                  onRemoveWatchDir={onRemoveWatchDir}
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

      {/* Collections toggle section */}
      {!collapsed && (
        <div
          className="border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button
            onClick={() => {
              const next = !showCollections;
              setShowCollections(next);
              if (next) onOpenCollections();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              fontSize: 10,
              color: 'var(--text-muted)',
              transition: 'color 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span>{showCollections ? '\u25BE' : '\u25B8'} Collections</span>
            {collections.length > 0 && (
              <span style={{ fontSize: 9, opacity: 0.6 }}>{collections.length}</span>
            )}
          </button>
          {showCollections && (
            <div style={{ maxHeight: 240, overflowY: 'auto' }} className="sidebar-scroll">
              <CollectionsView
                collections={collections}
                loading={collectionsLoading}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                onToggleStar={onToggleStar}
                favorites={favorites}
              />
            </div>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      {collapsed && <div className="flex-1" />}
      <button
        className="tab-btn mx-auto mb-2 mt-2 text-xs"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ fontSize: '14px' }}
      >
        {collapsed ? '\u25B6' : '\u25C0'}
      </button>
    </aside>
  );
}

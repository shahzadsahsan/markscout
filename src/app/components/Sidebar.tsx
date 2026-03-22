'use client';

import type { FileEntry, SidebarView, FolderNode } from '@/lib/types';
import { RecentsView } from './RecentsView';
import { FoldersView } from './FoldersView';
import { FavoritesView } from './FavoritesView';
import { HistoryView } from './HistoryView';
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
}

const TABS: { view: SidebarView; icon: string; label: string; shortcut: string }[] = [
  { view: 'recents', icon: '⏱', label: 'Recents', shortcut: '1' },
  { view: 'folders', icon: '📁', label: 'Folders', shortcut: '2' },
  { view: 'favorites', icon: '⭐', label: 'Favorites', shortcut: '3' },
  { view: 'history', icon: '📖', label: 'History', shortcut: '4' },
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
}: SidebarProps) {
  return (
    <aside
      className="flex flex-col border-r h-full shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? '48px' : 'var(--sidebar-width)',
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
            placeholder="Filter files... ( / )"
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
        </div>
      )}

      {/* View content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto sidebar-scroll">
          {loading ? (
            <SkeletonList />
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
                />
              )}
              {view === 'history' && (
                <HistoryView
                  files={files}
                  selectedPath={selectedPath}
                  onSelectFile={onSelectFile}
                  onToggleStar={onToggleStar}
                  favorites={favorites}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <button
        className="tab-btn mx-auto my-2 text-xs"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ fontSize: '14px' }}
      >
        {collapsed ? '▶' : '◀'}
      </button>
    </aside>
  );
}

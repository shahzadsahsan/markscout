'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { FileEntry, FolderNode } from '@/lib/types';
import { FileItem } from './FileItem';

interface FoldersViewProps {
  folders: FolderNode[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
  favoriteFolders: Set<string>;
  onToggleFolderStar: (folderPath: string) => void;
  expandedGroups: Set<string>;
  onToggleExpand: (folderPath: string) => void;
  excludedPaths: Set<string>;
  onExcludeFolder: (folderPath: string) => void;
  onIncludeFolder: (folderPath: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  folderPath: string;
  isExcluded: boolean;
}

function FolderGroup({
  node,
  depth,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
  favoriteFolders,
  onToggleFolderStar,
  expandedGroups,
  onToggleExpand,
  excludedPaths,
  onContextMenu,
}: {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
  favoriteFolders: Set<string>;
  onToggleFolderStar: (folderPath: string) => void;
  expandedGroups: Set<string>;
  onToggleExpand: (folderPath: string) => void;
  excludedPaths: Set<string>;
  onContextMenu: (e: React.MouseEvent, folderPath: string, isExcluded: boolean) => void;
}) {
  const isExpanded = expandedGroups.has(node.path);
  const isFolderStarred = favoriteFolders.has(node.path);
  const isExcluded = excludedPaths.has(node.path);

  // Sort children: favorite folders first, excluded last
  const sortedChildren = [...node.children].sort((a, b) => {
    const aExcluded = excludedPaths.has(a.path);
    const bExcluded = excludedPaths.has(b.path);
    if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
    const aFav = favoriteFolders.has(a.path);
    const bFav = favoriteFolders.has(b.path);
    if (aFav !== bFav) return aFav ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className={isExcluded ? 'folder-excluded' : ''}>
      <div
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[var(--hover-bg)] transition-colors group cursor-pointer"
        style={{ paddingLeft: `${12 + depth * 12}px` }}
        onClick={() => onToggleExpand(node.path)}
        onContextMenu={(e) => onContextMenu(e, node.path, isExcluded)}
      >
        <span
          className="text-[10px] transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span
          className="text-xs font-medium truncate flex-1"
          style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            color: isExcluded ? 'var(--text-muted)' : 'var(--text-muted)',
          }}
        >
          {node.name}
        </span>
        <button
          className={`star-btn text-[10px] opacity-0 group-hover:opacity-100 ${isFolderStarred ? 'starred opacity-100' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFolderStar(node.path);
          }}
          title={isFolderStarred ? 'Unstar folder' : 'Star folder'}
        >
          {isFolderStarred ? '★' : '☆'}
        </button>
        <span
          className="text-[10px] shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {node.fileCount}
        </span>
      </div>

      {isExpanded && !isExcluded && (
        <div>
          {sortedChildren.map(child => (
            <FolderGroup
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onToggleStar={onToggleStar}
              favorites={favorites}
              favoriteFolders={favoriteFolders}
              onToggleFolderStar={onToggleFolderStar}
              expandedGroups={expandedGroups}
              onToggleExpand={onToggleExpand}
              excludedPaths={excludedPaths}
              onContextMenu={onContextMenu}
            />
          ))}
          {node.files.map(file => (
            <FileItem
              key={file.path}
              file={file}
              selected={file.path === selectedPath}
              starred={favorites.has(file.path)}
              onSelect={onSelectFile}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FoldersView({
  folders,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
  favoriteFolders,
  onToggleFolderStar,
  expandedGroups,
  onToggleExpand,
  excludedPaths,
  onExcludeFolder,
  onIncludeFolder,
}: FoldersViewProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, folderPath: string, isExcluded: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, folderPath, isExcluded });
  }, []);

  // Close context menu on click elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Sort root folders: favorites first, excluded last
  const sortedFolders = [...folders].sort((a, b) => {
    const aExcluded = excludedPaths.has(a.path);
    const bExcluded = excludedPaths.has(b.path);
    if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
    const aFav = favoriteFolders.has(a.path);
    const bFav = favoriteFolders.has(b.path);
    if (aFav !== bFav) return aFav ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  if (folders.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No folders found</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {sortedFolders.map(folder => (
        <FolderGroup
          key={folder.path}
          node={folder}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onToggleStar={onToggleStar}
          favorites={favorites}
          favoriteFolders={favoriteFolders}
          onToggleFolderStar={onToggleFolderStar}
          expandedGroups={expandedGroups}
          onToggleExpand={onToggleExpand}
          excludedPaths={excludedPaths}
          onContextMenu={handleContextMenu}
        />
      ))}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.isExcluded ? (
            <button
              className="context-menu-item"
              onClick={() => {
                onIncludeFolder(contextMenu.folderPath);
                setContextMenu(null);
              }}
            >
              ✓ Include this folder
            </button>
          ) : (
            <button
              className="context-menu-item destructive"
              onClick={() => {
                onExcludeFolder(contextMenu.folderPath);
                setContextMenu(null);
              }}
            >
              ✕ Exclude this folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

import type { FileEntry, FolderNode } from '../lib/types';
import { FileItem } from './FileItem';

interface FavoritesViewProps {
  files: FileEntry[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favoriteFolders: Set<string>;
  folders: FolderNode[];
  onToggleFolderStar: (folderPath: string) => void;
}

function findFolderNode(nodes: FolderNode[], path: string): FolderNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = findFolderNode(node.children, path);
    if (found) return found;
  }
  return null;
}

function collectFiles(node: FolderNode): FileEntry[] {
  const result = [...node.files];
  for (const child of node.children) {
    result.push(...collectFiles(child));
  }
  return result.sort((a, b) => b.modifiedAt - a.modifiedAt);
}

export function FavoritesView({
  files,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favoriteFolders,
  folders,
  onToggleFolderStar,
}: FavoritesViewProps) {
  // Collect starred folder nodes
  const starredFolderNodes: { node: FolderNode; files: FileEntry[] }[] = [];
  for (const folderPath of favoriteFolders) {
    const node = findFolderNode(folders, folderPath);
    if (node) {
      starredFolderNodes.push({ node, files: collectFiles(node) });
    }
  }

  const hasStarredFiles = files.length > 0;
  const hasStarredFolders = starredFolderNodes.length > 0;

  if (!hasStarredFiles && !hasStarredFolders) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm" style={{ fontFamily: 'var(--font-ui)' }}>No favorites yet</p>
        <p className="text-xs mt-1">Star files with <code style={{ fontSize: 'var(--text-sm)', padding: '1px 5px', borderRadius: 3, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent)' }}>s</code> or click {'\u2606'} to see them here</p>
      </div>
    );
  }

  return (
    <div className="py-1">
      {/* Starred folders */}
      {starredFolderNodes.map(({ node, files: folderFiles }) => (
        <div key={node.path}>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 group"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-xs font-semibold flex-1 truncate" style={{
              fontFamily: 'var(--font-ui)',
              color: 'var(--text)',
            }}>
              {node.name}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {folderFiles.length} files
            </span>
            <button
              className="star-btn text-[10px] starred"
              onClick={() => onToggleFolderStar(node.path)}
              title="Unstar folder"
            >
              {'\u2605'}
            </button>
          </div>
          {folderFiles.map(file => (
            <FileItem
              key={file.path}
              file={file}
              selected={file.path === selectedPath}
              starred={true}
              onSelect={onSelectFile}
              onToggleStar={onToggleStar}
              indentPx={12}
            />
          ))}
        </div>
      ))}

      {/* Starred files */}
      {hasStarredFiles && hasStarredFolders && (
        <div className="px-3 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Starred files
          </span>
        </div>
      )}
      {files.map(file => (
        <FileItem
          key={file.path}
          file={file}
          selected={file.path === selectedPath}
          starred={true}
          onSelect={onSelectFile}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}

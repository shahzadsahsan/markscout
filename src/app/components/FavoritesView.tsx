'use client';

import type { FileEntry } from '@/lib/types';
import { FileItem } from './FileItem';

interface FavoritesViewProps {
  files: FileEntry[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
}

export function FavoritesView({
  files,
  selectedPath,
  onSelectFile,
  onToggleStar,
}: FavoritesViewProps) {
  if (files.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No favorites yet</p>
        <p className="text-xs mt-1">Click the ☆ on a file to star it</p>
      </div>
    );
  }

  return (
    <div className="py-1">
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

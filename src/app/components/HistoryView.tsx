'use client';

import type { FileEntry } from '@/lib/types';
import { FileItem } from './FileItem';

interface HistoryViewProps {
  files: (FileEntry & { lastOpenedAt?: number })[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
}

export function HistoryView({
  files,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
}: HistoryViewProps) {
  if (files.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        <p className="text-sm">No history yet</p>
        <p className="text-xs mt-1">Open a file to start tracking</p>
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
          starred={favorites.has(file.path)}
          onSelect={onSelectFile}
          onToggleStar={onToggleStar}
          timeField={file.lastOpenedAt}
          timeLabel="opened "
        />
      ))}
    </div>
  );
}

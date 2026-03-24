import { useState, useMemo } from 'react';
import type { FileEntry } from '../lib/types';
import { FileItem, getStalenessOpacity } from './FileItem';

interface RecentsViewProps {
  files: FileEntry[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
}

type TimeFilter = 'all' | '1h' | '3h' | '24h';

const TIME_FILTERS: { key: TimeFilter; label: string; ms: number }[] = [
  { key: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { key: '3h', label: '3h', ms: 3 * 60 * 60 * 1000 },
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: 'all', label: 'All', ms: 0 },
];

export function RecentsView({
  files,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
}: RecentsViewProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');


  const filteredFiles = useMemo(() => {
    if (timeFilter === 'all') return files;
    const threshold = TIME_FILTERS.find(f => f.key === timeFilter)!.ms;
    const cutoff = Date.now() - threshold;
    return files.filter(f => f.modifiedAt >= cutoff);
  }, [files, timeFilter]);

  return (
    <div>
      {/* Time filter pills */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        {TIME_FILTERS.map(f => (
          <button
            key={f.key}
            className={`filter-pill ${timeFilter === f.key ? 'active' : ''}`}
            onClick={() => setTimeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">
            {files.length === 0 ? 'No files found' : `No files modified in the last ${timeFilter}`}
          </p>
          {files.length === 0 && (
            <p className="text-xs mt-1">Add a folder to start reading</p>
          )}
        </div>
      ) : (
        <div className="py-1">
          {filteredFiles.map(file => (
            <FileItem
              key={file.path}
              file={file}
              selected={file.path === selectedPath}
              starred={favorites.has(file.path)}
              onSelect={onSelectFile}
              onToggleStar={onToggleStar}
              stalenessOpacity={getStalenessOpacity(file.modifiedAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

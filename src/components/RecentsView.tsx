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
  const [groupByFolder, setGroupByFolder] = useState(() => localStorage.getItem('markscout-recents-grouped') === 'true');

  const filteredFiles = useMemo(() => {
    if (timeFilter === 'all') return files;
    const threshold = TIME_FILTERS.find(f => f.key === timeFilter)!.ms;
    const cutoff = Date.now() - threshold;
    return files.filter(f => f.modifiedAt >= cutoff);
  }, [files, timeFilter]);

  const groupedFiles = useMemo(() => {
    if (!groupByFolder) return null;
    const groups = new Map<string, FileEntry[]>();
    for (const f of filteredFiles) {
      const arr = groups.get(f.project) || [];
      arr.push(f);
      groups.set(f.project, arr);
    }
    return [...groups.entries()]
      .map(([project, files]) => ({ project, files, latestMod: Math.max(...files.map(f => f.modifiedAt)) }))
      .sort((a, b) => b.latestMod - a.latestMod);
  }, [filteredFiles, groupByFolder]);

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
        <button
          className={`filter-pill ${groupByFolder ? 'active' : ''}`}
          onClick={() => {
            setGroupByFolder(prev => {
              const next = !prev;
              localStorage.setItem('markscout-recents-grouped', String(next));
              return next;
            });
          }}
          title="Group by folder"
        >
          {'\uD83D\uDCC2'}
        </button>
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
      ) : groupByFolder && groupedFiles ? (
        <div className="py-1">
          {groupedFiles.map(group => (
            <div key={group.project}>
              <div
                className="px-3 py-1.5 flex items-center gap-2"
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <span>{'\uD83D\uDCC2'}</span>
                <span>{group.project}</span>
                <span style={{ fontSize: 9, opacity: 0.5 }}>{group.files.length}</span>
              </div>
              {group.files.map(file => (
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
          ))}
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

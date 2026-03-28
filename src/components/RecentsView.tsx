import { useState, useMemo, useCallback } from 'react';
import type { FileEntry } from '../lib/types';
import { FileItem, getStalenessOpacity } from './FileItem';
import { getProjectColor } from '../lib/projectColors';

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

const PREVIEW_COUNT = 3; // Files shown per group before "show more"

export function RecentsView({
  files,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
}: RecentsViewProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [groupByFolder, setGroupByFolder] = useState(() => localStorage.getItem('markscout-recents-grouped') === 'true');
  // Tracks which groups are fully expanded (show all files)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((project: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(project)) next.delete(project);
      else next.add(project);
      return next;
    });
  }, []);

  const filteredFiles = useMemo(() => {
    let result = files;
    if (timeFilter !== 'all') {
      const threshold = TIME_FILTERS.find(f => f.key === timeFilter)!.ms;
      const cutoff = Date.now() - threshold;
      result = result.filter(f => f.modifiedAt >= cutoff);
    }
    return result;
  }, [files, timeFilter]);

  // Smart groups: project → files, sorted by most recent project first
  const groupedFiles = useMemo(() => {
    if (!groupByFolder) return null;
    const groups = new Map<string, FileEntry[]>();
    for (const f of filteredFiles) {
      const arr = groups.get(f.project) || [];
      arr.push(f);
      groups.set(f.project, arr);
    }
    return [...groups.entries()]
      .map(([project, gFiles]) => ({
        project,
        files: gFiles,
        latestMod: Math.max(...gFiles.map(f => f.modifiedAt)),
      }))
      .sort((a, b) => b.latestMod - a.latestMod);
  }, [filteredFiles, groupByFolder]);

  return (
    <div>
      {/* Filter pills */}
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
        <div style={{ flex: 1 }} />
        <button
          className={`filter-pill ${!groupByFolder ? 'active' : ''}`}
          onClick={() => {
            setGroupByFolder(false);
            localStorage.setItem('markscout-recents-grouped', 'false');
          }}
        >
          Sort: Recent
        </button>
        <button
          className={`filter-pill ${groupByFolder ? 'active' : ''}`}
          onClick={() => {
            setGroupByFolder(true);
            localStorage.setItem('markscout-recents-grouped', 'true');
            setExpandedGroups(new Set());
          }}
        >
          Sort: Folder
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
        /* Smart grouped view: colored header + latest 3 files + expand */
        <div className="py-1">
          {groupedFiles.map(group => {
            const isExpanded = expandedGroups.has(group.project);
            const visibleFiles = isExpanded ? group.files : group.files.slice(0, PREVIEW_COUNT);
            const hiddenCount = group.files.length - PREVIEW_COUNT;
            const color = getProjectColor(group.project);

            return (
              <div key={group.project} style={{ marginBottom: 2 }}>
                {/* Project header with colored left bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px 5px',
                    borderLeft: `4px solid ${color}`,
                    background: 'var(--bg)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      color: color,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {group.project}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {group.files.length}
                  </span>
                </div>

                {/* Visible files */}
                {visibleFiles.map(file => (
                  <FileItem
                    key={file.path}
                    file={file}
                    selected={file.path === selectedPath}
                    starred={favorites.has(file.path)}
                    onSelect={onSelectFile}
                    onToggleStar={onToggleStar}
                    stalenessOpacity={getStalenessOpacity(file.modifiedAt)}
                    hideProject
                  />
                ))}

                {/* Show more / less toggle */}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => toggleExpand(group.project)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '4px 12px 6px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-ui)',
                      color: color,
                      textAlign: 'left',
                      opacity: 0.8,
                      transition: 'opacity 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                  >
                    {isExpanded ? '\u25B4 Show less' : `\u25BE +${hiddenCount} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Flat list (default) */
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

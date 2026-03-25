import { memo } from 'react';
import type { FileEntry } from '../lib/types';

interface FileItemProps {
  file: FileEntry;
  selected: boolean;
  starred: boolean;
  onSelect: (path: string) => void;
  onToggleStar: (path: string) => void;
  timeField?: number;
  timeLabel?: string;
  indentPx?: number;    // Extra left padding for tree hierarchy
  hideProject?: boolean; // Suppress project badge (redundant in folder tree)
  snippet?: string;      // Content search match snippet
  searchQuery?: string;  // The query term to highlight in snippet
  matchCount?: number;   // Number of matches in file
  badge?: 'new' | 'updated' | null; // v0.5: change badge
  stalenessOpacity?: number; // v0.5: staleness visual indicator (0-1)
}

function formatRelativeTime(epochMs: number): string {
  const diff = Date.now() - epochMs;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts: { text: string; highlight: boolean }[] = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(qLower, cursor);
    if (idx === -1) {
      parts.push({ text: text.slice(cursor), highlight: false });
      break;
    }
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    cursor = idx + query.length;
  }
  return (
    <>
      {parts.map((p, i) =>
        p.highlight
          ? <span key={i} style={{ color: 'var(--accent)', fontWeight: 600 }}>{p.text}</span>
          : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

/** Calculate staleness opacity from modifiedAt timestamp */
export function getStalenessOpacity(modifiedAt: number): number {
  const diff = Date.now() - modifiedAt;
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;

  if (diff < HOUR) return 1.0;
  if (diff < DAY) return 0.9;
  if (diff < WEEK) return 0.75;
  if (diff < MONTH) return 0.6;
  return 0.5;
}

export const FileItem = memo(function FileItem({
  file,
  selected,
  starred,
  onSelect,
  onToggleStar,
  timeField,
  timeLabel,
  indentPx,
  hideProject,
  snippet,
  searchQuery,
  matchCount,
  badge,
  stalenessOpacity,
}: FileItemProps) {
  const timestamp = timeField || file.modifiedAt;
  const label = timeLabel || '';

  return (
    <div
      className={`file-item ${selected ? 'active' : ''}`}
      data-selected={selected || undefined}
      onClick={() => onSelect(file.path)}
      style={{
        ...(indentPx !== undefined ? { paddingLeft: `${indentPx}px` } : {}),
        ...(stalenessOpacity !== undefined && stalenessOpacity < 1 ? { opacity: stalenessOpacity } : {}),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate flex items-center gap-2"
            style={{ fontFamily: 'var(--font-ui)', color: 'var(--text)' }}
          >
            <span className="truncate">{file.name}</span>
            {badge === 'new' && <span className="badge-new">NEW</span>}
            {badge === 'updated' && <span className="badge-updated">UPDATED</span>}
          </div>
          <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
            <span className="truncate">{label}{formatRelativeTime(timestamp)}</span>
            {matchCount !== undefined && matchCount > 0 && (
              <span style={{ color: 'var(--accent)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
          {snippet && (
            <div
              className="text-xs mt-1 line-clamp-2"
              style={{
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
                lineHeight: 1.4,
                opacity: 0.8,
              }}
            >
              <HighlightedSnippet text={snippet} query={searchQuery || ''} />
            </div>
          )}
        </div>
        <button
          className={`star-btn shrink-0 ${starred ? 'starred' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleStar(file.path); }}
          title={starred ? 'Remove star' : 'Star file'}
        >
          {starred ? '\u2605' : '\u2606'}
        </button>
      </div>
    </div>
  );
});

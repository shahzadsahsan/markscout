'use client';

import { memo } from 'react';
import type { FileEntry } from '@/lib/types';

interface FileItemProps {
  file: FileEntry;
  selected: boolean;
  starred: boolean;
  onSelect: (path: string) => void;
  onToggleStar: (path: string) => void;
  timeField?: number; // Override timestamp (e.g., lastOpenedAt for history)
  timeLabel?: string; // Override label (e.g., "opened" for history)
}

/**
 * Format a timestamp as a relative time string.
 */
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

// Mitigation #8: React.memo prevents re-render of 610 items on every SSE event
export const FileItem = memo(function FileItem({
  file,
  selected,
  starred,
  onSelect,
  onToggleStar,
  timeField,
  timeLabel,
}: FileItemProps) {
  const timestamp = timeField || file.modifiedAt;
  const label = timeLabel || '';

  return (
    <div
      className={`file-item ${selected ? 'active' : ''}`}
      data-selected={selected || undefined}
      onClick={() => onSelect(file.path)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-medium truncate"
            style={{
              fontFamily: 'var(--font-jetbrains-mono), monospace',
              color: selected ? 'var(--text)' : 'var(--text)',
            }}
          >
            {file.name}
          </div>
          <div
            className="text-xs mt-0.5 flex items-center gap-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            <span
              className="px-1 py-0.5 rounded text-[10px]"
              style={{ background: 'var(--active-bg)', color: 'var(--text-muted)' }}
            >
              {file.project}
            </span>
            <span>{label}{formatRelativeTime(timestamp)}</span>
          </div>
        </div>
        <button
          className={`star-btn ${starred ? 'starred' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar(file.path);
          }}
          title={starred ? 'Remove star' : 'Star file'}
        >
          {starred ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
});

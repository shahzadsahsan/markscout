import type { FileEntry, WhatsNewResponse } from '../lib/types';
import { FileItem } from './FileItem';

interface WhatsNewViewProps {
  data: WhatsNewResponse | null;
  loading: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
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

export function WhatsNewView({
  data,
  loading,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
}: WhatsNewViewProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.totalChanges === 0) {
    return (
      <div className="p-6 text-center">
        <div
          style={{
            fontSize: 28,
            marginBottom: 8,
            opacity: 0.4,
          }}
        >
          {'\u2713'}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            marginBottom: 4,
          }}
        >
          Everything's up to date
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', opacity: 0.6 }}>
          No changes since your last session
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        className="px-3 py-2 border-b"
        style={{
          borderColor: 'var(--border)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          Since your last session
          {data.lastSessionAt && (
            <span style={{ marginLeft: 6, opacity: 0.7 }}>
              {formatRelativeTime(data.lastSessionAt)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent)', marginTop: 2 }}>
          {data.totalChanges} change{data.totalChanges !== 1 ? 's' : ''}
        </div>
      </div>

      {/* New files */}
      {data.newFiles.length > 0 && (
        <div>
          {data.newFiles.map(group => (
            <div key={`new-${group.project}`}>
              <div
                className="px-3 py-1.5 flex items-center justify-between"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  background: 'var(--bg)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <span>{group.project}</span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    fontWeight: 600,
                  }}
                >
                  {group.files.length}
                </span>
              </div>
              {group.files
                .sort((a, b) => b.modifiedAt - a.modifiedAt)
                .map(file => (
                  <FileItem
                    key={file.path}
                    file={file}
                    selected={file.path === selectedPath}
                    starred={favorites.has(file.path)}
                    onSelect={onSelectFile}
                    onToggleStar={onToggleStar}
                    badge="new"
                  />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Updated files */}
      {data.updatedFiles.length > 0 && (
        <div>
          {data.updatedFiles.map(group => (
            <div key={`updated-${group.project}`}>
              <div
                className="px-3 py-1.5 flex items-center justify-between"
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  background: 'var(--bg)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <span>{group.project}</span>
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: 'var(--hover-bg)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {group.files.length}
                </span>
              </div>
              {group.files
                .sort((a, b) => b.modifiedAt - a.modifiedAt)
                .map(file => (
                  <FileItem
                    key={file.path}
                    file={file}
                    selected={file.path === selectedPath}
                    starred={favorites.has(file.path)}
                    onSelect={onSelectFile}
                    onToggleStar={onToggleStar}
                    badge="updated"
                  />
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

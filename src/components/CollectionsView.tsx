import { useState } from 'react';
import type { SmartCollection } from '../lib/types';
import { FileItem } from './FileItem';

interface CollectionsViewProps {
  collections: SmartCollection[];
  loading: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleStar: (path: string) => void;
  favorites: Set<string>;
}

export function CollectionsView({
  collections,
  loading,
  selectedPath,
  onSelectFile,
  onToggleStar,
  favorites,
}: CollectionsViewProps) {
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        No collections available
      </div>
    );
  }

  const activeCollection = activeCollectionId
    ? collections.find(c => c.id === activeCollectionId)
    : null;

  if (activeCollection) {
    return (
      <div>
        <button
          className="flex items-center gap-1.5 px-3 py-2 w-full text-left border-b"
          style={{
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onClick={() => setActiveCollectionId(null)}
        >
          <span style={{ fontSize: 'var(--text-sm)' }}>{'\u2190'}</span>
          <span>{activeCollection.icon} {activeCollection.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', opacity: 0.6 }}>
            {activeCollection.count}
          </span>
        </button>
        <div className="py-1">
          {activeCollection.files.map(file => (
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
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-2">
        {collections.map(collection => (
          <button
            key={collection.id}
            className="collection-card"
            onClick={() => setActiveCollectionId(collection.id)}
          >
            <span style={{ fontSize: 16 }}>{collection.icon}</span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {collection.label}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {collection.count} file{collection.count !== 1 ? 's' : ''}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import type { FilterPresetId } from '@/lib/types';

interface PresetInfo {
  id: FilterPresetId;
  label: string;
  description: string;
  matchCount: number;
  active: boolean;
}

interface PreferencesPanelProps {
  open: boolean;
  onClose: () => void;
  onPresetsChanged: () => void;
}

export function PreferencesPanel({ open, onClose, onPresetsChanged }: PreferencesPanelProps) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [watchDirs, setWatchDirs] = useState<string[]>([]);
  const [customDirs, setCustomDirs] = useState<string[]>([]);
  const [newDir, setNewDir] = useState('');
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/preferences')
      .then(r => r.json())
      .then(data => {
        setPresets(data.presets || []);
        setWatchDirs(data.watchDirs || []);
        setCustomDirs(data.customWatchDirs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the panel
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  const handleTogglePreset = async (presetId: FilterPresetId) => {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ togglePreset: presetId }),
    });
    const data = await res.json();
    setPresets(prev =>
      prev.map(p => p.id === presetId ? { ...p, active: data.active } : p)
    );
    onPresetsChanged();
  };

  const handleAddDir = async () => {
    const dir = newDir.trim();
    if (!dir) return;
    // Expand ~ to home dir
    const expanded = dir.startsWith('~') ? dir : dir;
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addWatchDir: expanded }),
    });
    setCustomDirs(prev => [...prev, expanded]);
    setNewDir('');
  };

  const handleRemoveDir = async (dir: string) => {
    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeWatchDir: dir }),
    });
    setCustomDirs(prev => prev.filter(d => d !== dir));
  };

  if (!open) return null;

  const activeCount = presets.filter(p => p.active).length;
  const hiddenCount = presets.filter(p => p.active).reduce((sum, p) => sum + p.matchCount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        ref={panelRef}
        className="w-full max-w-lg rounded-xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            className="text-sm font-semibold"
            style={{ fontFamily: 'var(--font-jetbrains-mono), monospace', color: 'var(--text)' }}
          >
            Preferences
          </h2>
          <button
            className="tab-btn text-xs"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="p-5">
              <div className="skeleton h-4 w-1/3 mb-3" />
              <div className="skeleton h-8 w-full mb-2" />
              <div className="skeleton h-8 w-full mb-2" />
              <div className="skeleton h-8 w-full" />
            </div>
          ) : (
            <>
              {/* Filter presets section */}
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h3
                    className="text-xs font-medium uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Filter Categories
                  </h3>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {activeCount} active · hiding {hiddenCount} files
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                      style={{
                        background: preset.active ? 'var(--active-bg)' : 'transparent',
                        border: `1px solid ${preset.active ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                      onClick={() => handleTogglePreset(preset.id)}
                    >
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center text-[10px] shrink-0"
                        style={{
                          background: preset.active ? 'var(--accent)' : 'transparent',
                          border: `1.5px solid ${preset.active ? 'var(--accent)' : 'var(--border)'}`,
                          color: preset.active ? 'var(--bg)' : 'transparent',
                        }}
                      >
                        ✓
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-medium"
                            style={{
                              fontFamily: 'var(--font-jetbrains-mono), monospace',
                              color: 'var(--text)',
                            }}
                          >
                            {preset.label}
                          </span>
                          {preset.matchCount > 0 && (
                            <span
                              className="text-[10px] px-1.5 rounded"
                              style={{
                                background: preset.active ? 'rgba(212,160,74,0.2)' : 'var(--hover-bg)',
                                color: preset.active ? 'var(--accent)' : 'var(--text-muted)',
                              }}
                            >
                              {preset.matchCount}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {preset.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Watch directories section */}
              <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3
                  className="text-xs font-medium uppercase tracking-wider mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Watch Directories
                </h3>

                <div className="flex flex-col gap-1.5 mb-3">
                  {watchDirs.map(dir => {
                    const isCustom = customDirs.includes(dir);
                    return (
                      <div
                        key={dir}
                        className="flex items-center gap-2 px-3 py-1.5 rounded"
                        style={{ background: 'var(--hover-bg)' }}
                      >
                        <span
                          className="text-xs flex-1 truncate"
                          style={{
                            fontFamily: 'var(--font-jetbrains-mono), monospace',
                            color: 'var(--text)',
                          }}
                        >
                          {dir.replace(/^\/Users\/[^/]+/, '~')}
                        </span>
                        {isCustom ? (
                          <button
                            className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--border)]"
                            style={{ color: '#f87171' }}
                            onClick={() => handleRemoveDir(dir)}
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            default
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add folder path (e.g. ~/Documents/notes)"
                    value={newDir}
                    onChange={(e) => setNewDir(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddDir(); }}
                    className="flex-1 px-2 py-1.5 text-xs rounded"
                    style={{
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: '1px solid var(--border)',
                      fontFamily: 'var(--font-jetbrains-mono), monospace',
                      outline: 'none',
                    }}
                  />
                  <button
                    className="filter-pill active text-xs"
                    onClick={handleAddDir}
                    style={{ padding: '4px 12px' }}
                  >
                    Add
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    className="filter-pill text-xs"
                    onClick={async () => {
                      // Use Electron IPC if available, otherwise fall back to text input
                      if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).electronAPI) {
                        const api = (window as unknown as Record<string, { selectFolder: () => Promise<string | null> }>).electronAPI;
                        const dir = await api.selectFolder();
                        if (dir) {
                          await fetch('/api/preferences', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ addWatchDir: dir }),
                          });
                          setCustomDirs(prev => [...prev, dir]);
                        }
                      } else {
                        // Focus the text input as fallback
                        const input = document.querySelector<HTMLInputElement>('input[placeholder*="folder path"]');
                        input?.focus();
                      }
                    }}
                    style={{ padding: '4px 12px' }}
                  >
                    📂 Browse...
                  </button>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Directories are watched immediately.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

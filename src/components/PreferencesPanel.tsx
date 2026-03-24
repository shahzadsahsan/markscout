import { useState, useEffect, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { FilterPresetId } from '../lib/types';
import { api } from '../lib/api';
import { TYPOGRAPHY_PRESETS, getTypographyPreset, applyTypographyPreset, loadSavedTypography, saveTypography } from '../lib/typography';

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

export function PreferencesPanel({ open: isOpen, onClose, onPresetsChanged }: PreferencesPanelProps) {
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [watchDirs, setWatchDirs] = useState<string[]>([]);
  const [customDirs, setCustomDirs] = useState<string[]>([]);
  const [disabledDirs, setDisabledDirs] = useState<Set<string>>(new Set());
  const [minFileLength, setMinFileLength] = useState(0);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const minFileLengthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTypography, setActiveTypography] = useState(() => loadSavedTypography());

  const handleTypographyChange = (id: string) => {
    setActiveTypography(id);
    saveTypography(id);
    const preset = getTypographyPreset(id);
    applyTypographyPreset(preset);
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api.getPreferences()
      .then(data => {
        setPresets(data.presets || []);
        setWatchDirs(data.customWatchDirs || []);
        setCustomDirs(data.customWatchDirs || []);
        setMinFileLength(data.minFileLength || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const timeout = setTimeout(() => document.addEventListener('mousedown', handler), 100);
    return () => { clearTimeout(timeout); document.removeEventListener('mousedown', handler); };
  }, [isOpen, onClose]);

  const handleTogglePreset = async (presetId: FilterPresetId) => {
    const data = await api.togglePreset(presetId);
    setPresets(prev => prev.map(p => p.id === presetId ? { ...p, active: data.active } : p));
    onPresetsChanged();
  };

  const handleHideAll = async (ids: FilterPresetId[]) => {
    for (const id of ids) {
      const preset = presets.find(p => p.id === id);
      if (preset && !preset.active) {
        const data = await api.togglePreset(id);
        setPresets(prev => prev.map(p => p.id === id ? { ...p, active: data.active } : p));
      }
    }
    onPresetsChanged();
  };

  const handleRemoveDir = async (dir: string) => {
    await api.removeWatchDir(dir);
    setWatchDirs(prev => prev.filter(d => d !== dir));
    setCustomDirs(prev => prev.filter(d => d !== dir));
    onPresetsChanged();
  };

  const handleToggleDir = async (dir: string) => {
    const isCurrentlyDisabled = disabledDirs.has(dir);
    if (isCurrentlyDisabled) {
      await api.addWatchDir(dir);
      setDisabledDirs(prev => { const n = new Set(prev); n.delete(dir); return n; });
      if (!watchDirs.includes(dir)) setWatchDirs(prev => [...prev, dir]);
    } else {
      await api.removeWatchDir(dir);
      setDisabledDirs(prev => new Set(prev).add(dir));
      setWatchDirs(prev => prev.filter(d => d !== dir));
    }
    onPresetsChanged();
  };

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      await api.addWatchDir(selected as string);
      setCustomDirs(prev => [...prev, selected as string]);
      setWatchDirs(prev => [...prev, selected as string]);
      onPresetsChanged();
    }
  };

  if (!isOpen) return null;

  const activeCount = presets.filter(p => p.active).length;
  const hiddenCount = presets.filter(p => p.active).reduce((sum, p) => sum + p.matchCount, 0);
  const allDirs = [...new Set([...watchDirs, ...Array.from(disabledDirs)])];

  const genericPresets = presets.filter(p => !p.id.startsWith('claude-'));
  const claudePresets = presets.filter(p => p.id.startsWith('claude-'));
  const claudeUnhidden = claudePresets.filter(p => !p.active && p.matchCount > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        ref={panelRef}
        className="w-full max-w-lg rounded-xl border overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>
            Preferences
          </h2>
          <button className="tab-btn text-xs" onClick={onClose}>{'\u2715'}</button>
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
              {/* Typography presets */}
              <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Typography
                </h3>
                <div className="grid grid-cols-5 gap-2">
                  {TYPOGRAPHY_PRESETS.map(tp => {
                    const isActive = activeTypography === tp.id;
                    return (
                      <button
                        key={tp.id}
                        onClick={() => handleTypographyChange(tp.id)}
                        className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg transition-colors text-center"
                        style={{
                          border: `1.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                          background: isActive ? 'var(--active-bg)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <span className="text-[10px] font-medium" style={{ fontFamily: 'var(--font-ui)', color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                          {tp.label}
                        </span>
                        <span className="text-[9px] leading-tight" style={{ fontFamily: tp.vars['--font-body'], color: 'var(--text-muted)' }}>
                          The quick brown fox
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Noise filters — redesigned */}
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between mb-1">
                  <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Noise Filter
                  </h3>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {hiddenCount} files hidden
                  </span>
                </div>
                <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
                  Toggle the eye to hide file types from the sidebar. Hidden files are filtered out, not deleted.
                </p>

                {/* Min file length */}
                <div
                  className="px-3 py-2.5 rounded-lg mb-3"
                  style={{ border: `1px solid ${minFileLength > 0 ? 'var(--accent)' : 'var(--border)'}`, background: minFileLength > 0 ? 'var(--active-bg)' : 'transparent' }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium" style={{ fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>
                      Minimum file size
                    </span>
                    <span className="text-[10px]" style={{ color: minFileLength > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {minFileLength === 0 ? 'Off' : minFileLength < 1024 ? `${minFileLength} B` : `${(minFileLength / 1024).toFixed(1)} KB`}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={5120} step={64} value={minFileLength}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMinFileLength(val);
                      if (minFileLengthTimer.current) clearTimeout(minFileLengthTimer.current);
                      minFileLengthTimer.current = setTimeout(() => {
                        api.setMinFileLength(val).then(() => onPresetsChanged()).catch(() => {});
                      }, 300);
                    }}
                    className="w-full" style={{ accentColor: 'var(--accent)', height: 4 }}
                  />
                </div>

                {/* General presets — compact row */}
                {genericPresets.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>General</p>
                    <div className="flex flex-col gap-1">
                      {genericPresets.map(preset => (
                        <button
                          key={preset.id}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            opacity: preset.matchCount === 0 && !preset.active ? 0.35 : 1,
                          }}
                          onClick={() => handleTogglePreset(preset.id)}
                        >
                          {/* Eye icon — visible or hidden */}
                          <span className="text-sm shrink-0" style={{ opacity: 0.8, filter: preset.active ? 'none' : 'grayscale(1)' }}>
                            {preset.active ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}
                          </span>
                          <span className="text-xs flex-1" style={{ fontFamily: 'var(--font-ui)', color: preset.active ? 'var(--text-muted)' : 'var(--text)', textDecoration: preset.active ? 'line-through' : 'none' }}>
                            {preset.label}
                          </span>
                          {preset.matchCount > 0 && (
                            <span className="text-[10px] px-1.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                              {preset.matchCount}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Claude Code presets — with "hide all" shortcut */}
                {claudePresets.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Claude Code</p>
                      {claudeUnhidden > 0 && (
                        <button
                          className="text-[10px] px-2 py-0.5 rounded transition-colors"
                          style={{ color: 'var(--accent)', background: 'var(--hover-bg)', border: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => handleHideAll(claudePresets.filter(p => !p.active).map(p => p.id))}
                        >
                          Hide all agent files
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
                      Agent internals — skills, sessions, pipeline artifacts, memory. Usually safe to hide.
                    </p>
                    <div className="flex flex-col gap-1">
                      {claudePresets.map(preset => (
                        <button
                          key={preset.id}
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition-all"
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            opacity: preset.matchCount === 0 && !preset.active ? 0.35 : 1,
                          }}
                          onClick={() => handleTogglePreset(preset.id)}
                        >
                          <span className="text-sm shrink-0" style={{ opacity: 0.8, filter: preset.active ? 'none' : 'grayscale(1)' }}>
                            {preset.active ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}
                          </span>
                          <span className="text-xs flex-1" style={{ fontFamily: 'var(--font-ui)', color: preset.active ? 'var(--text-muted)' : 'var(--text)', textDecoration: preset.active ? 'line-through' : 'none' }}>
                            {preset.label}
                          </span>
                          {preset.matchCount > 0 && (
                            <span className="text-[10px] px-1.5 rounded" style={{ background: 'var(--hover-bg)', color: 'var(--text-muted)' }}>
                              {preset.matchCount}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Watch directories */}
              <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Watch Directories
                </h3>

                <div className="flex flex-col gap-1.5 mb-3">
                  {allDirs.map(dir => {
                    const isDisabled = disabledDirs.has(dir);
                    return (
                      <div
                        key={dir}
                        className="flex items-center gap-2 px-3 py-1.5 rounded group"
                        style={{ background: 'var(--hover-bg)', opacity: isDisabled ? 0.5 : 1 }}
                      >
                        <span
                          className="text-xs flex-1 truncate"
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: isDisabled ? 'var(--text-muted)' : 'var(--text)',
                            textDecoration: isDisabled ? 'line-through' : 'none',
                          }}
                        >
                          {dir.replace(/^\/Users\/[^/]+/, '~')}
                        </span>
                        <button
                          className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--border)] transition-colors"
                          style={{ color: isDisabled ? 'var(--accent)' : 'var(--text-muted)' }}
                          onClick={() => handleToggleDir(dir)}
                        >
                          {isDisabled ? 'Enable' : 'Disable'}
                        </button>
                        <button
                          className="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--border)] transition-colors"
                          style={{ color: '#f87171' }}
                          onClick={() => handleRemoveDir(dir)}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  className="filter-pill text-xs"
                  onClick={handleBrowse}
                  style={{ padding: '4px 12px' }}
                >
                  + Add Folder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

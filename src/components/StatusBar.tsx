const MIN_LINES_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 20, label: '20+ lines' },
  { value: 50, label: '50+ lines' },
  { value: 100, label: '100+ lines' },
  { value: 200, label: '200+ lines' },
  { value: 500, label: '500+ lines' },
];

interface StatusBarProps {
  totalFiles: number;
  filteredCount: number;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  scanComplete: boolean;
  minLines: number;
  onChangeMinLines: (n: number) => void;
}

export function StatusBar({
  totalFiles,
  filteredCount,
  scanComplete,
  minLines,
  onChangeMinLines,
}: StatusBarProps) {
  return (
    <footer
      className="flex items-center justify-between px-4 py-1.5 text-xs border-t shrink-0"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-jetbrains-mono), monospace',
      }}
    >
      <div className="flex items-center gap-3">
        <span>
          {scanComplete
            ? `${totalFiles} files`
            : `Scanning... ${totalFiles} files`}
        </span>
        {filteredCount > 0 && (
          <span>
            {'\u00B7'} {filteredCount} filtered
          </span>
        )}

        {/* Line count filter */}
        <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span>{'\u00B7'}</span>
          <select
            value={minLines}
            onChange={e => onChangeMinLines(Number(e.target.value))}
            style={{
              background: 'transparent',
              color: minLines > 0 ? 'var(--accent)' : 'var(--text-muted)',
              border: 'none',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              cursor: 'pointer',
              outline: 'none',
              padding: '0 2px',
            }}
            title="Minimum line count filter"
          >
            {MIN_LINES_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
      </div>
    </footer>
  );
}

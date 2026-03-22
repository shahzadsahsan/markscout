'use client';

interface StatusBarProps {
  totalFiles: number;
  filteredCount: number;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  scanComplete: boolean;
  onOpenPreferences: () => void;
}

export function StatusBar({
  totalFiles,
  filteredCount,
  scanComplete,
  onOpenPreferences,
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
          <span>· {filteredCount} filtered</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="tab-btn text-xs py-0 px-1"
          onClick={onOpenPreferences}
          title="Preferences"
          style={{ fontSize: '12px' }}
        >
          ⚙ Settings
        </button>
      </div>
    </footer>
  );
}

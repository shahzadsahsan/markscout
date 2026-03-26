import { Component, type ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import AppShell from './components/AppShell';

function writeCrashLog(entry: string) {
  invoke('write_crash_log', { entry }).catch(() => {});
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
  stack: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: '', stack: '' };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      error: `${error.name}: ${error.message}`,
      stack: error.stack || '',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const entry = [
      `[${new Date().toISOString()}] REACT CRASH`,
      `Error: ${error.name}: ${error.message}`,
      `Stack: ${error.stack}`,
      `Component: ${info.componentStack}`,
    ].join('\n');
    console.error('[MarkScout]', entry);
    writeCrashLog(entry);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'system-ui',
          padding: 40, textAlign: 'center',
        }}>
          <h1 style={{ fontSize: 20, marginBottom: 12, color: '#d4a04a' }}>MarkScout crashed</h1>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 12, maxWidth: 600 }}>
            {this.state.error}
          </p>
          <pre style={{
            fontSize: 10, color: '#666', maxWidth: 600, maxHeight: 200,
            overflow: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap',
            background: '#111', padding: 12, borderRadius: 6, marginBottom: 20,
            border: '1px solid #2a2a2a', width: '100%',
          }}>
            {this.state.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: '', stack: '' }); }}
            style={{
              padding: '8px 20px', background: '#1e1e1e', border: '1px solid #2a2a2a',
              color: '#e0e0e0', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            }}
          >
            Try again
          </button>
          <p style={{ fontSize: 11, color: '#555', marginTop: 16 }}>
            Crash log written to ~/.markscout/crash.log
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}

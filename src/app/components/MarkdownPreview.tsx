'use client';

import { useMemo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FileContentResponse } from '@/lib/types';

// Color palette definitions
export type PaletteId = 'parchment-dusk' | 'deep-ocean' | 'rosewood' | 'terminal-green' | 'warm-paper' | 'nord-frost' | 'monokai' | 'solarized-dark' | 'catppuccin';

export interface Palette {
  id: PaletteId;
  label: string;
  category: string;
  vars: Record<string, string>;
}

export const PALETTES: Palette[] = [
  {
    id: 'parchment-dusk', label: 'Parchment Dusk', category: 'Subtle',
    vars: {
      '--prose-h1': '#f5e6c8', '--prose-h2': '#e8d5a3', '--prose-h3': '#d4a8a8',
      '--prose-h4': '#9aad8b', '--prose-h5': '#8a9daa', '--prose-bold': '#f5edd8',
      '--prose-italic': '#c8b5d8', '--prose-code': '#6fc4af', '--prose-blockquote': '#a89a88',
      '--prose-list-marker': '#c89838', '--prose-th': '#b89a6a',
      '--text': '#e8e0d4', '--bg': '#0d0d0d',
      '--code-bg': '#111111', '--border': '#2a2a2a', '--surface': '#161616',
    },
  },
  {
    id: 'deep-ocean', label: 'Deep Ocean', category: 'Codery',
    vars: {
      '--prose-h1': '#7dd3fc', '--prose-h2': '#67b8f0', '--prose-h3': '#93c5fd',
      '--prose-h4': '#6ee7b7', '--prose-h5': '#a5b4fc', '--prose-bold': '#e0f2fe',
      '--prose-italic': '#c4b5fd', '--prose-code': '#34d399', '--prose-blockquote': '#64748b',
      '--prose-list-marker': '#38bdf8', '--prose-th': '#5eadd5',
      '--text': '#cdd6e4', '--bg': '#0b1022',
      '--code-bg': '#0d1330', '--border': '#1e2d4a', '--surface': '#101830',
    },
  },
  {
    id: 'rosewood', label: 'Rosewood', category: 'Warm',
    vars: {
      '--prose-h1': '#f0b4b4', '--prose-h2': '#e8a0a0', '--prose-h3': '#dba080',
      '--prose-h4': '#b8c898', '--prose-h5': '#a0a8c0', '--prose-bold': '#f5e0e0',
      '--prose-italic': '#d4a0c8', '--prose-code': '#e0a870', '--prose-blockquote': '#988080',
      '--prose-list-marker': '#d88888', '--prose-th': '#c89090',
      '--text': '#e8d8d4', '--bg': '#180e0e',
      '--code-bg': '#1c1010', '--border': '#3a2424', '--surface': '#201414',
    },
  },
  {
    id: 'terminal-green', label: 'Terminal', category: 'Codery',
    vars: {
      '--prose-h1': '#4ade80', '--prose-h2': '#22c55e', '--prose-h3': '#86efac',
      '--prose-h4': '#a3e635', '--prose-h5': '#34d399', '--prose-bold': '#d9f99d',
      '--prose-italic': '#67e8f9', '--prose-code': '#4ade80', '--prose-blockquote': '#4b5563',
      '--prose-list-marker': '#22c55e', '--prose-th': '#38a85c',
      '--text': '#b8e0c4', '--bg': '#050f05',
      '--code-bg': '#061008', '--border': '#143018', '--surface': '#0a1a0c',
    },
  },
  {
    id: 'warm-paper', label: 'Warm Paper', category: 'Minimal',
    vars: {
      '--prose-h1': '#c8a878', '--prose-h2': '#b89868', '--prose-h3': '#a88858',
      '--prose-h4': '#988060', '--prose-h5': '#887860', '--prose-bold': '#d8c8a8',
      '--prose-italic': '#b0a088', '--prose-code': '#c0a060', '--prose-blockquote': '#706050',
      '--prose-list-marker': '#a08848', '--prose-th': '#a89068',
      '--text': '#c8b898', '--bg': '#141008',
      '--code-bg': '#18140c', '--border': '#302818', '--surface': '#1c1810',
    },
  },
  {
    id: 'nord-frost', label: 'Nord Frost', category: 'Subtle',
    vars: {
      '--prose-h1': '#88c0d0', '--prose-h2': '#81a1c1', '--prose-h3': '#5e81ac',
      '--prose-h4': '#a3be8c', '--prose-h5': '#b48ead', '--prose-bold': '#eceff4',
      '--prose-italic': '#b48ead', '--prose-code': '#8fbcbb', '--prose-blockquote': '#4c566a',
      '--prose-list-marker': '#81a1c1', '--prose-th': '#6a8bad',
      '--text': '#d8dee9', '--bg': '#0e141e',
      '--code-bg': '#111926', '--border': '#243044', '--surface': '#141c28',
    },
  },
  {
    id: 'monokai', label: 'Monokai', category: 'Codery',
    vars: {
      '--prose-h1': '#f92672', '--prose-h2': '#fd971f', '--prose-h3': '#e6db74',
      '--prose-h4': '#a6e22e', '--prose-h5': '#66d9ef', '--prose-bold': '#f8f8f2',
      '--prose-italic': '#ae81ff', '--prose-code': '#a6e22e', '--prose-blockquote': '#75715e',
      '--prose-list-marker': '#fd971f', '--prose-th': '#e09040',
      '--text': '#f8f8f2', '--bg': '#1a1a14',
      '--code-bg': '#1e1e16', '--border': '#3e3d32', '--surface': '#272822',
    },
  },
  {
    id: 'solarized-dark', label: 'Solarized', category: 'Subtle',
    vars: {
      '--prose-h1': '#b58900', '--prose-h2': '#cb4b16', '--prose-h3': '#d33682',
      '--prose-h4': '#859900', '--prose-h5': '#268bd2', '--prose-bold': '#eee8d5',
      '--prose-italic': '#6c71c4', '--prose-code': '#2aa198', '--prose-blockquote': '#586e75',
      '--prose-list-marker': '#b58900', '--prose-th': '#a08020',
      '--text': '#c0b898', '--bg': '#002b36',
      '--code-bg': '#003340', '--border': '#094f5c', '--surface': '#073642',
    },
  },
  {
    id: 'catppuccin', label: 'Catppuccin', category: 'Fun',
    vars: {
      '--prose-h1': '#f5c2e7', '--prose-h2': '#cba6f7', '--prose-h3': '#f38ba8',
      '--prose-h4': '#a6e3a1', '--prose-h5': '#89b4fa', '--prose-bold': '#cdd6f4',
      '--prose-italic': '#f5c2e7', '--prose-code': '#94e2d5', '--prose-blockquote': '#585b70',
      '--prose-list-marker': '#cba6f7', '--prose-th': '#b8a0d8',
      '--text': '#cdd6f4', '--bg': '#121020',
      '--code-bg': '#16142a', '--border': '#2e2a48', '--surface': '#1a1830',
    },
  },
];

// markdown-it + plugins — initialized once
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false, // Mitigation #7: prevent XSS from AI-generated markdown
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch { /* fallback */ }
    }
    return ''; // Use default escaping
  },
});

md.use(anchor, {
  permalink: false,
  slugify: (s: string) => s.toLowerCase().replace(/[^\w]+/g, '-'),
});

// Enable task lists
md.core.ruler.after('inline', 'task-lists', (state) => {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'bullet_list_open') {
      let hasTask = false;
      for (let j = i + 1; j < tokens.length && tokens[j].type !== 'bullet_list_close'; j++) {
        if (tokens[j].type === 'inline' && tokens[j].content) {
          const match = tokens[j].content.match(/^\[([ xX])\]\s/);
          if (match) {
            hasTask = true;
            const checked = match[1] !== ' ';
            tokens[j].content = tokens[j].content.slice(match[0].length);
            const children = tokens[j].children;
            if (children) {
              const firstChild = children[0];
              if (firstChild && firstChild.content) {
                firstChild.content = firstChild.content.replace(/^\[([ xX])\]\s/, '');
              }
            }

            for (let k = j - 1; k >= i; k--) {
              if (tokens[k].type === 'list_item_open') {
                tokens[k].attrSet('class', 'task-list-item');
                const checkboxToken = new state.Token('html_inline', '', 0);
                checkboxToken.content = `<input type="checkbox" ${checked ? 'checked' : ''} disabled>`;
                const tokenChildren = tokens[j].children;
                if (tokenChildren) {
                  tokenChildren.unshift(checkboxToken);
                }
                break;
              }
            }
          }
        }
      }
      if (hasTask) {
        tokens[i].attrSet('class', 'contains-task-list');
      }
    }
  }
});

interface MarkdownPreviewProps {
  fileContent: FileContentResponse | null;
  loading: boolean;
  onToggleStar: (path: string) => void;
  onSelectFile: (path: string) => void;
  knownPaths: Set<string>;
  zoomLevel: number;
  fillScreen: boolean;
  readerMode: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFillScreen: () => void;
  onToggleReaderMode: () => void;
  activePalette: PaletteId;
  onChangePalette: (id: PaletteId) => void;
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
  return new Date(epochMs).toLocaleDateString();
}

function ContentSkeleton() {
  return (
    <div className="prose-reader">
      <div className="skeleton h-8 w-2/3 mb-6" />
      <div className="flex flex-col gap-3">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-32 w-full mt-4" />
        <div className="skeleton h-4 w-3/4 mt-4" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
      </div>
    </div>
  );
}

export function MarkdownPreview({
  fileContent, loading, onToggleStar, onSelectFile, knownPaths,
  zoomLevel, fillScreen, readerMode,
  onZoomIn, onZoomOut, onZoomReset, onToggleFillScreen, onToggleReaderMode,
  activePalette, onChangePalette,
}: MarkdownPreviewProps) {
  const [showFullPath, setShowFullPath] = useState(false);
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const paletteDropdownRef = useRef<HTMLDivElement>(null);

  // Close palette picker on click outside
  useEffect(() => {
    if (!showPalettePicker) return;
    const handler = (e: MouseEvent) => {
      if (
        paletteDropdownRef.current && !paletteDropdownRef.current.contains(e.target as Node) &&
        paletteBtnRef.current && !paletteBtnRef.current.contains(e.target as Node)
      ) {
        setShowPalettePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPalettePicker]);

  const revealInFinder = useCallback(() => {
    if (!fileContent?.path) return;
    fetch('/api/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fileContent.path }),
    }).catch(() => {});
  }, [fileContent?.path]);
  const html = useMemo(() => {
    if (!fileContent?.content) return '';
    return md.render(fileContent.content);
  }, [fileContent?.content]);

  // --- Page transition state ---
  const [transitionClass, setTransitionClass] = useState('');
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const newPath = fileContent?.path ?? null;
    if (prevPathRef.current && newPath && prevPathRef.current !== newPath) {
      // Trigger exit → enter animation
      setTransitionClass('prose-transition-exit');
      const t1 = setTimeout(() => {
        setTransitionClass('prose-transition-enter');
        const t2 = setTimeout(() => {
          setTransitionClass('prose-transition-enter-active');
          const t3 = setTimeout(() => setTransitionClass(''), 200);
          return () => clearTimeout(t3);
        }, 20);
        return () => clearTimeout(t2);
      }, 150);
      prevPathRef.current = newPath;
      return () => clearTimeout(t1);
    }
    prevPathRef.current = newPath;
  }, [fileContent?.path]);

  // --- Heading breadcrumb ---
  const [headingBreadcrumb, setHeadingBreadcrumb] = useState('');
  const proseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!proseRef.current) return;
    const headings = proseRef.current.querySelectorAll('h1, h2, h3');
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Build breadcrumb from headings above viewport
        const aboveViewport: { level: number; text: string }[] = [];
        headings.forEach(h => {
          const rect = h.getBoundingClientRect();
          if (rect.top < 80) {
            const level = parseInt(h.tagName[1]);
            aboveViewport.push({ level, text: h.textContent?.trim() || '' });
          }
        });

        if (aboveViewport.length === 0) {
          setHeadingBreadcrumb('');
          return;
        }

        // Build hierarchy: keep the last h1, then last h2 after it, then last h3 after that
        const parts: string[] = [];
        let lastH1 = '', lastH2 = '', lastH3 = '';
        for (const h of aboveViewport) {
          if (h.level === 1) { lastH1 = h.text; lastH2 = ''; lastH3 = ''; }
          else if (h.level === 2) { lastH2 = h.text; lastH3 = ''; }
          else if (h.level === 3) { lastH3 = h.text; }
        }
        if (lastH1) parts.push(lastH1);
        if (lastH2) parts.push(lastH2);
        if (lastH3) parts.push(lastH3);
        setHeadingBreadcrumb(parts.join(' › '));
      },
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    );

    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [html]);

  // Resolve a .md filename relative to the current file's directory
  const resolveAndNavigate = useCallback((href: string) => {
    if (!fileContent?.path) return;
    const currentDir = fileContent.path.substring(0, fileContent.path.lastIndexOf('/'));
    let resolved = '';

    if (href.startsWith('/')) {
      resolved = href;
    } else {
      resolved = currentDir + '/' + href;
    }

    const parts = resolved.split('/');
    const normalized: string[] = [];
    for (const part of parts) {
      if (part === '..') normalized.pop();
      else if (part !== '.' && part !== '') normalized.push(part);
    }
    resolved = '/' + normalized.join('/');

    if (knownPaths.has(resolved)) {
      onSelectFile(resolved);
    } else {
      const parentDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
      const parentResolved = '/' + parentDir.split('/').filter(Boolean).join('/') + '/' + href.replace(/^\.\//, '');
      if (knownPaths.has(parentResolved)) {
        onSelectFile(parentResolved);
      }
    }
  }, [fileContent?.path, onSelectFile, knownPaths]);

  // Mark <code> elements that reference navigable .md files
  useEffect(() => {
    if (!proseRef.current || !fileContent?.path) return;
    const currentDir = fileContent.path.substring(0, fileContent.path.lastIndexOf('/'));
    const codes = proseRef.current.querySelectorAll('code');
    for (const code of codes) {
      if (code.closest('pre')) continue;
      const text = code.textContent?.trim();
      if (text && /^[\w./-]+\.md$/i.test(text)) {
        const resolved = currentDir + '/' + text;
        if (knownPaths.has(resolved)) {
          code.setAttribute('data-navigable', 'true');
        }
      }
    }
  }, [html, fileContent?.path, knownPaths]);

  // Intercept clicks on <a> links and <code> elements containing .md filenames
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const anchorEl = target.closest('a');
    if (anchorEl) {
      const href = anchorEl.getAttribute('href');
      if (href && href.endsWith('.md')) {
        e.preventDefault();
        resolveAndNavigate(href);
      }
      return;
    }

    if (target.tagName === 'CODE' && !target.closest('pre')) {
      const text = target.textContent?.trim();
      if (text && /^[\w./-]+\.md$/i.test(text)) {
        resolveAndNavigate(text);
      }
    }
  }, [resolveAndNavigate]);

  if (loading && !fileContent) {
    return <ContentSkeleton />;
  }

  if (!fileContent) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <p className="text-lg mb-1" style={{ fontFamily: 'var(--font-jetbrains-mono), monospace' }}>
            MarkReader
          </p>
          <p className="text-sm">Select a file to preview</p>
        </div>
      </div>
    );
  }

  const zoomLabel = zoomLevel === 1 ? '1x' : `${zoomLevel}x`;

  return (
    <div>
      {/* File header */}
      <div
        className="file-header sticky top-0 z-10 px-6 py-3 border-b backdrop-blur-sm"
        style={{
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        }}
      >
        <div className="max-w-[720px] mx-auto flex items-center justify-between" style={{ maxWidth: fillScreen ? `calc(720px * ${zoomLevel})` : '720px' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <button
                className="text-xs truncate text-left"
                onClick={() => setShowFullPath(p => !p)}
                title={showFullPath ? 'Show relative path' : 'Show full path'}
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  color: 'var(--text-muted)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {showFullPath ? fileContent.path : fileContent.relativePath}
              </button>
              <button
                className="zoom-btn shrink-0"
                onClick={revealInFinder}
                title="Reveal in Finder"
                style={{ fontSize: '10px', padding: '1px 5px', display: 'flex', alignItems: 'center', gap: 3 }}
              >
                <span>⬡</span><span>Finder</span>
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Modified {formatRelativeTime(fileContent.modifiedAt)}</span>
              <span>·</span>
              <span>{fileContent.wordCount.toLocaleString()} words</span>
              <span>·</span>
              <span>{fileContent.readingTime}m read</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={onZoomOut} title="Zoom out (Cmd+-)">A−</button>
              <button className="zoom-label" onClick={onZoomReset} title="Reset zoom (Cmd+0)">{zoomLabel}</button>
              <button className="zoom-btn" onClick={onZoomIn} title="Zoom in (Cmd+=)">A+</button>
            </div>

            {/* Fill screen toggle */}
            <button
              className="zoom-btn"
              onClick={onToggleFillScreen}
              title="Fill screen (Cmd+Shift+F)"
              style={{ display: 'flex', alignItems: 'center', gap: 3, ...(fillScreen ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
            >
              <span>⛶</span><span>Fill</span>
            </button>

            {/* Reader mode toggle */}
            <button
              className="zoom-btn"
              onClick={onToggleReaderMode}
              title="Reader mode (Cmd+.)"
              style={{ display: 'flex', alignItems: 'center', gap: 3, ...(readerMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
            >
              <span>◉</span><span>Focus</span>
            </button>

            {/* Palette picker */}
            <button
              ref={paletteBtnRef}
              className="zoom-btn"
              onClick={() => setShowPalettePicker(p => !p)}
              title="Color palette"
              style={{ display: 'flex', alignItems: 'center', gap: 3, ...(showPalettePicker ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
            >
              <span>◔</span><span>Theme</span>
            </button>

            <button
              className={`star-btn text-lg ${fileContent.isFavorite ? 'starred' : ''}`}
              onClick={() => onToggleStar(fileContent.path)}
              title={fileContent.isFavorite ? 'Remove star' : 'Star file'}
            >
              {fileContent.isFavorite ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>

      {/* Heading breadcrumb — hidden in reader mode */}
      {headingBreadcrumb && !readerMode && (
        <div
          className="sticky z-10 px-6 py-1"
          style={{
            top: 56,
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: '11px',
            color: '#666',
            background: 'color-mix(in srgb, var(--bg) 75%, transparent)',
            backdropFilter: 'blur(4px)',
            maxWidth: `calc(720px * ${zoomLevel})`,
            margin: '0 auto',
          }}
        >
          {headingBreadcrumb}
        </div>
      )}

      {/* Rendered markdown — palette vars cascade from <main> */}
      <div
        ref={proseRef}
        className={`prose-reader ${fillScreen ? 'fill-screen' : ''} ${transitionClass}`}
        style={{
          '--zoom': zoomLevel,
          maxWidth: fillScreen ? undefined : '720px',
          fontSize: `calc(18px * ${zoomLevel})`,
        } as CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleContentClick}
      />

      {/* Palette dropdown — rendered as fixed overlay to avoid clipping */}
      {showPalettePicker && paletteBtnRef.current && (() => {
        const rect = paletteBtnRef.current!.getBoundingClientRect();
        return (
          <div
            ref={paletteDropdownRef}
            style={{
              position: 'fixed',
              top: rect.bottom + 6,
              right: window.innerWidth - rect.right,
              width: 220,
              background: 'var(--surface, #161616)',
              border: '1px solid var(--border, #2a2a2a)',
              borderRadius: 8,
              padding: '6px 0',
              zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            {PALETTES.map(p => (
              <button
                key={p.id}
                onClick={() => { onChangePalette(p.id); setShowPalettePicker(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 12px',
                  border: 'none',
                  background: activePalette === p.id ? 'rgba(212,160,74,0.15)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  fontSize: 11,
                  color: activePalette === p.id ? '#d4a04a' : '#e0e0e0',
                }}
                onMouseEnter={e => { if (activePalette !== p.id) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (activePalette !== p.id) (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                  {['--prose-h1', '--prose-h3', '--prose-code', '--prose-bold'].map(k => (
                    <span
                      key={k}
                      style={{ width: 8, height: 8, borderRadius: 2, background: p.vars[k] }}
                    />
                  ))}
                </span>
                <span style={{ flex: 1 }}>{p.label}</span>
                <span style={{ fontSize: 9, color: '#888' }}>{p.category}</span>
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

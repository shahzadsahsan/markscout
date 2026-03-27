import { useMemo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FileContentResponse } from '../lib/types';
import { api } from '../lib/api';

// Color palette definitions
export type PaletteId = 'parchment-dusk' | 'deep-ocean' | 'rosewood' | 'terminal-green' | 'warm-paper' | 'nord-frost' | 'monokai' | 'solarized-dark' | 'catppuccin' | 'synthwave' | 'dracula' | 'tokyo-night' | 'daylight' | 'sepia-light' | 'arctic' | 'sakura';

export interface Palette {
  id: PaletteId;
  label: string;
  category: string;
  vars: Record<string, string>;
}

export const PALETTES: Palette[] = [
  {
    id: 'parchment-dusk', label: 'Parchment Dusk', category: 'Dark Warm',
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
    id: 'deep-ocean', label: 'Deep Ocean', category: 'Dark Cool',
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
    id: 'rosewood', label: 'Rosewood', category: 'Dark Warm',
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
    id: 'terminal-green', label: 'Terminal', category: 'Dark Vibrant',
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
    id: 'warm-paper', label: 'Warm Paper', category: 'Dark Warm',
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
    id: 'nord-frost', label: 'Nord Frost', category: 'Dark Cool',
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
    id: 'monokai', label: 'Monokai', category: 'Dark Vibrant',
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
    id: 'solarized-dark', label: 'Solarized', category: 'Dark Cool',
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
    id: 'catppuccin', label: 'Catppuccin', category: 'Dark Vibrant',
    vars: {
      '--prose-h1': '#f5c2e7', '--prose-h2': '#cba6f7', '--prose-h3': '#f38ba8',
      '--prose-h4': '#a6e3a1', '--prose-h5': '#89b4fa', '--prose-bold': '#cdd6f4',
      '--prose-italic': '#f5c2e7', '--prose-code': '#94e2d5', '--prose-blockquote': '#585b70',
      '--prose-list-marker': '#cba6f7', '--prose-th': '#b8a0d8',
      '--text': '#cdd6f4', '--bg': '#121020',
      '--code-bg': '#16142a', '--border': '#2e2a48', '--surface': '#1a1830',
    },
  },
  {
    id: 'synthwave', label: 'Synthwave', category: 'Dark Vibrant',
    vars: {
      '--prose-h1': '#ff2975', '--prose-h2': '#f97316', '--prose-h3': '#00e5ff',
      '--prose-h4': '#fde047', '--prose-h5': '#c084fc', '--prose-bold': '#f0d0ff',
      '--prose-italic': '#ff79c6', '--prose-code': '#00e5ff', '--prose-blockquote': '#6b4c8a',
      '--prose-list-marker': '#ff2975', '--prose-th': '#c060e0',
      '--text': '#e0d0f0', '--bg': '#0a0014',
      '--code-bg': '#0e0020', '--border': '#2a1848', '--surface': '#120028',
    },
  },
  {
    id: 'dracula', label: 'Dracula', category: 'Dark Cool',
    vars: {
      '--prose-h1': '#ff79c6', '--prose-h2': '#bd93f9', '--prose-h3': '#8be9fd',
      '--prose-h4': '#50fa7b', '--prose-h5': '#ffb86c', '--prose-bold': '#f8f8f2',
      '--prose-italic': '#ff79c6', '--prose-code': '#50fa7b', '--prose-blockquote': '#6272a4',
      '--prose-list-marker': '#bd93f9', '--prose-th': '#9580c8',
      '--text': '#f8f8f2', '--bg': '#0d1117',
      '--code-bg': '#111822', '--border': '#2a3040', '--surface': '#141c28',
    },
  },
  {
    id: 'tokyo-night', label: 'Tokyo Night', category: 'Dark Cool',
    vars: {
      '--prose-h1': '#7aa2f7', '--prose-h2': '#bb9af7', '--prose-h3': '#7dcfff',
      '--prose-h4': '#9ece6a', '--prose-h5': '#e0af68', '--prose-bold': '#c0caf5',
      '--prose-italic': '#bb9af7', '--prose-code': '#9ece6a', '--prose-blockquote': '#565f89',
      '--prose-list-marker': '#7aa2f7', '--prose-th': '#6a80b8',
      '--text': '#a9b1d6', '--bg': '#0d1017',
      '--code-bg': '#111620', '--border': '#1e2438', '--surface': '#131820',
    },
  },
  {
    id: 'daylight', label: 'Daylight', category: 'Light',
    vars: {
      '--prose-h1': '#1a1a2e', '--prose-h2': '#2d3a4a', '--prose-h3': '#8b4513',
      '--prose-h4': '#2e7d32', '--prose-h5': '#1565c0', '--prose-bold': '#111',
      '--prose-italic': '#6a1b9a', '--prose-code': '#c62828', '--prose-blockquote': '#78909c',
      '--prose-list-marker': '#e65100', '--prose-th': '#37474f',
      '--text': '#1e1e1e', '--bg': '#fafaf8',
      '--code-bg': '#f0eeea', '--border': '#d8d4cc', '--surface': '#f2f0ec',
      '--text-muted': '#777', '--accent': '#c07820', '--active-bg': '#ece8e0', '--hover-bg': '#f5f3ef',
    },
  },
  {
    id: 'sepia-light', label: 'Sepia', category: 'Light',
    vars: {
      '--prose-h1': '#5c3d1a', '--prose-h2': '#6d4c28', '--prose-h3': '#8b5e34',
      '--prose-h4': '#4a6741', '--prose-h5': '#3e6578', '--prose-bold': '#3a2510',
      '--prose-italic': '#7a4a6a', '--prose-code': '#8b4513', '--prose-blockquote': '#8a7a68',
      '--prose-list-marker': '#a0682a', '--prose-th': '#6d5a40',
      '--text': '#3a3028', '--bg': '#f8f0e4',
      '--code-bg': '#f0e8d8', '--border': '#d8c8a8', '--surface': '#f4ecdc',
      '--text-muted': '#887868', '--accent': '#b87a30', '--active-bg': '#ece0c8', '--hover-bg': '#f6efe2',
    },
  },
  {
    id: 'arctic', label: 'Arctic', category: 'Light',
    vars: {
      '--prose-h1': '#1e3a5f', '--prose-h2': '#2c5282', '--prose-h3': '#744210',
      '--prose-h4': '#276749', '--prose-h5': '#553c9a', '--prose-bold': '#1a202c',
      '--prose-italic': '#6b46c1', '--prose-code': '#2b6cb0', '--prose-blockquote': '#718096',
      '--prose-list-marker': '#2b6cb0', '--prose-th': '#2d3748',
      '--text': '#2d3748', '--bg': '#f7fafc',
      '--code-bg': '#edf2f7', '--border': '#cbd5e0', '--surface': '#eef3f8',
      '--text-muted': '#718096', '--accent': '#3182ce', '--active-bg': '#e2e8f0', '--hover-bg': '#f0f5fa',
    },
  },
  {
    id: 'sakura', label: 'Sakura', category: 'Light',
    vars: {
      '--prose-h1': '#8b2252', '--prose-h2': '#6a3d6a', '--prose-h3': '#a0527a',
      '--prose-h4': '#4a7a5a', '--prose-h5': '#4a6a8a', '--prose-bold': '#3a1a2a',
      '--prose-italic': '#7a3a6a', '--prose-code': '#d45d79', '--prose-blockquote': '#b89aaa',
      '--prose-list-marker': '#c86a8a', '--prose-th': '#6a4a5a',
      '--text': '#3a2030', '--bg': '#fdf2f5',
      '--code-bg': '#f8e8ee', '--border': '#e8c8d8', '--surface': '#faeef2',
      '--text-muted': '#9a7a8a', '--accent': '#c86a8a', '--active-bg': '#f0d8e0', '--hover-bg': '#fcf0f4',
    },
  },
];

// markdown-it + plugins -- initialized once
import MarkdownIt from 'markdown-it';
import anchor from 'markdown-it-anchor';
import hljs from 'highlight.js';

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch { /* fallback */ }
    }
    return '';
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
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFillScreen: () => void;
  activePalette: PaletteId;
  onChangePalette: (id: PaletteId) => void;
  onOpenPreferences: () => void;
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
  zoomLevel, fillScreen,
  onZoomIn, onZoomOut, onZoomReset, onToggleFillScreen,
  activePalette, onChangePalette, onOpenPreferences,
}: MarkdownPreviewProps) {
  const [showPalettePicker, setShowPalettePicker] = useState(false);
  const paletteBtnRef = useRef<HTMLButtonElement>(null);
  const paletteDropdownRef = useRef<HTMLDivElement>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const overflowBtnRef = useRef<HTMLButtonElement>(null);
  const overflowDropdownRef = useRef<HTMLDivElement>(null);

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

  // Close overflow menu on click outside
  useEffect(() => {
    if (!showOverflow) return;
    const handler = (e: MouseEvent) => {
      if (
        overflowDropdownRef.current && !overflowDropdownRef.current.contains(e.target as Node) &&
        overflowBtnRef.current && !overflowBtnRef.current.contains(e.target as Node)
      ) {
        setShowOverflow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOverflow]);

  const revealInFinder = useCallback(() => {
    if (!fileContent?.path) return;
    api.revealInFinder(fileContent.path);
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

  // --- Current section tracking via scroll ---
  const [currentSection, setCurrentSection] = useState('');
  const proseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollParent = proseRef.current?.closest('.content-area') || proseRef.current?.parentElement;
    if (!scrollParent || !proseRef.current) return;

    const update = () => {
      if (!proseRef.current) return;
      const headings = proseRef.current.querySelectorAll('h1, h2, h3');
      if (headings.length === 0) { setCurrentSection(''); return; }

      let lastH2 = '', lastH3 = '';
      headings.forEach(h => {
        const rect = h.getBoundingClientRect();
        if (rect.top < 90) {
          const level = parseInt(h.tagName[1]);
          const text = h.textContent?.trim() || '';
          if (level <= 2) { lastH2 = text; lastH3 = ''; }
          else if (level === 3) { lastH3 = text; }
        }
      });

      // Show deepest section (skip h1 — that's the doc title, already visible)
      setCurrentSection(lastH3 || lastH2 || '');
    };

    scrollParent.addEventListener('scroll', update, { passive: true });
    update();
    return () => scrollParent.removeEventListener('scroll', update);
  }, [html]);

  // Add copy buttons to code blocks
  useEffect(() => {
    if (!proseRef.current) return;
    const pres = proseRef.current.querySelectorAll('pre');
    pres.forEach(pre => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.textContent || '');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        }
      });
      pre.style.position = 'relative';
      pre.appendChild(btn);
    });
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
          <p className="text-lg mb-1" style={{ fontFamily: 'var(--font-ui)' }}>
            MarkScout
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
              <span
                className="text-xs truncate"
                style={{
                  fontFamily: 'var(--font-jetbrains-mono), monospace',
                  color: 'var(--text-muted)',
                }}
              >
                {fileContent?.path}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Modified {formatRelativeTime(fileContent.modifiedAt)}</span>
              <span>{'\u00B7'}</span>
              <span>{fileContent.wordCount.toLocaleString()} words</span>
              <span>{'\u00B7'}</span>
              <span>{fileContent.readingTime}m read</span>
              {currentSection && (
                <>
                  <span>{'\u00B7'}</span>
                  <span style={{ color: 'var(--accent)', opacity: 0.7 }}>{currentSection}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Compact zoom */}
            <div className="zoom-controls">
              <button className="zoom-btn" onClick={onZoomOut} title="Zoom out (Cmd+-)">A{'\u2212'}</button>
              <button className="zoom-btn" onClick={onZoomIn} title="Zoom in (Cmd+=)">A+</button>
            </div>

            {/* Copy file contents */}
            <button
              className="zoom-btn"
              onClick={() => {
                if (fileContent?.content) {
                  navigator.clipboard.writeText(fileContent.content);
                }
              }}
              title="Copy file contents"
            >
              {'\u2398'}
            </button>

            {/* Fill screen */}
            <button
              className="zoom-btn"
              onClick={onToggleFillScreen}
              title="Fill screen (Cmd+Shift+F)"
              style={{ display: 'flex', alignItems: 'center', gap: 3, ...(fillScreen ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
            >
              <span>{'\u26F6'}</span>
            </button>

            {/* Star */}
            <button
              className={`star-btn text-lg ${fileContent.isFavorite ? 'starred' : ''}`}
              onClick={() => fileContent && onToggleStar(fileContent.path)}
              title={fileContent.isFavorite ? 'Remove star' : 'Star file'}
            >
              {fileContent.isFavorite ? '\u2605' : '\u2606'}
            </button>

            {/* Overflow menu */}
            <div style={{ position: 'relative' }}>
              <button
                ref={overflowBtnRef}
                className="zoom-btn"
                onClick={() => { setShowOverflow(p => !p); setShowPalettePicker(false); }}
                title="More actions"
                style={{ padding: '2px 6px', ...(showOverflow ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}) }}
              >
                {'\u22EF'}
              </button>
              {showOverflow && overflowBtnRef.current && (() => {
                const rect = overflowBtnRef.current!.getBoundingClientRect();
                return (
                  <div
                    ref={overflowDropdownRef}
                    style={{
                      position: 'fixed',
                      top: rect.bottom + 6,
                      right: window.innerWidth - rect.right,
                      width: 200,
                      background: 'var(--surface, #161616)',
                      border: '1px solid var(--border, #2a2a2a)',
                      borderRadius: 8,
                      padding: '4px 0',
                      zIndex: 9999,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <button
                      className="overflow-item"
                      onClick={() => { setShowOverflow(false); setShowPalettePicker(p => !p); }}
                    >
                      <span>{'\u25D4'}</span>
                      <span>Theme</span>
                    </button>
                    <button
                      className="overflow-item"
                      onClick={() => { revealInFinder(); setShowOverflow(false); }}
                    >
                      <span>{'\u2B21'}</span>
                      <span>Reveal in Finder</span>
                    </button>
                    <button
                      className="overflow-item"
                      onClick={() => { if (fileContent) navigator.clipboard.writeText(fileContent.path); setShowOverflow(false); }}
                    >
                      <span>{'\u2398'}</span>
                      <span>Copy path</span>
                    </button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                    <button
                      className="overflow-item"
                      onClick={() => { onOpenPreferences(); setShowOverflow(false); }}
                    >
                      <span>{'\u2699'}</span>
                      <span>Settings</span>
                      <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', opacity: 0.5 }}>{'\u2318,'}</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* No separate breadcrumb bar — section shown inline in header */}

      {/* Rendered markdown */}
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

      {/* Palette dropdown — grouped by tone */}
      {showPalettePicker && overflowBtnRef.current && (() => {
        const rect = overflowBtnRef.current!.getBoundingClientRect();
        const groups: [string, Palette[]][] = [];
        const seen = new Set<string>();
        for (const p of PALETTES) {
          if (!seen.has(p.category)) { seen.add(p.category); groups.push([p.category, []]); }
          groups.find(g => g[0] === p.category)![1].push(p);
        }
        return (
          <div
            ref={paletteDropdownRef}
            style={{
              position: 'fixed',
              top: rect.bottom + 6,
              right: window.innerWidth - rect.right,
              width: 230,
              maxHeight: 420,
              overflowY: 'auto',
              background: 'var(--surface, #161616)',
              border: '1px solid var(--border, #2a2a2a)',
              borderRadius: 8,
              padding: '4px 0',
              zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            {groups.map(([category, palettes], gi) => (
              <div key={category}>
                {gi > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />}
                <div style={{
                  padding: '4px 12px 2px',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'var(--font-ui)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 600,
                }}>
                  {category}
                </div>
                {palettes.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { onChangePalette(p.id); setShowPalettePicker(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '5px 12px',
                      border: 'none',
                      background: activePalette === p.id ? 'rgba(212,160,74,0.15)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-ui)',
                      fontSize: 'var(--text-sm)',
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
                    {activePalette === p.id && <span style={{ fontSize: 'var(--text-xs)' }}>{'\u2713'}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

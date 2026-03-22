// GET /api/files?view=recents|folders|favorites|history
// Returns the file list for the requested sidebar view.

import { NextRequest, NextResponse } from 'next/server';
import { getFilesForView, getFileRegistry, isScanComplete } from '@/lib/watcher';
import { getFavorites, getHistory } from '@/lib/state';
import type { FileEntry, FolderNode } from '@/lib/types';

function buildFolderTree(files: FileEntry[]): FolderNode[] {
  const roots = new Map<string, FolderNode>();

  for (const file of files) {
    const parts = file.relativePath.split('/');
    const project = parts[0] || file.project;

    if (!roots.has(project)) {
      roots.set(project, {
        name: project,
        path: project,
        files: [],
        children: [],
        fileCount: 0,
      });
    }

    const root = roots.get(project)!;
    root.fileCount++;

    if (parts.length <= 2) {
      // File directly in project root or one level deep
      root.files.push(file);
    } else {
      // Nested file — create intermediate folders
      let current = root;
      for (let i = 1; i < parts.length - 1; i++) {
        const folderName = parts[i];
        let child = current.children.find(c => c.name === folderName);
        if (!child) {
          child = {
            name: folderName,
            path: parts.slice(0, i + 1).join('/'),
            files: [],
            children: [],
            fileCount: 0,
          };
          current.children.push(child);
        }
        child.fileCount++;
        current = child;
      }
      current.files.push(file);
    }
  }

  // Sort roots alphabetically
  return Array.from(roots.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') || 'recents';

  const response: {
    files?: FileEntry[];
    folders?: FolderNode[];
    scanComplete: boolean;
    totalFiles: number;
  } = {
    scanComplete: isScanComplete(),
    totalFiles: getFileRegistry().size,
  };

  switch (view) {
    case 'recents':
      response.files = getFilesForView('recents');
      break;

    case 'folders':
      response.folders = buildFolderTree(getFilesForView('folders'));
      break;

    case 'favorites': {
      const favorites = await getFavorites();
      const registry = getFileRegistry();
      response.files = favorites
        .map(f => registry.get(f.path))
        .filter((f): f is FileEntry => f !== undefined);
      break;
    }

    case 'history': {
      const history = await getHistory();
      const registry = getFileRegistry();
      response.files = history
        .map(h => {
          const entry = registry.get(h.path);
          if (!entry) return null;
          // Attach lastOpenedAt for display
          return { ...entry, lastOpenedAt: h.lastOpenedAt };
        })
        .filter((f): f is FileEntry & { lastOpenedAt: number } => f !== null);
      break;
    }

    default:
      response.files = getFilesForView('recents');
  }

  return NextResponse.json(response);
}

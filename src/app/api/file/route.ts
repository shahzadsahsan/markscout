// GET /api/file?path= — Returns markdown content + metadata for a single file.
// Path security: validates the requested path is under a watched directory.

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { isValidPath, getFileEntry } from '@/lib/watcher';
import { isFavorite } from '@/lib/state';
import path from 'path';
import type { FileContentResponse } from '@/lib/types';

const WORDS_PER_MINUTE = 200;

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  // Security: resolve and validate path
  const resolved = path.resolve(filePath);
  if (!isValidPath(resolved)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const content = await readFile(resolved, 'utf-8');
    const entry = getFileEntry(resolved);

    // Word count and reading time
    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const readingTime = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

    const starred = await isFavorite(resolved);

    const response: FileContentResponse = {
      path: resolved,
      content,
      name: entry?.name || path.basename(resolved, '.md'),
      project: entry?.project || '',
      relativePath: entry?.relativePath || resolved,
      modifiedAt: entry?.modifiedAt || Date.now(),
      size: entry?.size || content.length,
      wordCount,
      readingTime,
      isFavorite: starred,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}

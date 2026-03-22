// POST /api/star — Toggle favorite status for a file.
// Body: { path: string }

import { NextRequest, NextResponse } from 'next/server';
import { isValidPath, getFileEntry } from '@/lib/watcher';
import { toggleFavorite } from '@/lib/state';
import path from 'path';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const filePath = body.path;

  if (!filePath || typeof filePath !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  const resolved = path.resolve(filePath);
  if (!isValidPath(resolved)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const entry = getFileEntry(resolved);
  if (!entry) {
    return NextResponse.json({ error: 'File not in registry' }, { status: 404 });
  }

  const isNowFavorite = await toggleFavorite(resolved, entry.contentHash);

  return NextResponse.json({ path: resolved, isFavorite: isNowFavorite });
}

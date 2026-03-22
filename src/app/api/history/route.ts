// POST /api/history — Record a file open event.
// GET /api/history — Return the history list.

import { NextRequest, NextResponse } from 'next/server';
import { isValidPath, getFileEntry } from '@/lib/watcher';
import { recordOpen, getHistory } from '@/lib/state';
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

  await recordOpen(resolved, entry.contentHash);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const history = await getHistory();
  return NextResponse.json({ history });
}

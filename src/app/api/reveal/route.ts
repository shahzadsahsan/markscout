import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { getWatchedDirs } from '@/lib/watcher';

export async function POST(req: NextRequest) {
  const { path } = await req.json();
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  // Security: validate path is under a watched directory
  const watchedDirs = getWatchedDirs();
  const isUnderWatched = watchedDirs.some((d: string) => path.startsWith(d));
  if (!isUnderWatched) {
    return NextResponse.json({ error: 'Path not in watched directories' }, { status: 403 });
  }

  // macOS: reveal in Finder
  exec(`open -R "${path.replace(/"/g, '\\"')}"`);

  return NextResponse.json({ ok: true });
}

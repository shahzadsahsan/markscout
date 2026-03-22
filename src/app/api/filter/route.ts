// POST /api/filter — Exclude or include a folder path.
// Body: { action: 'exclude' | 'include', path: string }

import { NextRequest, NextResponse } from 'next/server';
import { addExcludedPath, removeExcludedPath, getExcludedPaths } from '@/lib/state';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, path: folderPath } = body;

  if (!action || !folderPath) {
    return NextResponse.json({ error: 'Missing action or path' }, { status: 400 });
  }

  if (action === 'exclude') {
    await addExcludedPath(folderPath);
  } else if (action === 'include') {
    await removeExcludedPath(folderPath);
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const excluded = await getExcludedPaths();
  return NextResponse.json({ excludedPaths: excluded });
}

export async function GET() {
  const excluded = await getExcludedPaths();
  return NextResponse.json({ excludedPaths: excluded });
}

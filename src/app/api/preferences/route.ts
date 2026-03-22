// GET /api/preferences — Return presets, their match counts, active presets, watch dirs
// POST /api/preferences — Toggle preset, add/remove watch dir

import { NextRequest, NextResponse } from 'next/server';
import { getPreferences, togglePreset, addWatchDir, removeWatchDir } from '@/lib/state';
import { FILTER_PRESETS, countPresetMatches } from '@/lib/presets';
import { getFileRegistry, refreshPresets, getWatchedDirs, addWatchPath, removeWatchPath } from '@/lib/watcher';
import os from 'os';
import type { FilterPresetId } from '@/lib/types';

export async function GET() {
  const prefs = await getPreferences();
  const registry = getFileRegistry();

  // Count matches for each preset against the full registry
  // (including files that are currently filtered — we want to show potential counts)
  const allFiles = Array.from(registry.values()).map(f => ({
    path: f.path,
    name: f.name + '.md',
  }));

  const counts = countPresetMatches(allFiles);
  const presetsWithCounts = FILTER_PRESETS.map(p => ({
    ...p,
    matchCount: counts[p.id] || 0,
    active: prefs.activePresets.includes(p.id),
  }));

  return NextResponse.json({
    presets: presetsWithCounts,
    activePresets: prefs.activePresets,
    watchDirs: getWatchedDirs(),
    customWatchDirs: prefs.watchDirs,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.togglePreset) {
    const presetId = body.togglePreset as FilterPresetId;
    const isActive = await togglePreset(presetId);
    await refreshPresets();
    return NextResponse.json({ presetId, active: isActive });
  }

  if (body.addWatchDir) {
    const expanded = body.addWatchDir.replace(/^~/, os.homedir());
    await addWatchDir(expanded);
    addWatchPath(expanded);
    return NextResponse.json({ ok: true, dir: expanded });
  }

  if (body.removeWatchDir) {
    const expanded = body.removeWatchDir.replace(/^~/, os.homedir());
    await removeWatchDir(expanded);
    removeWatchPath(expanded);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

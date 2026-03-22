// GET /api/ui — Return persisted UI state + favorite folders + excluded paths
// POST /api/ui — Save UI state updates

import { NextRequest, NextResponse } from 'next/server';
import {
  getUIState,
  getFavoriteFolders,
  getExcludedPaths,
  getWatchDirs,
  saveSidebarView,
  saveSidebarCollapsed,
  saveLastSelectedPath,
  saveExpandedGroups,
  saveZoomLevel,
  saveFillScreen,
  savePalette,
  toggleFavoriteFolder,
} from '@/lib/state';
import type { SidebarView } from '@/lib/types';

export async function GET() {
  const [ui, favoriteFolders, excludedPaths, customWatchDirs] = await Promise.all([
    getUIState(),
    getFavoriteFolders(),
    getExcludedPaths(),
    getWatchDirs(),
  ]);
  return NextResponse.json({ ui, favoriteFolders, excludedPaths, customWatchDirs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.sidebarView) await saveSidebarView(body.sidebarView as SidebarView);
  if (body.sidebarCollapsed !== undefined) await saveSidebarCollapsed(body.sidebarCollapsed);
  if (body.lastSelectedPath !== undefined) await saveLastSelectedPath(body.lastSelectedPath);
  if (body.expandedGroups) await saveExpandedGroups(body.expandedGroups);
  if (body.zoomLevel !== undefined) await saveZoomLevel(body.zoomLevel);
  if (body.fillScreen !== undefined) await saveFillScreen(body.fillScreen);
  if (body.palette) await savePalette(body.palette);
  if (body.toggleFolderStar) {
    const isNowFav = await toggleFavoriteFolder(body.toggleFolderStar);
    return NextResponse.json({ ok: true, isFavorite: isNowFav });
  }

  return NextResponse.json({ ok: true });
}

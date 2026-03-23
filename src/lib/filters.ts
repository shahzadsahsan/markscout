// MarkScout — Smart File Filtering
// Two levels: chokidar ignored paths (never scanned) + filename regex (post-discovery)

import type { FilterConfig } from './types';

// Chokidar-level path exclusions — these directories are never even scanned
export const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/.next/**',
  '**/.vercel/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/venv/**',
  '**/.venv/**',
  '**/.pytest_cache/**',
  '**/site-packages/**',
  '**/.dist-info/**',
  '**/coverage/**',
  '**/__pycache__/**',
  '**/.claude/plugins/cache/**',
  '**/.claude/shell-snapshots/**',
  '**/.claude/session-env/**',
  '**/.claude/debug/**',
  '**/.claude/telemetry/**',
  '**/.claude/todos/**',
  '**/.claude/orchestration/**',
  '**/.claude/worktrees/**',
];

// Post-discovery filename exclusions (regex)
const DEFAULT_EXCLUDED_FILENAMES: RegExp[] = [
  /^LICENSE\.md$/i,
  /^LICENCE\.md$/i,
  /^CHANGELOG\.md$/i,
  /^CHANGES\.md$/i,
  /^HISTORY\.md$/i,
  /^CODE_OF_CONDUCT\.md$/i,
  /^SECURITY\.md$/i,
  /^CONTRIBUTING\.md$/i,
  /^\.project-description\.md$/,
  /^99-harvest\.md$/,
  /^0[0-3]-(enter|orient|scope-).*\.md$/,
];

/**
 * Check if a filename should be excluded from the file list.
 * Checks against default exclusions + user-configured patterns.
 */
export function isExcludedFile(filename: string, userFilters?: FilterConfig): boolean {
  // Check default exclusions
  for (const regex of DEFAULT_EXCLUDED_FILENAMES) {
    if (regex.test(filename)) return true;
  }

  // Check user-configured filename exclusions
  if (userFilters?.excludedNames) {
    for (const pattern of userFilters.excludedNames) {
      try {
        if (new RegExp(pattern).test(filename)) return true;
      } catch {
        // Invalid regex in user config — skip it
      }
    }
  }

  return false;
}

/**
 * Check if a file path matches user-configured path exclusions.
 */
export function isExcludedPath(filePath: string, userFilters?: FilterConfig): boolean {
  if (!userFilters?.excludedPaths) return false;

  for (const glob of userFilters.excludedPaths) {
    // Simple glob matching: convert glob to regex
    const regex = new RegExp(
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
    );
    if (regex.test(filePath)) return true;
  }

  return false;
}

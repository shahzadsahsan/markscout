// MarkScout — Filter Presets
// Two categories: generic (any developer) and Claude Code-specific.

import type { FilterPreset, FilterPresetId } from './types';

export const FILTER_PRESETS: FilterPreset[] = [
  // --- Generic presets (useful for any developer) ---
  {
    id: 'readme-files',
    label: 'README files',
    description: 'Hide README.md files across all projects',
    pathPatterns: [],
    namePatterns: ['^README\\.md$'],
  },
  {
    id: 'license-files',
    label: 'License & contributing',
    description: 'Hide LICENSE, LICENSE.md, CONTRIBUTING.md',
    pathPatterns: [],
    namePatterns: ['^(LICENSE|CONTRIBUTING)(\\.md)?$'],
  },
  {
    id: 'changelog-files',
    label: 'Changelogs',
    description: 'Hide CHANGELOG, CHANGES files',
    pathPatterns: [],
    namePatterns: ['^(CHANGELOG|CHANGES)(\\.md)?$'],
  },
  {
    id: 'dotfile-configs',
    label: 'Dotfile configs',
    description: 'Hide dotfile config markdown like .github/*.md',
    pathPatterns: ['\\.github/'],
    namePatterns: [],
  },

  // --- Claude Code presets ---
  {
    id: 'claude-plugins',
    label: 'Plugin & agent docs',
    description: 'Reference docs, skills, and configs inside plugins/ and agents/',
    pathPatterns: ['plugins/', 'agents/'],
    namePatterns: [],
  },
  {
    id: 'claude-skills',
    label: 'Skill definitions',
    description: 'SKILL.md files used by Claude Code commands',
    pathPatterns: [],
    namePatterns: ['^SKILL\\.md$'],
  },
  {
    id: 'claude-sessions',
    label: 'RVRY deepthink sessions',
    description: 'Session logs from /deepthink, /think, /challenge in .rvry/',
    pathPatterns: ['.rvry/sessions/', '.rvry/'],
    namePatterns: [],
  },
  {
    id: 'claude-pipeline',
    label: 'GSD pipeline artifacts',
    description: 'Planning, verification, and UAT files in .planning/ directories',
    pathPatterns: ['.planning/'],
    namePatterns: [],
  },
  {
    id: 'claude-memory',
    label: 'Claude project memory',
    description: 'MEMORY.md and memory/ folder files Claude uses for context',
    pathPatterns: ['/memory/'],
    namePatterns: ['^MEMORY\\.md$'],
  },
  {
    id: 'claude-plans',
    label: 'Claude plan files',
    description: 'Temporary plan files in .claude/plans/',
    pathPatterns: ['plans/'],
    namePatterns: [],
  },
  {
    id: 'claude-cognition',
    label: 'Claude cognition & tasks',
    description: 'Scheduled tasks, cognition sessions, and worktree artifacts',
    pathPatterns: ['.claude/scheduled-tasks/', '.claude/cognition/'],
    namePatterns: [],
  },
];

// Default presets enabled on fresh install — none active by default.
// Presets will be auto-activated based on file matches (handled separately).
export const DEFAULT_ACTIVE_PRESETS: FilterPresetId[] = [];

/**
 * Check if a file matches any of the active presets.
 * Returns the preset ID if matched, or null if the file passes all presets.
 */
export function matchesActivePreset(
  filePath: string,
  fileName: string,
  activePresets: FilterPresetId[]
): FilterPresetId | null {
  for (const presetId of activePresets) {
    const preset = FILTER_PRESETS.find(p => p.id === presetId);
    if (!preset) continue;

    // Check path patterns (substring match)
    for (const pattern of preset.pathPatterns) {
      if (filePath.includes(pattern)) return presetId;
    }

    // Check name patterns (regex)
    for (const pattern of preset.namePatterns) {
      try {
        if (new RegExp(pattern).test(fileName)) return presetId;
      } catch { /* invalid regex */ }
    }
  }

  return null;
}

/**
 * Count how many files each preset would filter from a file list.
 */
export function countPresetMatches(
  files: Array<{ path: string; name: string }>,
): Record<FilterPresetId, number> {
  const counts = {} as Record<FilterPresetId, number>;
  for (const preset of FILTER_PRESETS) {
    counts[preset.id] = 0;
    for (const file of files) {
      let matched = false;
      for (const pattern of preset.pathPatterns) {
        if (file.path.includes(pattern)) { matched = true; break; }
      }
      if (!matched) {
        for (const pattern of preset.namePatterns) {
          try {
            if (new RegExp(pattern).test(file.name + '.md')) { matched = true; break; }
          } catch { /* skip */ }
        }
      }
      if (matched) counts[preset.id]++;
    }
  }
  return counts;
}

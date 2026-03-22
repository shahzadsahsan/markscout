// MarkReader — Filter Presets
// Seeded from actual analysis of ~/Vibe Coding/ and ~/.claude/ file populations.
// Each preset filters a category of Claude Code-generated files.

import type { FilterPreset, FilterPresetId } from './types';

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'claude-plugins',
    label: 'Plugin & Agent docs',
    description: 'Reference docs, skills, and configs inside .claude/plugins/ and .claude/agents/',
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
    id: 'rvry-sessions',
    label: 'RVRY deepthink sessions',
    description: 'Session logs from /deepthink, /think, /challenge in .rvry/sessions/',
    pathPatterns: ['.rvry/sessions/', '.rvry/'],
    namePatterns: [],
  },
  {
    id: 'gsd-pipeline',
    label: 'GSD pipeline artifacts',
    description: 'Planning, verification, and UAT files in .planning/ directories',
    pathPatterns: ['.planning/'],
    namePatterns: [],
  },
  {
    id: 'claude-memory',
    label: 'Claude project memory',
    description: 'MEMORY.md and memory/ folder files Claude uses for context',
    pathPatterns: ['projects/', '/memory/'],
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
    id: 'claude-requirements',
    label: 'Requirements pipeline',
    description: 'Requirements discovery artifacts in .claude/requirements/',
    pathPatterns: ['requirements/'],
    namePatterns: [],
  },
  {
    id: 'readme-files',
    label: 'README files',
    description: 'README.md files across all projects',
    pathPatterns: [],
    namePatterns: ['^README\\.md$'],
  },
  {
    id: 'agents-md',
    label: 'AGENTS.md files',
    description: 'Auto-generated AGENTS.md from Next.js scaffold',
    pathPatterns: [],
    namePatterns: ['^AGENTS\\.md$'],
  },
  {
    id: 'claude-cognition',
    label: 'Claude cognition & tasks',
    description: 'Scheduled tasks, cognition sessions, and worktree artifacts',
    pathPatterns: ['.claude/scheduled-tasks/', '.claude/cognition/'],
    namePatterns: [],
  },
];

// Default presets enabled on fresh install — hides the noisiest categories
export const DEFAULT_ACTIVE_PRESETS: FilterPresetId[] = [
  'claude-plugins',     // 345 files — biggest noise source
  'claude-skills',      // 71 files
  'rvry-sessions',      // 53 files
  'gsd-pipeline',       // 50 files
  'agents-md',          // scaffold noise
  'claude-plans',       // 24 files — temporary plan files
  'claude-requirements', // 8 files — requirement pipeline artifacts
  'claude-cognition',   // scheduled tasks + cognition sessions
];

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

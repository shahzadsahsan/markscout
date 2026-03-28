// Distinct, saturated project colors — designed to be visible at small sizes
// Brighter than the v0.7-alpha muted palette that was invisible at 2px
const PROJECT_COLORS = [
  '#5ba3a3', // teal
  '#c4956a', // amber
  '#9b7bbf', // purple
  '#6aab6a', // green
  '#bf6a8a', // rose
  '#6a8abf', // blue
  '#b5a84a', // gold
  '#bf7a5a', // copper
  '#4ab5a0', // mint
  '#8aab4a', // lime
  '#7a6abf', // indigo
  '#bf8abf', // orchid
];

export function getProjectColor(project: string): string {
  let hash = 0;
  for (let i = 0; i < project.length; i++) {
    hash = ((hash << 5) - hash + project.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// MarkScout — GitHub Release Update Checker
// Checks api.github.com for newer releases. No new dependencies.

import * as https from 'https';
import * as os from 'os';

const REPO = 'shahzadsahsan/markscout';
const CURRENT_VERSION: string = require('../../package.json').version;

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  dmgUrl: string | null;
  releaseNotes: string;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string;
  assets?: { name: string; browser_download_url: string }[];
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function fetchJSON(url: string): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': `MarkScout/${CURRENT_VERSION}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      timeout: 10000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (location) {
          fetchJSON(location).then(resolve, reject);
          return;
        }
      }

      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const release = await fetchJSON(`https://api.github.com/repos/${REPO}/releases/latest`);

    const latestVersion = release.tag_name.replace(/^v/, '');

    if (compareVersions(latestVersion, CURRENT_VERSION) <= 0) {
      return null; // Up to date
    }

    // Find DMG asset matching current arch
    const arch = os.arch(); // 'arm64' or 'x64'
    const dmgAsset = release.assets?.find(a =>
      a.name.endsWith('.dmg') && (a.name.includes(arch) || !a.name.includes('x64'))
    );

    return {
      hasUpdate: true,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      releaseUrl: release.html_url,
      dmgUrl: dmgAsset?.browser_download_url || null,
      releaseNotes: release.body || '',
    };
  } catch (err) {
    console.log('[MarkScout] Update check failed (non-critical):', (err as Error).message);
    return null;
  }
}

export function getCurrentVersion(): string {
  return CURRENT_VERSION;
}

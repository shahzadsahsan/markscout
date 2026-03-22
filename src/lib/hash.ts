// MarkReader — Content Hash for Move Tracking
// Hash = SHA-256(first 1KB of content + file size)
// This identifies files across renames/moves without reading the entire file.

import { createHash } from 'crypto';
import { open, stat } from 'fs/promises';

const HASH_BYTES = 1024; // Read first 1KB

/**
 * Compute a content hash for move tracking.
 * Uses first 1KB of file content + file size as input.
 * Returns SHA-256 hex string.
 */
export async function computeContentHash(filePath: string): Promise<string> {
  const [fileHandle, fileStat] = await Promise.all([
    open(filePath, 'r'),
    stat(filePath),
  ]);

  try {
    const buffer = Buffer.alloc(HASH_BYTES);
    const { bytesRead } = await fileHandle.read(buffer, 0, HASH_BYTES, 0);

    const hash = createHash('sha256');
    hash.update(buffer.subarray(0, bytesRead));
    hash.update(String(fileStat.size));
    return hash.digest('hex');
  } finally {
    await fileHandle.close();
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

/**
 * Document storage interface: save(buffer) -> key, read(key) -> Readable stream.
 * Swap this class for S3/GCS without touching callers.
 */
export class LocalDiskStorage {
  get dir() {
    const d = path.join(config.dataDir, 'uploads');
    fs.mkdirSync(d, { recursive: true });
    return d;
  }

  async save(buffer) {
    const key = randomUUID();
    await fs.promises.writeFile(path.join(this.dir, key), buffer);
    return key;
  }

  read(key) {
    if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('Invalid storage key');
    return fs.createReadStream(path.join(this.dir, key));
  }
}

export const storage = new LocalDiskStorage();

/** Detects the real file type from magic bytes (the client-sent MIME type is not trusted). */
export function sniffMime(buf) {
  if (buf.length > 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

/** Strips path characters and control chars from a user-supplied filename. */
export function safeFilename(name) {
  const base = path.basename(String(name || 'document')).replace(/[^\w.\- ()]/g, '_');
  return base.slice(0, 100) || 'document';
}

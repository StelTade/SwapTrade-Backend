import { Injectable, Logger } from '@nestjs/common';
import { appendFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { WormSink } from './audit-log.service';

export const WORM_DIR_TOKEN = 'AUDIT_WORM_DIR';

/**
 * Filesystem-backed append-only sink. Writes one JSON object per line and
 * only ever opens the file in append mode ('a'), approximating write-once
 * semantics locally. In production configure AUDIT_WORM_DIR to point at a
 * mounted S3/WORM volume that enforces object lock.
 */
@Injectable()
export class FileWormSink implements WormSink {
  private readonly logger = new Logger(FileWormSink.name);
  private readonly dir: string;

  constructor(dir?: string) {
    this.dir = resolve(
      dir || process.env.AUDIT_WORM_DIR || join(process.cwd(), 'audit-worm'),
    );
  }

  async append(entry: {
    id: string;
    checksum: string;
    previousChecksum: string | null;
    eventType: string;
    createdAt: Date;
    payload: string;
  }): Promise<void> {
    const file = join(
      this.dir,
      `audit-${entry.createdAt.toISOString().slice(0, 10)}.jsonl`,
    );
    await mkdir(this.dir, { recursive: true });
    // flag 'a' — POSIX append mode; writes are never able to clobber
    // existing bytes, which is the local equivalent of WORM.
    await appendFile(file, `${JSON.stringify(entry)}\n`, { flag: 'a' });
  }
}

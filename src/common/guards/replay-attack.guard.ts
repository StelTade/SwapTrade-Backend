import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10_000;

@Injectable()
export class ReplayAttackGuard implements CanActivate {
  private readonly seen = new Map<string, number>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const nonce = req.headers['x-request-nonce'] as string | undefined;
    const timestampHeader = req.headers['x-request-timestamp'] as
      | string
      | undefined;

    if (!nonce || !timestampHeader) {
      throw new UnauthorizedException(
        'Missing replay-protection headers (x-request-nonce, x-request-timestamp).',
      );
    }

    const timestamp = Number(timestampHeader);
    if (isNaN(timestamp)) {
      throw new UnauthorizedException(
        'x-request-timestamp must be a Unix epoch in milliseconds.',
      );
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > NONCE_TTL_MS) {
      throw new UnauthorizedException(
        'Request timestamp is outside the acceptable window.',
      );
    }

    if (this.seen.has(nonce)) {
      throw new UnauthorizedException(
        'Duplicate nonce detected — possible replay attack.',
      );
    }

    // Evict stale entries before inserting to cap memory usage
    this.evictExpired(now);
    this.seen.set(nonce, timestamp);

    return true;
  }

  private evictExpired(now: number): void {
    if (this.seen.size < MAX_CACHE_SIZE) return;
    for (const [key, ts] of this.seen.entries()) {
      if (now - ts > NONCE_TTL_MS) {
        this.seen.delete(key);
      }
    }
  }
}

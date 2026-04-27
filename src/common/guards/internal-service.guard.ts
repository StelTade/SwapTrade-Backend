import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { INTERNAL_ONLY_KEY } from '../decorators/internal-only.decorator';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']);

/**
 * InternalServiceGuard
 *
 * Protects endpoints decorated with @InternalOnly() from public access.
 *
 * An internal request is one that satisfies AT LEAST ONE of:
 * 1. Originates from a loopback address (127.0.0.1, ::1) — intra-service calls
 * 2. Includes a valid `X-Internal-Request: <INTERNAL_API_SECRET>` header
 *
 * This prevents internal service methods from being accidentally exposed
 * to the public internet through controllers.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  private readonly logger = new Logger(InternalServiceGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isInternal = this.reflector.getAllAndOverride<boolean>(INTERNAL_ONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Not an internal endpoint — allow through
    if (!isInternal) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.extractIp(request);

    // ── Check 1: loopback address ──────────────────────────────────────────
    if (LOOPBACK_ADDRESSES.has(clientIp)) {
      this.logger.debug(`[InternalServiceGuard] Loopback access granted | ip=${clientIp} | ${request.path}`);
      return true;
    }

    // ── Check 2: shared internal secret header ─────────────────────────────
    const internalSecret = process.env.INTERNAL_API_SECRET;
    const providedSecret = request.headers['x-internal-request'] as string | undefined;

    if (internalSecret && providedSecret && providedSecret === internalSecret) {
      this.logger.debug(`[InternalServiceGuard] Secret header access granted | ip=${clientIp} | ${request.path}`);
      return true;
    }

    // ── Denied ─────────────────────────────────────────────────────────────
    this.logger.warn(
      `[InternalServiceGuard] BLOCKED public access to internal endpoint | ip=${clientIp} | ${request.method} ${request.path}`,
    );
    throw new ForbiddenException('This endpoint is restricted to internal services.');
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
    }
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }
}

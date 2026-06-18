import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '../config/config.service';
import { USER_ROLE_MULTIPLIERS } from './ratelimit.config';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rl: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns a multiplier based on the user's role/tier from the JWT payload.
   * PREMIUM users get 2x, ADMIN/STAFF get higher multipliers.
   */
  private getTierMultiplier(req: Request): number {
    const user = (req as any).user;
    if (!user) return USER_ROLE_MULTIPLIERS.USER;
    const role: string = (user.role ?? user.tier ?? '').toUpperCase();
    return (
      (USER_ROLE_MULTIPLIERS as Record<string, number>)[role] ??
      USER_ROLE_MULTIPLIERS.USER
    );
  }

  private keyForRequest(req: Request, keyGenerator?: 'ip' | 'user'): string {
    if (keyGenerator === 'user' && (req as any).user?.id) {
      return `user:${(req as any).user.id}`;
    }
    return `ip:${req.ip || (req as any).connection?.remoteAddress || 'unknown'}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse();

    const meta =
      this.reflector.get<Partial<RateLimitOptions>>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      ) || {};

    const cfg = this.config.rateLimit;
    const basePoints = meta.points ?? cfg?.maxRequests ?? 100;
    const multiplier = this.getTierMultiplier(req);
    const points = Math.ceil(basePoints * multiplier);
    const refillPerSecond =
      meta.refillPerSecond ??
      Math.max(1, Math.floor(points / ((cfg?.windowMs ?? 60000) / 1000)));
    const burst = meta.burst ? Math.ceil(meta.burst * multiplier) : points;
    const keyGen =
      (meta.keyGenerator as 'ip' | 'user') ??
      ((req as any).user?.id ? 'user' : 'ip');

    const identifier = this.keyForRequest(req, keyGen);
    const endpoint = req.route?.path || req.originalUrl || req.url;

    const { allowed, remaining, reset } = await this.rl.check(
      identifier,
      endpoint,
      { points, refillPerSecond, burst },
    );

    try {
      res.setHeader('X-RateLimit-Limit', String(burst));
      res.setHeader('X-RateLimit-Remaining', String(Math.floor(remaining)));
      res.setHeader('X-RateLimit-Reset', String(reset));
      res.setHeader('X-RateLimit-Tier', String(multiplier));
    } catch (_e) {}

    return allowed;
  }
}

import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rl: RateLimitService, private readonly config: ConfigService) {}

  private keyForRequest(req: Request, keyGenerator?: 'ip' | 'user') {
    if (keyGenerator === 'user' && (req as any).user && (req as any).user.id) {
      return `user:${(req as any).user.id}`;
    }
    return `ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse();

    const meta = this.reflector.get<Partial<RateLimitOptions>>(RATE_LIMIT_KEY, context.getHandler()) || {};

    const cfg = this.config.rateLimit;
    const points = meta.points ?? cfg?.maxRequests ?? 100;
    const refillPerSecond = meta.refillPerSecond ?? Math.max(1, Math.floor(points / ((cfg?.windowMs ?? 60000) / 1000)));
    const burst = meta.burst ?? points;
    const keyGen = (meta.keyGenerator as 'ip' | 'user') ?? (cfg?.keyGenerator === 'req.ip' ? 'ip' : 'ip');

    const identifier = this.keyForRequest(req, keyGen);
    const endpoint = req.route?.path || req.originalUrl || req.url;

    const { allowed, remaining, reset } = await this.rl.check(identifier, endpoint, { points, refillPerSecond, burst });

    // set headers
    try {
      res.setHeader('X-RateLimit-Limit', String(burst));
      res.setHeader('X-RateLimit-Remaining', String(Math.floor(remaining)));
      res.setHeader('X-RateLimit-Reset', String(reset));
    } catch (e) {}

    return allowed;
  }
}

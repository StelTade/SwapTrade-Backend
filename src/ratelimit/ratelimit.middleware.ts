import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from './rate-limit.service';
import { ConfigService } from '../config/config.service';

export function rateLimitMiddlewareFactory(rl: RateLimitService, config: ConfigService) {
  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      if (!config.features?.enableRateLimiting) return next();
      const keyGen = config.rateLimit?.keyGenerator ?? 'req.ip';
      const identifier = keyGen === 'req.ip' ? `ip:${req.ip}` : `ip:${req.ip}`;
      const endpoint = req.path || req.originalUrl || req.url;
      const { allowed, remaining, reset } = await rl.check(identifier, endpoint);
      res.setHeader('X-RateLimit-Limit', String(config.rateLimit?.maxRequests ?? 100));
      res.setHeader('X-RateLimit-Remaining', String(Math.floor(remaining)));
      res.setHeader('X-RateLimit-Reset', String(reset));
      if (!allowed) {
        res.status(429).json({ message: config.rateLimit?.message || 'Too many requests' });
        return;
      }
    } catch (err) {
      // On error, allow request (fail open) but log
      // eslint-disable-next-line no-console
      console.warn('Rate limit middleware error', (err as Error).message);
    }

    next();
  };
}
/**
 * Rate Limiting Middleware
 * 
 * Express middleware for rate limiting that uses the RateLimitService
 * This middleware should be registered in main.ts once dependencies are installed
 */

import { RateLimitService } from './ratelimit.service';

// Type definitions for Express (will be available when express is installed)
interface Request {
  ip?: string;
  connection?: { remoteAddress?: string };
  user?: { id?: string; role?: string };
  path: string;
}

interface Response {
  setHeader(name: string, value: string | number): void;
  status(code: number): Response;
  json(body: any): void;
}

type NextFunction = () => void;

export class RateLimitMiddleware {
  private rateLimitService: RateLimitService;

  constructor() {
    this.rateLimitService = new RateLimitService();
  }

  /**
   * Express middleware function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    const userId = req.user?.id || null;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const endpoint = req.path;
    const userRole = req.user?.role;

    const result = this.rateLimitService.checkRateLimit(userId, ip, endpoint, userRole);

    // Set rate limit headers
    Object.entries(result.headers).forEach(([header, value]) => {
      res.setHeader(header, value);
    });

    if (!result.allowed) {
      res.status(429).json({
        statusCode: 429,
        message: 'Too Many Requests',
        error: 'Too Many Requests',
        retryAfter: result.retryAfter,
      });
      return;
    }

    next();
  }

  /**
   * Get rate limit statistics for monitoring
   */
  getStats() {
    return this.rateLimitService.getStats();
  }

  /**
   * Reset rate limit for a specific user/IP
   */
  resetRateLimit(identifier: string) {
    this.rateLimitService.resetRateLimit(identifier);
  }
}

// Export singleton instance
export const rateLimitMiddleware = new RateLimitMiddleware();
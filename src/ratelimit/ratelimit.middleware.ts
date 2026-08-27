import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitService, CheckResult } from './rate-limit.service';
import { AbuseDetectionService } from './abuse-detection.service';
import { ConfigService } from '../config/config.service';
import { RATE_LIMIT_CONFIG, ENDPOINT_RATE_LIMIT_MAP } from './ratelimit.config';

/**
 * Interface extending Express Request to include user info from JWT
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    role?: string;
    tier?: string;
  };
}

/**
 * Role-based multiplier for rate limits.
 * Higher roles get more generous limits.
 */
const ROLE_MULTIPLIERS: Record<string, number> = {
  ADMIN: 5,
  STAFF: 3,
  PREMIUM: 2,
  INSTITUTIONAL_CLIENT: 10,
  USER: 1,
};

/**
 * Rate Limiting Middleware
 *
 * Express middleware that enforces per-IP and per-user rate limiting.
 * - Unauthenticated requests: rate limited by IP
 * - Authenticated requests: rate limited by user ID (preferred) + IP fallback
 * - Sets standard rate limit headers on every response
 * - Returns 429 with Retry-After header when limit exceeded
 * - Integrates with abuse detection for auto-blocking
 *
 * Configuration is read from environment variables and the RateLimitConfig.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly abuseDetectionService: AbuseDetectionService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check if rate limiting is enabled
      if (!this.configService.features?.enableRateLimiting) {
        return next();
      }

      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id || null;
      const userRole = authReq.user?.role || authReq.user?.tier || null;
      const ip = this.extractClientIp(req);
      const endpoint = this.resolveEndpoint(req);
      const rateLimitCfg = this.configService.rateLimit;

      // Determine the identifier: prefer user ID for authenticated requests
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;

      // Look up endpoint-specific limits, fall back to global
      const endpointConfig = this.getEndpointConfig(endpoint);
      const basePoints = endpointConfig.limit;
      const multiplier = this.getRoleMultiplier(userRole);
      const points = Math.ceil(basePoints * multiplier);

      // Calculate refill rate: tokens per second based on window
      const refillPerSecond = Math.max(
        1,
        Math.floor(points / (endpointConfig.windowMs / 1000)),
      );

      // Check rate limit using Redis-backed service
      const result: CheckResult = await this.rateLimitService.check(
        identifier,
        endpoint,
        { points, refillPerSecond, burst: points },
      );

      // Set standard rate limit headers
      this.setRateLimitHeaders(res, points, result, endpointConfig.windowMs);

      // Track request for abuse detection (async, non-blocking)
      this.trackForAbuseDetection(authReq, endpoint).catch((err) => {
        this.logger.warn(
          'Abuse detection tracking failed',
          (err as Error).message,
        );
      });

      if (!result.allowed) {
        this.send429Response(res, result, endpoint);
        return;
      }

      next();
    } catch (err) {
      // Fail open: on any error, allow the request through but log
      this.logger.warn(
        'Rate limit middleware error, failing open',
        (err as Error).message,
      );
      next();
    }
  }

  /**
   * Extract the real client IP, considering proxies (X-Forwarded-For, X-Real-IP).
   */
  private extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      // Take the first IP in the chain (original client)
      return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
      return realIp;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  /**
   * Resolve the endpoint key for rate limit matching.
   * Uses the route path if available, otherwise the original URL.
   */
  private resolveEndpoint(req: Request): string {
    const route = (req as any).route?.path;
    if (route) return route;
    // Strip query string for consistent matching
    const url = req.originalUrl || req.url || '';
    return url.split('?')[0];
  }

  /**
   * Find the matching endpoint config based on path prefix.
   */
  private getEndpointConfig(
    endpoint: string,
  ): (typeof RATE_LIMIT_CONFIG)[keyof typeof RATE_LIMIT_CONFIG] {
    const mapKey = Object.keys(ENDPOINT_RATE_LIMIT_MAP).find(
      (key) => key !== 'default' && endpoint.startsWith(key),
    );

    if (mapKey && ENDPOINT_RATE_LIMIT_MAP[mapKey]) {
      return ENDPOINT_RATE_LIMIT_MAP[mapKey];
    }

    return RATE_LIMIT_CONFIG.GLOBAL;
  }

  /**
   * Get the role-based multiplier. Unknown roles default to USER (1x).
   */
  private getRoleMultiplier(role: string | null): number {
    if (!role) return ROLE_MULTIPLIERS.USER;
    return ROLE_MULTIPLIERS[role.toUpperCase()] ?? ROLE_MULTIPLIERS.USER;
  }

  /**
   * Set standard rate limit response headers.
   */
  private setRateLimitHeaders(
    res: Response,
    limit: number,
    result: CheckResult,
    windowMs: number,
  ): void {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.floor(result.remaining)));
    res.setHeader('X-RateLimit-Reset', String(result.reset));

    // Retry-After should only be set when rate limited (RFC 6585 / RFC 7231)
    if (!result.allowed) {
      const retryAfter = Math.max(result.reset, 1);
      res.setHeader('Retry-After', String(retryAfter));
    }
  }

  /**
   * Send a 429 Too Many Requests response with meaningful body.
   */
  private send429Response(
    res: Response,
    result: CheckResult,
    endpoint: string,
  ): void {
    const retryAfter = Math.max(result.reset, 1);
    const message =
      this.configService.rateLimit?.message ||
      'Too many requests. Please slow down and try again later.';

    res.status(429).json({
      statusCode: 429,
      message,
      error: 'Too Many Requests',
      retryAfter,
      endpoint,
      documentation:
        'https://docs.swaptrade.com/api/rate-limits',
    });
  }

  /**
   * Track the request with abuse detection service (non-blocking).
   */
  private async trackForAbuseDetection(
    req: AuthenticatedRequest,
    endpoint: string,
  ): Promise<void> {
    const ip = this.extractClientIp(req);
    const userId = req.user?.id;
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;

    const abuseScore = await this.abuseDetectionService.trackRequest(
      identifier,
      endpoint,
      {
        userAgent: req.headers['user-agent'],
        method: req.method,
      },
    );

    // Track user IP for distributed attack detection
    if (userId) {
      await this.abuseDetectionService.trackUserIP(userId, ip);
    }

    // If abuse detected, log warning
    if (abuseScore.isBlocked) {
      this.logger.warn(
        `Rate limited blocked identifier due to abuse: ${identifier}, score: ${abuseScore.totalScore}`,
      );
    }
  }
}

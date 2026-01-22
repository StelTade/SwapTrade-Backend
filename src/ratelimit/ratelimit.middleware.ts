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
import { Injectable, NestMiddleware, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests = new Map<string, number[]>();
  private readonly LIMIT = 100; // requests
  private readonly WINDOW = 60 * 1000; // 1 minute
  private readonly logger = new Logger(RateLimitMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const timestamps = this.requests.get(ip) || [];
    const windowStart = now - this.WINDOW;
    
    // Filter old requests
    const activeRequests = timestamps.filter(time => time > windowStart);
    
    if (activeRequests.length >= this.LIMIT) {
      this.logger.warn(`Rate limit exceeded for IP: ${ip}`);
      throw new HttpException({
        status: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Rate Limit Exceeded',
        message: `Too many requests. Please try again in ${Math.ceil((activeRequests[0] + this.WINDOW - now) / 1000)} seconds.`,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }
    
    activeRequests.push(now);
    this.requests.set(ip, activeRequests);
    
    // Cleanup old entries periodically
    if (this.requests.size > 10000) {
        this.cleanup();
    }
    
    next();
  }

  private cleanup() {
    const now = Date.now();
    const windowStart = now - this.WINDOW;
    for (const [ip, timestamps] of this.requests.entries()) {
        const active = timestamps.filter(time => time > windowStart);
        if (active.length === 0) this.requests.delete(ip);
        else this.requests.set(ip, active);
    }
  }
}
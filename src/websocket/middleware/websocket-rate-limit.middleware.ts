import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';

@Injectable()
export class WebSocketRateLimitMiddleware implements NestMiddleware {
  private rateLimiter: any;

  constructor() {
    this.rateLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many WebSocket connection attempts',
        retryAfter: 60
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip successful requests
      skipSuccessfulRequests: true,
      // Only count failed requests
      keyGenerator: (req: Request) => {
        return req.ip + ':' + req.path;
      }
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Apply rate limiting only to WebSocket upgrade requests
    if (req.url?.includes('/socket.io/') && req.method === 'GET') {
      this.rateLimiter(req, res, next);
    } else {
      next();
    }
  }
}

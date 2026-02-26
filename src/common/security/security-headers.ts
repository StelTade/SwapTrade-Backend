import helmet from 'helmet';
import { INestApplication } from '@nestjs/common';

export function configureSecurityHeaders(app: INestApplication) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
      frameguard: { action: 'deny' },
      hsts: {
        maxAge: 15552000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'no-referrer' },
      xssFilter: true,
    }) as any,
  );
}

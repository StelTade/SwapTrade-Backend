import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

const TOKEN_HEADER = 'x-csrf-token';
const TOKEN_COOKIE = 'csrf_token';

export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  const method = req.method.toUpperCase();
  const unsafe = ['POST', 'PUT', 'PATCH', 'DELETE'];

  let token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) {
    token = crypto.randomBytes(32).toString('hex');
    res.cookie(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }

  if (!unsafe.includes(method)) {
    return next();
  }

  const headerToken = req.header(TOKEN_HEADER);
  if (!headerToken || headerToken !== token) {
    res.status(403).json({ message: 'Invalid CSRF token' });
    return;
  }

  next();
}

import * as crypto from 'crypto';

export function signPayload(secret: string, payload: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifySignature(secret: string, payload: string, signature: string) {
  const expected = signPayload(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}


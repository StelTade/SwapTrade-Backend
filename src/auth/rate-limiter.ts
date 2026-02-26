const ATTEMPTS = new Map<string, { count: number; lastAttempt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const record = ATTEMPTS.get(key);

  if (!record) {
    ATTEMPTS.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  if (now - record.lastAttempt > WINDOW_MS) {
    ATTEMPTS.set(key, { count: 1, lastAttempt: now });
    return true;
  }

  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  record.lastAttempt = now;
  return true;
}

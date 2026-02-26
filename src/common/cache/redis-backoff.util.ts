/**
 * Adaptive exponential backoff with jitter for Redis retries.
 * delay = min(max, base * 2^attempt) + jitter (up to 20%).
 */
export function adaptiveBackoffWithJitter(
  attempt: number,
  baseMs: number,
  maxMs: number,
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  const jitter = Math.random() * capped * 0.2;
  return Math.floor(capped + jitter);
}

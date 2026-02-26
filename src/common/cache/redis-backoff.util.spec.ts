import { adaptiveBackoffWithJitter } from './redis-backoff.util';

describe('adaptiveBackoffWithJitter', () => {
  it('should return at least baseMs for attempt 0', () => {
    const delay = adaptiveBackoffWithJitter(0, 100, 30000);
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(100 + 100 * 0.2);
  });

  it('should increase with attempt (exponential)', () => {
    const d0 = adaptiveBackoffWithJitter(0, 100, 30000);
    const d1 = adaptiveBackoffWithJitter(1, 100, 30000);
    const d2 = adaptiveBackoffWithJitter(2, 100, 30000);
    expect(d1).toBeGreaterThanOrEqual(d0);
    expect(d2).toBeGreaterThanOrEqual(d1);
  });

  it('should cap at maxMs', () => {
    const delay = adaptiveBackoffWithJitter(20, 100, 5000);
    expect(delay).toBeLessThanOrEqual(5000 + 5000 * 0.2);
  });

  it('should return a number', () => {
    const delay = adaptiveBackoffWithJitter(3, 50, 10000);
    expect(Number.isFinite(delay)).toBe(true);
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

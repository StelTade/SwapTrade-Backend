import { computeSortino, pairRoundTrips } from './sortino.util';

describe('pairRoundTrips', () => {
  it('returns no trips from no trades', () => {
    expect(pairRoundTrips([])).toEqual([]);
  });

  it('pairs a single BUY→SELL round-trip', () => {
    const trades = [
      { asset: 'BTC', type: 'BUY', price: 100, amount: 1 },
      { asset: 'BTC', type: 'SELL', price: 110, amount: 1 },
    ];
    const trips = pairRoundTrips(trades);
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({
      asset: 'BTC',
      entrySide: 'BUY',
      entryPrice: 100,
      exitPrice: 110,
    });
    expect(trips[0].returnPct).toBeCloseTo(0.1, 5);
  });

  it('inverts return sign for SELL→BUY (short) round-trips', () => {
    const trades = [
      { asset: 'BTC', type: 'SELL', price: 110, amount: 1 },
      { asset: 'BTC', type: 'BUY', price: 100, amount: 1 },
    ];
    const trips = pairRoundTrips(trades);
    expect(trips).toHaveLength(1);
    // short: profit when entry > exit; convention is fraction of
    // capital deployed (= entry price for shorts). So (110-100)/110
    // ≈ 0.0909. This matches the long-case convention where return
    // is (exit - entry)/entry.
    expect(trips[0].returnPct).toBeCloseTo(0.0909, 4);
  });

  it('FIFO matches when one side is split across multiple lots', () => {
    const trades = [
      { asset: 'BTC', type: 'BUY', price: 100, amount: 0.5 },
      { asset: 'BTC', type: 'BUY', price: 110, amount: 0.5 },
      { asset: 'BTC', type: 'SELL', price: 90, amount: 1 },
    ];
    const trips = pairRoundTrips(trades);
    expect(trips).toHaveLength(2);
    expect(trips[0].returnPct).toBeCloseTo(-0.1, 5);
    expect(trips[1].returnPct).toBeCloseTo(-0.181818, 4);
  });

  it('ignores unclosed positions', () => {
    const trades = [{ asset: 'BTC', type: 'BUY', price: 100, amount: 1 }];
    expect(pairRoundTrips(trades)).toEqual([]);
  });
});

describe('computeSortino', () => {
  it('returns zero for empty input', () => {
    const res = computeSortino([]);
    expect(res.sortinoRatio).toBe(0);
    expect(res.sampleSize).toBe(0);
  });

  it('returns sortinoRatio = mean / downsideDeviation with negatives', () => {
    const trips = [
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 110,
        returnPct: 0.1,
      },
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 95,
        returnPct: -0.05,
      },
    ];
    const res = computeSortino(trips);
    // mean = (0.10 + -0.05)/2 = 0.025
    // negatives only: [-0.05], mean(squared) = 0.0025, sqrt = 0.05
    // sortino = 0.025/0.05 = 0.5
    expect(res.sortinoRatio).toBeCloseTo(0.5, 5);
    expect(res.meanReturn).toBeCloseTo(0.025, 5);
    expect(res.downsideDeviation).toBeCloseTo(0.05, 5);
    expect(res.sampleSize).toBe(2);
  });

  it('returns sortinoRatio = 0 when no downside observed', () => {
    const trips = [
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 110,
        returnPct: 0.1,
      },
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 130,
        returnPct: 0.3,
      },
    ];
    const res = computeSortino(trips);
    expect(res.sortinoRatio).toBe(0); // no σ_d → undefined → clamped 0
    expect(res.meanReturn).toBeCloseTo(0.2, 5);
    expect(res.downsideDeviation).toBe(0);
  });

  it('skips zeros from the downside set', () => {
    const trips = [
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 100,
        returnPct: 0,
      },
      {
        entrySide: 'BUY' as const,
        asset: 'BTC',
        entryPrice: 100,
        exitPrice: 110,
        returnPct: 0.1,
      },
    ];
    const res = computeSortino(trips);
    expect(res.downsideDeviation).toBe(0);
  });
});

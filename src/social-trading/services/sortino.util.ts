/**
 * Sortino ratio calculation utilities.
 *
 * Pure functions — no DI, no DB. Kept out of a @Injectable service so
 * the math can be unit-tested without bootstrapping Nest.
 *
 * ACCEPTANCE CRITERION #2: "Leaderboards use Sortino ratio for fair
 * ranking". Sortino differs from Sharpe by using only the downside
 * deviation (negative returns) in the denominator, so strategies with
 * the same mean return but fewer/low-magnitude drawdowns score higher.
 *
 * Formula (per Investopedia / Sortino & van der Meer 1991):
 *
 *     Sortino = (μ_p − r_f) / σ_d
 *
 * where μ_p is the mean return of closed positions, r_f is a target /
 * risk-free return (we use 0 here for an absolute, asset-class-agnostic
 * score), and σ_d is sqrt(mean(squared negative returns)).
 *
 * Returns are recovered from Trade rows via pair BUY-followed-by-SELL
 * (and vice versa) into round-trip percentages; this is the same
 * approximation Binance / 3Commas use internally for trade history
 * tables that don't track explicit position close events.
 */

export interface RoundTripReturn {
  /** Direction of the original entry (BUY or SELL). */
  entrySide: 'BUY' | 'SELL';
  asset: string;
  entryPrice: number;
  exitPrice: number;
  /** Signed percentage return: positive = profit, negative = loss. */
  returnPct: number;
}

export interface SortinoResult {
  /** μ_p / σ_d, or 0 if σ_d is 0 (no downside observed yet). */
  sortinoRatio: number;
  meanReturn: number;
  downsideDeviation: number;
  /** Total count of round-trips used; lets callers decide if the
   *  sample size is statistically meaningful. */
  sampleSize: number;
}

/**
 * Pairs consecutive trades on the same asset into BUY→SELL and
 * SELL→BUY round-trips. Each trade closes at most one round-trip;
 * leftover open positions are ignored (they have no exit price).
 *
 * Trade rows arrive in chronological order. We model the user's
 * "position book" as a list of (side, price, amountRemaining) tuples
 * per asset and FIFO close them.
 */
export function pairRoundTrips(
  trades: Array<{
    asset: string;
    type: string;
    price: number;
    amount: number;
  }>,
): RoundTripReturn[] {
  type OpenLot = { side: 'BUY' | 'SELL'; price: number; remaining: number };
  const open: Map<string, OpenLot[]> = new Map();
  const trips: RoundTripReturn[] = [];

  for (const t of trades) {
    if (t.type !== 'BUY' && t.type !== 'SELL') continue;
    const side = t.type;

    // FIFO close against lots of the opposite side.
    const oppositeSide = side === 'BUY' ? 'SELL' : 'BUY';
    const oppList = open.get(t.asset) ?? [];
    let remaining = t.amount;

    // Filter to opposite-side lots only.
    const oppositeLots: OpenLot[] = [];
    const sameLots: OpenLot[] = [];
    for (const lot of oppList) {
      if (lot.side === oppositeSide) oppositeLots.push(lot);
      else sameLots.push(lot);
    }

    const newOppList: OpenLot[] = [...sameLots];
    for (const lot of oppositeLots) {
      if (remaining <= 0) {
        newOppList.push(lot);
        continue;
      }
      const closeAmount = Math.min(lot.remaining, remaining);
      const entryPrice = lot.price;
      const exitPrice = t.price;
      // For BUY-lots: return = (exit - entry) / entry  (long exit)
      // For SELL-lots: return = (entry - exit) / entry  (short exit)
      const returnPct =
        lot.side === 'BUY'
          ? (exitPrice - entryPrice) / entryPrice
          : (entryPrice - exitPrice) / entryPrice;

      trips.push({
        entrySide: lot.side,
        asset: t.asset,
        entryPrice,
        exitPrice,
        returnPct,
      });

      lot.remaining -= closeAmount;
      remaining -= closeAmount;
      if (lot.remaining > 0) newOppList.push(lot);
    }
    // Open a new lot for any leftover on this trade (it's an entry).
    if (remaining > 0) {
      newOppList.push({ side, price: t.price, remaining });
    }
    open.set(t.asset, newOppList);
  }

  return trips;
}

/**
 * Computes the Sortino ratio from a list of round-trip returns.
 *
 * - μ_p = mean(returnPct) across all trips
 * - σ_d = sqrt(mean(returnPct^2)) over only the negative-return trips
 *        (NOT counting zeros — they're not downside)
 * - Sortino = (μ_p - r_f) / σ_d
 *
 * Returns ({sortinoRatio: 0, ...}) if σ_d is 0 (i.e. no negative
 * returns yet) — a Sortino of 0 with positive mean return is the
 * correct "undefined downside" anchor, same convention QuantConnect
 * uses.
 */
export function computeSortino(
  trips: RoundTripReturn[],
  riskFreeReturn = 0,
): SortinoResult {
  if (trips.length === 0) {
    return {
      sortinoRatio: 0,
      meanReturn: 0,
      downsideDeviation: 0,
      sampleSize: 0,
    };
  }
  const returns = trips.map((t) => t.returnPct);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const negatives = returns.filter((r) => r < 0);
  const downsideVariance =
    negatives.length === 0
      ? 0
      : negatives.reduce((a, b) => a + b * b, 0) / negatives.length;
  const downsideDeviation = Math.sqrt(downsideVariance);
  const sortinoRatio =
    downsideDeviation === 0 ? 0 : (mean - riskFreeReturn) / downsideDeviation;
  return {
    sortinoRatio,
    meanReturn: mean,
    downsideDeviation,
    sampleSize: trips.length,
  };
}

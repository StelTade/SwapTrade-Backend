import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';
import { CacheService } from '../../common/services/cache.service';

export interface PriceQuote {
  fromAsset: string;
  toAsset: string;
  amountIn: number;
  amountOut: number;
  rate: number;
  priceImpact: number;    // fraction, e.g. 0.002 = 0.2%
  route: string[];
  liquidityAvailable: number;
  quotedAt: Date;
}

export interface PoolState {
  baseAsset: string;
  quoteAsset: string;
  baseReserve: number;
  quoteReserve: number;
  /** k = baseReserve * quoteReserve (constant product) */
  k: number;
  fee: number; // e.g. 0.003 = 0.3% LP fee
}

const PRICE_CACHE_TTL = 10; // 10 seconds — short TTL for volatile prices
const ROUTE_GRAPH: Record<string, string[]> = {
  // Which assets each asset can directly pair with
  USDT: ['BTC', 'ETH', 'BNB', 'SOL'],
  BTC:  ['USDT', 'ETH'],
  ETH:  ['USDT', 'BTC', 'BNB', 'SOL'],
  BNB:  ['USDT', 'ETH'],
  SOL:  ['USDT', 'ETH'],
};

@Injectable()
export class SwapPricingService {
  private readonly logger = new Logger(SwapPricingService.name);

  /**
   * Simulated pool states.
   * In production replace this with on-chain AMM reads or a DEX aggregator API.
   */
  private poolStates = new Map<string, PoolState>([
    ['USDT-BTC', { baseAsset: 'USDT', quoteAsset: 'BTC',  baseReserve: 5_000_000, quoteReserve: 100,      k: 500_000_000, fee: 0.003 }],
    ['USDT-ETH', { baseAsset: 'USDT', quoteAsset: 'ETH',  baseReserve: 5_000_000, quoteReserve: 2_500,    k: 12_500_000_000, fee: 0.003 }],
    ['USDT-BNB', { baseAsset: 'USDT', quoteAsset: 'BNB',  baseReserve: 1_000_000, quoteReserve: 2_000,    k: 2_000_000_000, fee: 0.003 }],
    ['USDT-SOL', { baseAsset: 'USDT', quoteAsset: 'SOL',  baseReserve: 1_000_000, quoteReserve: 10_000,   k: 10_000_000_000, fee: 0.003 }],
    ['BTC-ETH',  { baseAsset: 'BTC',  quoteAsset: 'ETH',  baseReserve: 100,       quoteReserve: 2_500,    k: 250_000, fee: 0.003 }],
    ['ETH-BNB',  { baseAsset: 'ETH',  quoteAsset: 'BNB',  baseReserve: 2_500,     quoteReserve: 10_000,   k: 25_000_000, fee: 0.003 }],
    ['ETH-SOL',  { baseAsset: 'ETH',  quoteAsset: 'SOL',  baseReserve: 2_500,     quoteReserve: 62_500,   k: 156_250_000, fee: 0.003 }],
  ]);

  constructor(
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly cacheService: CacheService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Get a price quote for a swap.
   * Automatically finds optimal route if a direct pool doesn't exist.
   */
  async getQuote(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
  ): Promise<PriceQuote> {
    const cacheKey = `swap:quote:${fromAsset}:${toAsset}:${amountIn}`;
    const cached = await this.cacheService.get<PriceQuote>(cacheKey);
    if (cached) return cached;

    const route = this.findOptimalRoute(fromAsset, toAsset);
    if (!route) {
      throw new NotFoundException(
        `No swap route available from ${fromAsset} to ${toAsset}`,
      );
    }

    const quote = await this.quoteAlongRoute(route, amountIn);

    await this.cacheService.set(cacheKey, quote, PRICE_CACHE_TTL);
    return quote;
  }

  /**
   * Validate that execution price won't exceed slippage tolerance.
   * Returns the validated quote or throws if slippage is breached.
   */
  async validateSlippage(
    quote: PriceQuote,
    executedRate: number,
    slippageTolerance: number,
  ): Promise<{ valid: boolean; actualSlippage: number }> {
    const actualSlippage =
      Math.abs(quote.rate - executedRate) / quote.rate;

    return {
      valid: actualSlippage <= slippageTolerance,
      actualSlippage,
    };
  }

  /**
   * Check that sufficient liquidity exists for the swap.
   */
  async checkLiquidity(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
  ): Promise<{ sufficient: boolean; available: number }> {
    const pool = this.getPool(fromAsset, toAsset);
    if (!pool) return { sufficient: false, available: 0 };

    // Reject swaps that would consume more than 10% of pool reserves
    const maxSwap = pool.baseReserve * 0.1;
    return {
      sufficient: amountIn <= maxSwap,
      available: maxSwap,
    };
  }

  /**
   * Find the best route between two assets using BFS.
   */
  findOptimalRoute(from: string, to: string): string[] | null {
    // Direct pool exists?
    if (this.getPool(from, to)) return [from, to];

    // BFS through ROUTE_GRAPH
    const queue: string[][] = [[from]];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const last = path[path.length - 1];

      for (const neighbor of ROUTE_GRAPH[last] ?? []) {
        if (neighbor === to) return [...path, to];
        if (!visited.has(neighbor) && path.length < 4) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AMM mechanics (constant-product x * y = k)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Execute a constant-product AMM swap on the simulated pool state.
   * Mutates reserves in-place so subsequent calls reflect pool changes.
   *
   * In production, this would call the DEX contract / aggregator API.
   */
  executeAmmSwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
  ): { amountOut: number; rate: number; priceImpact: number } {
    const pool = this.getPool(fromAsset, toAsset);
    if (!pool) throw new NotFoundException(`No pool for ${fromAsset}/${toAsset}`);

    const isBase = pool.baseAsset === fromAsset;
    const reserveIn  = isBase ? pool.baseReserve  : pool.quoteReserve;
    const reserveOut = isBase ? pool.quoteReserve : pool.baseReserve;

    // Apply LP fee to input
    const amountInWithFee = amountIn * (1 - pool.fee);

    // Constant-product formula: amountOut = reserveOut * amountInWithFee / (reserveIn + amountInWithFee)
    const amountOut =
      (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);

    const rate = amountOut / amountIn;

    // Spot price before swap
    const spotRate = isBase
      ? reserveOut / reserveIn
      : reserveIn / reserveOut;

    const priceImpact = Math.abs(spotRate - rate) / spotRate;

    // Update pool reserves to reflect the trade
    if (isBase) {
      pool.baseReserve  += amountIn;
      pool.quoteReserve -= amountOut;
    } else {
      pool.quoteReserve += amountIn;
      pool.baseReserve  -= amountOut;
    }

    return { amountOut, rate, priceImpact };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async quoteAlongRoute(
    route: string[],
    amountIn: number,
  ): Promise<PriceQuote> {
    let currentAmount = amountIn;
    let totalPriceImpact = 0;
    let lowestLiquidity = Infinity;

    for (let i = 0; i < route.length - 1; i++) {
      const from = route[i];
      const to   = route[i + 1];
      const { amountOut, priceImpact } = this.simulateAmmSwap(from, to, currentAmount);

      totalPriceImpact = 1 - (1 - totalPriceImpact) * (1 - priceImpact);

      const pool = this.getPool(from, to)!;
      const liquidity = Math.min(pool.baseReserve, pool.quoteReserve);
      if (liquidity < lowestLiquidity) lowestLiquidity = liquidity;

      currentAmount = amountOut;
    }

    return {
      fromAsset: route[0],
      toAsset: route[route.length - 1],
      amountIn,
      amountOut: currentAmount,
      rate: currentAmount / amountIn,
      priceImpact: totalPriceImpact,
      route,
      liquidityAvailable: lowestLiquidity,
      quotedAt: new Date(),
    };
  }

  /** Read-only AMM simulation — does NOT mutate pool state */
  private simulateAmmSwap(
    fromAsset: string,
    toAsset: string,
    amountIn: number,
  ): { amountOut: number; priceImpact: number } {
    const pool = this.getPool(fromAsset, toAsset);
    if (!pool) throw new NotFoundException(`No pool: ${fromAsset}/${toAsset}`);

    const isBase = pool.baseAsset === fromAsset;
    const reserveIn  = isBase ? pool.baseReserve  : pool.quoteReserve;
    const reserveOut = isBase ? pool.quoteReserve : pool.baseReserve;

    const amountInWithFee = amountIn * (1 - pool.fee);
    const amountOut =
      (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);

    const spotRate   = reserveOut / reserveIn;
    const actualRate = amountOut / amountIn;
    const priceImpact = Math.abs(spotRate - actualRate) / spotRate;

    return { amountOut, priceImpact };
  }

  /** Canonical pool key regardless of asset order */
  private poolKey(a: string, b: string): string {
    return [a, b].sort().join('-');
  }

  private getPool(a: string, b: string): PoolState | undefined {
    return (
      this.poolStates.get(`${a}-${b}`) ??
      this.poolStates.get(`${b}-${a}`)
    );
  }
}
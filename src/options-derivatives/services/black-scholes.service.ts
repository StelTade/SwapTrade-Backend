import { Injectable } from '@nestjs/common';
import { OptionType } from '../enums/option-type.enum';

export interface BlackScholesResult {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
  rho: number;
}

@Injectable()
export class BlackScholesService {
  /**
   * Standard normal cumulative distribution function (CDF).
   * Uses Abramowitz & Stegun approximation (accuracy ~7.5e-8).
   */
  private normalCdf(x: number): number {
    // Abramowitz & Stegun approximation for normal CDF (§26.2.17)
    // Constants for the direct normal CDF approximation
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;
    const p = 0.2316419;

    const sign = x >= 0 ? 1 : -1;
    const absX = Math.abs(x);

    const t = 1.0 / (1.0 + p * absX);
    const phi =
      Math.exp(-absX * absX * 0.5) / Math.sqrt(2 * Math.PI);
    const y =
      ((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t;

    const cdf = 1.0 - phi * y;
    return sign > 0 ? cdf : 1.0 - cdf;
  }

  /**
   * Standard normal probability density function (PDF).
   */
  private normalPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  /**
   * Calculate option price and Greeks using Black-Scholes-Merton model.
   *
   * @param spotPrice - Current underlying price (S)
   * @param strikePrice - Strike price (K)
   * @param timeToExpiry - Time to expiration in years (T)
   * @param riskFreeRate - Annualized risk-free rate (r)
   * @param volatility - Annualized volatility (σ)
   * @param optionType - CALL or PUT
   */
  calculate(
    spotPrice: number,
    strikePrice: number,
    timeToExpiry: number,
    riskFreeRate: number,
    volatility: number,
    optionType: OptionType,
  ): BlackScholesResult {
    // Handle edge cases
    if (timeToExpiry <= 0) {
      return this.calculateAtExpiration(spotPrice, strikePrice, optionType);
    }

    if (volatility <= 0) {
      return this.calculateZeroVol(spotPrice, strikePrice, timeToExpiry, riskFreeRate, optionType);
    }

    const S = spotPrice;
    const K = strikePrice;
    const T = timeToExpiry;
    const r = riskFreeRate;
    const sigma = volatility;

    const sqrtT = Math.sqrt(T);
    const d1 =
      (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const nd1 = this.normalCdf(d1);
    const nd2 = this.normalCdf(d2);
    const pdfD1 = this.normalPdf(d1);

    let price: number;
    let delta: number;
    let theta: number;
    let rho: number;

    if (optionType === OptionType.CALL) {
      price = S * nd1 - K * Math.exp(-r * T) * nd2;
      delta = nd1;
      theta =
        (-(S * sigma * pdfD1) / (2 * sqrtT) -
          r * K * Math.exp(-r * T) * nd2) /
        365;
      rho = (K * T * Math.exp(-r * T) * nd2) / 100;
    } else {
      const nmd1 = this.normalCdf(-d1);
      const nmd2 = this.normalCdf(-d2);
      price = K * Math.exp(-r * T) * nmd2 - S * nmd1;
      delta = nd1 - 1;
      theta =
        (-(S * sigma * pdfD1) / (2 * sqrtT) +
          r * K * Math.exp(-r * T) * nmd2) /
        365;
      rho = (-K * T * Math.exp(-r * T) * nmd2) / 100;
    }

    // Gamma is the same for calls and puts
    const gamma = pdfD1 / (S * sigma * sqrtT);

    // Vega is the same for calls and puts (per 1% vol change)
    const vega = (S * pdfD1 * sqrtT) / 100;

    return {
      price: this.round8(price),
      delta: this.round8(delta),
      gamma: this.round8(gamma),
      vega: this.round8(vega),
      theta: this.round8(theta),
      rho: this.round8(rho),
    };
  }

  /**
   * Calculate intrinsic value at expiration.
   */
  private calculateAtExpiration(
    spotPrice: number,
    strikePrice: number,
    optionType: OptionType,
  ): BlackScholesResult {
    let price = 0;
    let delta = 0;

    if (optionType === OptionType.CALL) {
      price = Math.max(0, spotPrice - strikePrice);
      delta = spotPrice > strikePrice ? 1 : 0;
    } else {
      price = Math.max(0, strikePrice - spotPrice);
      delta = spotPrice < strikePrice ? -1 : 0;
    }

    return {
      price: this.round8(price),
      delta: this.round8(delta),
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
    };
  }

  /**
   * Calculate with zero volatility (deterministic model).
   */
  private calculateZeroVol(
    spotPrice: number,
    strikePrice: number,
    timeToExpiry: number,
    riskFreeRate: number,
    optionType: OptionType,
  ): BlackScholesResult {
    const forwardPrice = spotPrice * Math.exp(riskFreeRate * timeToExpiry);
    let price = 0;

    if (optionType === OptionType.CALL) {
      price = Math.max(0, forwardPrice - strikePrice) * Math.exp(-riskFreeRate * timeToExpiry);
    } else {
      price = Math.max(0, strikePrice - forwardPrice) * Math.exp(-riskFreeRate * timeToExpiry);
    }

    return {
      price: this.round8(price),
      delta: 0,
      gamma: 0,
      vega: 0,
      theta: 0,
      rho: 0,
    };
  }

  /**
   * Round to 8 decimal places for precision.
   */
  round8(value: number): number {
    return Math.round(value * 1e8) / 1e8;
  }

  /**
   * Calculate time to expiry in years from now to a future date.
   */
  calculateTimeToExpiry(expirationDate: Date, now: Date = new Date()): number {
    const diffMs = expirationDate.getTime() - now.getTime();
    const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
    return Math.max(0, diffYears);
  }

  /**
   * Check if option is in-the-money.
   */
  isInTheMoney(
    spotPrice: number,
    strikePrice: number,
    optionType: OptionType,
  ): boolean {
    if (optionType === OptionType.CALL) {
      return spotPrice > strikePrice;
    }
    return spotPrice < strikePrice;
  }
}

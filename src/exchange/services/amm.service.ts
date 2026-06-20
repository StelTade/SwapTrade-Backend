import { Injectable } from '@nestjs/common';

export interface SwapQuote {
  amountOut: number;
  feeAmount: number;
  priceImpact: number;
}

export interface LiquidityQuote {
  lpTokensMinted: number;
  amountA: number;
  amountB: number;
}

export interface WithdrawQuote {
  amountA: number;
  amountB: number;
}

export interface ImpermanentLossResult {
  currentValue: number;
  holdValue: number;
  impermanentLoss: number;
  impermanentLossPercent: number;
}

@Injectable()
export class AmmService {
  /**
   * Constant-product AMM: x * y = k
   * amountOut = (amountIn * feeMultiplier * reserveOut) / (reserveIn + amountIn * feeMultiplier)
   */
  getAmountOut(
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
    feeBps: number,
  ): SwapQuote {
    if (amountIn <= 0) {
      throw new Error('Amount in must be positive');
    }
    if (reserveIn <= 0 || reserveOut <= 0) {
      throw new Error('Insufficient liquidity');
    }

    const feeMultiplier = 1 - feeBps / 10000;
    const amountInWithFee = amountIn * feeMultiplier;
    const feeAmount = amountIn - amountInWithFee;

    const amountOut =
      (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);

    const priceBefore = reserveOut / reserveIn;
    const newReserveIn = reserveIn + amountIn;
    const newReserveOut = reserveOut - amountOut;
    const priceAfter = newReserveOut / newReserveIn;
    const priceImpact =
      Math.abs((priceAfter - priceBefore) / priceBefore) * 100;

    return { amountOut, feeAmount, priceImpact };
  }

  getSpotPrice(reserveA: number, reserveB: number): number {
    if (reserveA <= 0) return 0;
    return reserveB / reserveA;
  }

  calculateLpTokensToMint(
    amountA: number,
    amountB: number,
    reserveA: number,
    reserveB: number,
    totalLpSupply: number,
  ): LiquidityQuote {
    if (amountA <= 0 || amountB <= 0) {
      throw new Error('Deposit amounts must be positive');
    }

    if (totalLpSupply === 0) {
      const lpTokensMinted = Math.sqrt(amountA * amountB);
      return { lpTokensMinted, amountA, amountB };
    }

    if (reserveA <= 0 || reserveB <= 0) {
      throw new Error('Pool reserves must be positive');
    }

    const lpFromA = (amountA * totalLpSupply) / reserveA;
    const lpFromB = (amountB * totalLpSupply) / reserveB;
    const lpTokensMinted = Math.min(lpFromA, lpFromB);

    const actualAmountA = (lpTokensMinted * reserveA) / totalLpSupply;
    const actualAmountB = (lpTokensMinted * reserveB) / totalLpSupply;

    return { lpTokensMinted, amountA: actualAmountA, amountB: actualAmountB };
  }

  calculateWithdrawAmounts(
    lpAmount: number,
    totalLpSupply: number,
    reserveA: number,
    reserveB: number,
  ): WithdrawQuote {
    if (lpAmount <= 0) {
      throw new Error('LP amount must be positive');
    }
    if (totalLpSupply <= 0) {
      throw new Error('No LP supply in pool');
    }
    if (lpAmount > totalLpSupply) {
      throw new Error('LP amount exceeds total supply');
    }

    const share = lpAmount / totalLpSupply;
    return {
      amountA: reserveA * share,
      amountB: reserveB * share,
    };
  }

  calculateImpermanentLoss(
    depositedAmountA: number,
    depositedAmountB: number,
    currentReserveA: number,
    currentReserveB: number,
    totalLpSupply: number,
    lpAmount: number,
  ): ImpermanentLossResult {
    if (lpAmount <= 0 || totalLpSupply <= 0) {
      return {
        currentValue: 0,
        holdValue: 0,
        impermanentLoss: 0,
        impermanentLossPercent: 0,
      };
    }

    const share = lpAmount / totalLpSupply;
    const currentA = currentReserveA * share;
    const currentB = currentReserveB * share;

    const initialPrice =
      depositedAmountB > 0 ? depositedAmountA / depositedAmountB : 0;
    const currentPrice = currentB > 0 ? currentA / currentB : 0;

    const currentValue = currentA + currentB;

    let holdValue: number;
    if (initialPrice > 0 && currentPrice > 0) {
      const priceRatio = currentPrice / initialPrice;
      holdValue =
        depositedAmountA * priceRatio + depositedAmountB * (1 / priceRatio);
      holdValue =
        (((depositedAmountA + depositedAmountB) * Math.sqrt(priceRatio)) /
          (1 + priceRatio)) *
        2;
      holdValue =
        depositedAmountA * (currentPrice / initialPrice) + depositedAmountB;
    } else {
      holdValue = depositedAmountA + depositedAmountB;
    }

    const impermanentLoss = holdValue - currentValue;
    const impermanentLossPercent =
      holdValue > 0 ? (impermanentLoss / holdValue) * 100 : 0;

    return {
      currentValue,
      holdValue,
      impermanentLoss,
      impermanentLossPercent,
    };
  }

  distributeFees(
    feeAmount: number,
    lpAmount: number,
    totalLpSupply: number,
  ): number {
    if (totalLpSupply <= 0 || lpAmount <= 0) return 0;
    return (feeAmount * lpAmount) / totalLpSupply;
  }
}

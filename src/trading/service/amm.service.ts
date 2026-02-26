import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketData } from '../entities/market-data.entity';

export interface AMMQuote {
	asset: string;
	inputAmount: number;
	outputAmount: number;
	priceImpact: number;
	fee: number;
	minimumReceived: number;
}

export interface AMMSwapResult {
	success: boolean;
	asset: string;
	inputAmount: number;
	outputAmount: number;
	executionPrice: number;
	priceImpact: number;
	fee: number;
	error?: string;
}

@Injectable()
export class AMMService {
	constructor(
		@InjectRepository(MarketData)
		private readonly marketDataRepository: Repository<MarketData>,
	) {}

	/**
	 * Get current market data for an asset
	 */
	async getMarketData(asset: string): Promise<MarketData | null> {
		return this.marketDataRepository.findOne({ where: { asset } });
	}

	/**
	 * Initialize market data for a new asset
	 */
	async initializeAsset(asset: string, initialPrice: number): Promise<MarketData> {
		const marketData = this.marketDataRepository.create({
			asset,
			currentPrice: initialPrice,
			previousPrice: initialPrice,
			poolReserveA: 1000000, // 1M units of base asset
			poolReserveB: initialPrice * 1000000, // 1M * price units of quote asset
		});

		return this.marketDataRepository.save(marketData);
	}

	/**
	 * Calculate AMM quote for a swap
	 */
	async getQuote(
		asset: string,
		inputAmount: number,
		isBuy: boolean,
	): Promise<AMMQuote> {
		let marketData = await this.getMarketData(asset);

		// Initialize if doesn't exist
		if (!marketData) {
			marketData = await this.initializeAsset(asset, 50000); // Default BTC-like price
		}

		const { poolReserveA, poolReserveB, feeRate, currentPrice } = marketData;

		// For simplicity, assume we're swapping between asset and USD
		// poolReserveA = asset units, poolReserveB = USD units

		let outputAmount: number;
		let priceImpact: number;
		let fee: number;

		if (isBuy) {
			// Buying asset with USD
			const inputAmountWithFee = inputAmount * (1 - feeRate);
			outputAmount = (inputAmountWithFee * poolReserveA) / (poolReserveB + inputAmountWithFee);

			// Calculate price impact
			const newPrice = (poolReserveB + inputAmount) / poolReserveA;
			priceImpact = Math.abs(newPrice - currentPrice) / currentPrice;

			fee = inputAmount * feeRate;
		} else {
			// Selling asset for USD
			const inputAmountWithFee = inputAmount * (1 - feeRate);
			outputAmount = (inputAmountWithFee * poolReserveB) / (poolReserveA + inputAmountWithFee);

			// Calculate price impact
			const newPrice = poolReserveB / (poolReserveA + inputAmount);
			priceImpact = Math.abs(newPrice - currentPrice) / currentPrice;

			fee = inputAmount * currentPrice * feeRate;
		}

		return {
			asset,
			inputAmount,
			outputAmount,
			priceImpact,
			fee,
			minimumReceived: outputAmount * 0.995, // 0.5% slippage tolerance
		};
	}

	/**
	 * Execute AMM swap and update pool reserves
	 */
	async executeSwap(
		asset: string,
		inputAmount: number,
		isBuy: boolean,
	): Promise<AMMSwapResult> {
		try {
			const quote = await this.getQuote(asset, inputAmount, isBuy);

			if (quote.outputAmount <= 0) {
				return {
					success: false,
					asset,
					inputAmount,
					outputAmount: 0,
					executionPrice: 0,
					priceImpact: 0,
					fee: 0,
					error: 'Insufficient liquidity for swap',
				};
			}

			let marketData = await this.getMarketData(asset);
			if (!marketData) {
				marketData = await this.initializeAsset(asset, 50000);
			}

			// Update pool reserves
			if (isBuy) {
				// Buying asset: add USD to pool B, remove asset from pool A
				marketData.poolReserveB += inputAmount;
				marketData.poolReserveA -= quote.outputAmount;
			} else {
				// Selling asset: add asset to pool A, remove USD from pool B
				marketData.poolReserveA += inputAmount;
				marketData.poolReserveB -= quote.outputAmount;
			}

			// Update price
			marketData.previousPrice = marketData.currentPrice;
			marketData.currentPrice = marketData.poolReserveB / marketData.poolReserveA;

			// Update volume
			marketData.volume24h += inputAmount;

			await this.marketDataRepository.save(marketData);

			return {
				success: true,
				asset,
				inputAmount,
				outputAmount: quote.outputAmount,
				executionPrice: quote.outputAmount / inputAmount,
				priceImpact: quote.priceImpact,
				fee: quote.fee,
			};
		} catch (error) {
			return {
				success: false,
				asset,
				inputAmount,
				outputAmount: 0,
				executionPrice: 0,
				priceImpact: 0,
				fee: 0,
				error: error.message,
			};
		}
	}

	/**
	 * Get current price for an asset
	 */
	async getCurrentPrice(asset: string): Promise<number> {
		const marketData = await this.getMarketData(asset);
		return marketData?.currentPrice || 50000; // Default fallback
	}
}

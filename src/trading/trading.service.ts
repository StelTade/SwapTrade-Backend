import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { UserService } from '../user/user.service';
import { Trade } from './entities/trade.entity';
import { TradeType } from '../common/enums/trade-type.enum';
import { AMMService } from './service/amm.service';
import { OrderBookService } from './service/order-book.service';
import { OrderType } from '../common/enums/order-type.enum';

@Injectable()
export class TradingService {
	constructor(
		private readonly userBadgeService: UserBadgeService,
		private readonly userService: UserService,
		@InjectRepository(Trade)
		private readonly tradeRepository: Repository<Trade>,
		private readonly ammService: AMMService,
		private readonly orderBookService: OrderBookService,
	) { }

	async swap(
		userId: number,
		asset: string,
		amount: number,
		price: number,
		type: string,
	): Promise<{
		success: boolean;
		trade?: Trade;
		badgeAwarded?: boolean;
		error?: string;
	}> {
		// Validate input
		if (!userId || !asset || !amount || !price || !type) {
			return { success: false, error: 'Missing required swap parameters.' };
		}

		let trade: Trade;
		let badgeAwarded = false;
		try {
			// Convert type string to TradeType enum
			const tradeTypeEnum = type === 'BUY' ? TradeType.BUY : TradeType.SELL;

			// Execute trade through AMM for realistic pricing
			const ammResult = await this.ammService.executeSwap(
				asset,
				amount,
				tradeTypeEnum === TradeType.BUY,
			);

			if (!ammResult.success) {
				return { success: false, error: ammResult.error || 'Trade execution failed.' };
			}

			// Create trade record
			trade = this.tradeRepository.create({
				userId,
				asset,
				amount,
				price: ammResult.executionPrice,
				type: tradeTypeEnum,
			});
			await this.tradeRepository.save(trade);

			// Calculate trade value using actual execution price
			const tradeValue = ammResult.executionPrice * amount;

			// Calculate PnL (simplified - in real scenario, compare with previous trades)
			// For BUY: negative PnL (cost), for SELL: positive PnL (gain)
			const pnl = tradeTypeEnum === TradeType.BUY ? -tradeValue : tradeValue;

			// Update portfolio after successful trade
			// Convert userId to string and use asset as assetId
			await this.userService.updatePortfolioAfterTrade(
				userId.toString(),
				asset, // asset is the assetId
				tradeValue,
				pnl,
			);

			// Update user balance
			const balanceChange = tradeTypeEnum === TradeType.BUY ? ammResult.outputAmount : -amount;
			await this.userService.updateBalance(
				userId.toString(),
				asset,
				balanceChange,
			);

			// Check if this is the user's first trade
			const previousTrades = await this.tradeRepository.count({
				where: { userId },
			});
			if (previousTrades === 1) {
				// Only award if this is the first
				const badgeName = 'First Trade';
				const badge = await this.userBadgeService.awardBadge(userId, badgeName);
				badgeAwarded = !!badge;
			}

			return { success: true, trade, badgeAwarded };
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	async placeOrder(
		userId: number,
		asset: string,
		type: OrderType,
		amount: number,
		price: number,
	): Promise<{
		success: boolean;
		order?: any;
		error?: string;
	}> {
		try {
			const order = await this.orderBookService.placeOrder(
				userId,
				asset,
				type,
				amount,
				price,
			);

			return { success: true, order };
		} catch (error) {
			return { success: false, error: error.message };
		}
	}

	async getOrderBook(asset: string): Promise<any> {
		return this.orderBookService.getOrderBook(asset);
	}

	async cancelOrder(orderId: number, userId: number): Promise<boolean> {
		return this.orderBookService.cancelOrder(orderId, userId);
	}

	async executeOrder(orderId: number): Promise<any> {
		return this.orderBookService.executeOrder(orderId);
	}
}
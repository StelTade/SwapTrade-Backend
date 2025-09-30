import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBadgeService } from '../rewards/services/user-badge.service';
import { Trade } from './entities/trade.entity';
import { TradeType } from '../common/enums/trade-type.enum';

@Injectable()
export class TradingService {
	constructor(
		private readonly userBadgeService: UserBadgeService,
		@InjectRepository(Trade)
		private readonly tradeRepository: Repository<Trade>,
	) {}

		async swap(userId: number, asset: string, amount: number, price: number, type: string): Promise<{ success: boolean; trade?: Trade; badgeAwarded?: boolean; error?: string }> {
			// Validate input
			if (!userId || !asset || !amount || !price || !type) {
				return { success: false, error: 'Missing required swap parameters.' };
			}

			let trade: Trade;
			let badgeAwarded = false;
				try {
					// Convert type string to TradeType enum
					const tradeTypeEnum = type === 'BUY' ? TradeType.BUY : TradeType.SELL;
					trade = this.tradeRepository.create({ userId, asset, amount, price, type: tradeTypeEnum });
					await this.tradeRepository.save(trade);

					// Check if this is the user's first trade
					const previousTrades = await this.tradeRepository.count({ where: { userId } });
					if (previousTrades === 1) { // Only award if this is the first
						const badgeName = 'First Trade';
						const badge = await this.userBadgeService.awardBadge(userId, badgeName);
						badgeAwarded = !!badge;
					}

					return { success: true, trade, badgeAwarded };
				} catch (error) {
					return { success: false, error: error.message };
				}
		}
}

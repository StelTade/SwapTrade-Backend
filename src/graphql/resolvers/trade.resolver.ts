import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { TradingService } from '../../trading/trading.service';
import { Trade } from '../../trading/entities/trade.entity';

@Resolver()
export class TradeResolver {
  constructor(private readonly tradingService: TradingService) {}

  @Mutation(() => Trade)
  async executeTrade(
    @Args('userId') userId: number,
    @Args('asset') asset: string,
    @Args('amount') amount: number,
    @Args('price') price: number,
    @Args('type') type: string,
  ) {
    const result = await this.tradingService.swap(userId, asset, amount, price, type);
    if (!result.success || !result.trade) {
      throw new Error(result.error ?? 'Trade execution failed');
    }
    return result.trade;
  }
}


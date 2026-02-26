import { Trade } from '../../src/trading/entities/trade.entity';
import { TradeType } from '../../src/common/enums/trade-type.enum';
import { faker } from '@faker-js/faker';

export class TradeFactory {
  static create(overrides: Partial<Trade> = {}): Trade {
    const trade = new Trade();
    trade.id = overrides.id || faker.string.uuid();
    trade.userId = overrides.userId || faker.number.int({ min: 1, max: 10000 });
    trade.asset = overrides.asset || 'BTC';
    trade.type = overrides.type || TradeType.BUY;
    trade.amount = overrides.amount || faker.number.float({ min: 0.1, max: 10, precision: 0.0001 });
    trade.price = overrides.price || faker.number.float({ min: 10000, max: 60000, precision: 0.01 });
    trade.status = overrides.status || 'COMPLETED';
    trade.createdAt = overrides.createdAt || new Date();
    return trade;
  }

  static createMany(count: number, overrides: Partial<Trade> = {}): Trade[] {
    return Array.from({ length: count }).map(() => this.create(overrides));
  }
}
import { DataSource } from 'typeorm';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { User } from '../user/entities/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { Balance } from '../balance/balance.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Reward } from '../rewards/entities/reward.entity';
import { Notification } from '../notification/entities/notification.entity';
import { Bid } from '../bidding/entities/bid.entity';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'swaptrade.db',
  entities: [
    VirtualAsset,
    UserBalance,
    User,
    Trade,
    Balance,
    Portfolio,
    Reward,
    Notification,
    Bid,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false, // Set to false when using migrations
  logging: true,
});

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { UserBadgeModule } from '../rewards/user-badge.module';
import { Trade } from './entities/trade.entity';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, VirtualAsset]),
    UserBadgeModule,
    UserModule,
  ],
  controllers: [TradingController],
  providers: [TradingService],
})
export class TradingModule {}

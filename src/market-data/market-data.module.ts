import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { MarketData } from '../trading/entities/market-data.entity';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CommonModule } from '../common/common.module';
import { MarketDataController } from './market-data.controller';
import { MarketDataService } from './market-data.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MarketData]),
    CustomCacheModule,
    CommonModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}

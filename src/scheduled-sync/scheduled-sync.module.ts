import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledSyncService } from './scheduled-sync.service';
import { ExchangeRateSyncService } from './exchange-rate-sync.service';
import { StellarSyncService } from './stellar-sync.service';
import { CustomCacheModule } from '../common/cache/cache.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule,
    CustomCacheModule,
  ],
  providers: [
    ScheduledSyncService,
    ExchangeRateSyncService,
    StellarSyncService,
  ],
  exports: [
    ScheduledSyncService,
    ExchangeRateSyncService,
    StellarSyncService,
  ],
})
export class ScheduledSyncModule {}

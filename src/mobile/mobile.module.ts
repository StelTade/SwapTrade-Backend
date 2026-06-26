import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MobileDevice } from './entities/mobile-device.entity';
import { AppVersion } from './entities/app-version.entity';
import { OfflineSyncItem } from './entities/offline-sync.entity';
import { MobileAnalyticsEvent } from './entities/mobile-analytics-event.entity';

import { MobileService } from './services/mobile.service';
import { FcmService } from './services/fcm.service';
import { AppVersionService } from './services/app-version.service';
import { OfflineSyncService } from './services/offline-sync.service';
import { MobileAnalyticsService } from './services/mobile-analytics.service';

import { MobileController } from './mobile.controller';
import { AuthModule } from '../auth/auth.module';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { BulkheadService } from '../common/services/bulkhead.service';
import { CorrelationIdService } from '../common/services/correlation-id.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MobileDevice,
      AppVersion,
      OfflineSyncItem,
      MobileAnalyticsEvent,
    ]),
    AuthModule,
  ],
  controllers: [MobileController],
  providers: [
    MobileService,
    FcmService,
    AppVersionService,
    OfflineSyncService,
    MobileAnalyticsService,
    CircuitBreakerService,
    BulkheadService,
    CorrelationIdService,
  ],
  exports: [FcmService, MobileService, CircuitBreakerService, BulkheadService],
})
export class MobileModule {}

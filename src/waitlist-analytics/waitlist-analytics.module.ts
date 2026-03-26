import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WaitlistAnalyticsController } from './waitlist-analytics.controller';
import { WaitlistAnalyticsService } from './waitlist-analytics.service';
import { WaitlistUser } from '../waitlist/entities/waitlist-user.entity';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistUser]),
    MetricsModule,
  ],
  controllers: [WaitlistAnalyticsController],
  providers: [WaitlistAnalyticsService],
  exports: [WaitlistAnalyticsService],
})
export class WaitlistAnalyticsModule {}

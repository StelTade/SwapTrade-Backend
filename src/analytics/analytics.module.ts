import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './controllers/analytics.controller';
import { PortfolioAnalyticsService } from './services/portfolio-analytics.service';
import { PerformanceCalculatorService } from './services/performance-calculator.service';
import { User } from '../user/user.entity';
import { Trade } from '../trading/entities/trade.entity';
import { PrometheusService } from '../common/monitoring/services/prometheus.service';
import { StructuredLoggerService } from '../common/monitoring/services/structured-logger.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Trade])
  ],
  controllers: [AnalyticsController],
  providers: [
    PortfolioAnalyticsService,
    PerformanceCalculatorService,
    PrometheusService,
    StructuredLoggerService
  ],
  exports: [
    PortfolioAnalyticsService,
    PerformanceCalculatorService
  ]
})
export class AnalyticsModule {}

// src/app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TradingModule } from './trading/trading.module';
import { UserModule } from './user/user.module';
import { RewardsModule } from './rewards/rewards.module';
import { NotificationModule } from './notification/notification.module';
import { BiddingModule } from './bidding/bidding.module';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { BalanceModule } from './balance/balance.module';
import { SwapModule } from './swap/swap.module';
import { TutorialModule } from './tutorial/tutorial.module';
import { PerformanceModule } from './performance/performance.module';
import { QueueModule } from './queue/queue.module';
import { CustomCacheModule } from './common/cache/cache.module';
import { BullModule } from '@nestjs/bull';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ErrorLoggerService } from './common/logging/error-logger.service';
import { AdvancedCacheInterceptor } from './common/interceptors/advanced-cache.interceptor';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'swaptrade.db',
      autoLoadEntities: true,
      synchronize: false, // Use migrations instead
      migrations: ['src/database/migrations/*.ts'],
      migrationsTableName: 'migrations',
      logging: true,
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Cache Module
    CustomCacheModule,

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),

    // Background Job Queue (NEW) - Temporarily disabled due to compilation issue
    // QueueModule,

    // Existing modules
    AuthModule,
    PortfolioModule,
    TradingModule,
    UserModule,
    RewardsModule,
    NotificationModule,
    BiddingModule,
    CommonModule,
    DatabaseModule,
    BalanceModule,
    SwapModule,
    TutorialModule,
    PerformanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ErrorLoggerService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AdvancedCacheInterceptor,
    },
  ],
})
export class AppModule {}

/**
 * Fraud Detection Module - 反欺诈检测模块
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudDetectionController } from './fraud-detection.controller';
import { FraudDetectionService } from './fraud-detection.service';
import { AdminModule } from '../admin/admin.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    AdminModule,
    TypeOrmModule.forFeature(['waitlist', 'referral', 'user']),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 秒
        limit: 10, // 10 次
      },
      {
        name: 'medium',
        ttl: 60000, // 1 分钟
        limit: 100, // 100 次
      },
    ]),
  ],
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudModule {}

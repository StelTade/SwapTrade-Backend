/**
 * Admin Module - 管理员模块
 * 提供 Waitlist 和 Referral 的管理功能
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AuthModule } from '../auth/auth.module';

// 实体（假设已存在）
// import { Waitlist } from '../waitlist/entities/waitlist.entity';
// import { Referral } from '../referral/entities/referral.entity';
// import { AuditLog } from '../audit-log/entities/audit-log.entity';

@Module({
  imports: [
    AuthModule,
    // TypeOrmModule.forFeature([Waitlist, Referral, AuditLog]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { NotificationModule } from '../notification/notification.module';
import { AuditLog } from 'src/common/security/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), NotificationModule],
  providers: [AuditLogService],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}

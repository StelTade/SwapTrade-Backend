import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonController } from './common.controller';
import { CommonService } from './common.service';
import { AuditLog } from './security/audit-log.entity';
import { AuditLogService } from './security/audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [CommonController],
  providers: [CommonService, AuditLogService],
  exports: [AuditLogService],
})
export class CommonModule {}

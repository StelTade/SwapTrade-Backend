import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogService, AUDIT_WORM_SINK } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { FileWormSink } from './file-worm-sink';
import { AuditLog } from 'src/common/security/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    AuditLogService,
    {
      provide: AUDIT_WORM_SINK,
      useFactory: () => new FileWormSink(),
    },
  ],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}

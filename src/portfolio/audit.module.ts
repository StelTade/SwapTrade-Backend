import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditLoggerService } from './logging/audit-logger.service';
import { AuditController } from './controllers/audit.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
  ],
  controllers: [AuditController],
  providers: [AuditLoggerService],
  exports: [AuditLoggerService],
})
export class AuditModule {}
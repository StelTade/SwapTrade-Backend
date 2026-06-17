import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { PermissionManagementService } from './services/permission-management.service';
import { PermissionsController } from './controllers/permissions.controller';
import { RolesModule } from '../roles/roles.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permission]),
    RolesModule,
    AuditLogModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionManagementService],
  exports: [PermissionManagementService],
})
export class PermissionsModule {}

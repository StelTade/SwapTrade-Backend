import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { RolesModule } from '../roles/roles.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RoleManagementService } from './services/role-management.service';
import { IdentityAdminController } from './admin.controller';
import { AuditService } from '../../common/logging/audit_service';
import { LoggingModule } from '../../common/logging/logging_module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RolesModule,
    PermissionsModule,
    LoggingModule,
  ],
  controllers: [IdentityAdminController],
  providers: [RoleManagementService, AuditService],
  exports: [RoleManagementService],
})
export class IdentityAdminModule {}

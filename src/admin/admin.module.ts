import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLog } from '../common/security/audit-log.entity';
import { User } from '../user/entities/user.entity';
import { RolesModule } from '../identity/roles/roles.module';
import { PermissionsModule } from '../identity/permissions/permissions.module';
import { RoleManagementService } from '../identity/admin/services/role-management.service';
import { AuditService } from '../common/logging/audit_service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog, User]),
    forwardRef(() => RolesModule),
    forwardRef(() => PermissionsModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, RoleManagementService, AuditService],
  exports: [AdminService, RoleManagementService, AuditService],
})
export class AdminModule {}

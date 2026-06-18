import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleEntity } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { User } from '../../user/entities/user.entity';
import { RoleService } from './services/role.service';
import { RoleManagementService } from './services/role-management.service';
import { RbacGuard } from './guards/rbac.guard';
import { RolesController } from './controllers/roles.controller';
import { AuditLogModule } from '../../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleEntity, Permission, User]),
    AuditLogModule,
  ],
  controllers: [RolesController],
  providers: [RoleService, RoleManagementService, RbacGuard],
  exports: [RoleService, RoleManagementService, RbacGuard],
})
export class RolesModule {}

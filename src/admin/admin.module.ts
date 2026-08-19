import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MetricsService } from './metrics.service';
import { AuditLog } from '../common/security/audit-log.entity';
import { User } from '../user/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Trade } from '../database/entities/trade.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { RolesModule } from '../identity/roles/roles.module';
import { PermissionsModule } from '../identity/permissions/permissions.module';
import { RoleManagementService } from '../identity/admin/services/role-management.service';
import { AuditService } from '../common/logging/audit_service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      User,
      Order,
      Trade,
      UserBalance,
    ]),
    forwardRef(() => RolesModule),
    forwardRef(() => PermissionsModule),
  ],
  controllers: [AdminController],
  providers: [AdminService, RoleManagementService, AuditService, MetricsService],
  exports: [AdminService, RoleManagementService, AuditService, MetricsService],
})
export class AdminModule {}

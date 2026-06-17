import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesModule } from '../roles/roles.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { ALL_PERMISSIONS } from './constants/permissions';

@Module({
  imports: [forwardRef(() => RolesModule)],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard, RolesModule],
})
export class PermissionsModule {}

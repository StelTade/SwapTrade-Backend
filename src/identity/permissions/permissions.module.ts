/* eslint-disable */
import { Module, forwardRef } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  imports: [forwardRef(() => RolesModule)],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard, RolesModule],
})
export class PermissionsModule {}
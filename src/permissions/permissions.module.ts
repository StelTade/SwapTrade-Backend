import { Module } from '@nestjs/common';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [PermissionsGuard],
  exports: [PermissionsGuard],
})
export class PermissionsModule {}
import { Module } from '@nestjs/common';
import { RoleService } from './services/role.service';

@Module({
  providers: [RoleService],
  exports: [RoleService],
})
export class RolesModule {}

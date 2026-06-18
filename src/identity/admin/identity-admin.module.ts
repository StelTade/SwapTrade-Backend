import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { IdentityAdminService } from './services/identity-admin.service';
import { IdentityAdminController } from './controllers/identity-admin.controller';
import { RolesModule } from '../roles/roles.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RolesModule,
    AuditLogModule,
  ],
  controllers: [IdentityAdminController],
  providers: [IdentityAdminService],
  exports: [IdentityAdminService],
})
export class IdentityAdminCoreModule {}

import { Module } from '@nestjs/common';
import { AdminModule as OriginalAdminModule } from '../../admin/admin.module';

/**
 * Identity Admin Facade Module
 *
 * Wraps the original AdminModule from src/admin/.
 * Provides: AdminService, AdminController, WaitlistService
 */
@Module({
  imports: [OriginalAdminModule],
  exports: [OriginalAdminModule],
})
export class IdentityAdminModule {}

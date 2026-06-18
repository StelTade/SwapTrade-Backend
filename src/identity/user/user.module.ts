import { Module } from '@nestjs/common';
import { UserModule as CoreUserModule } from '../../user/user.module';

/**
 * Identity User Facade Module
 *
 * Wraps the core UserModule from src/user/.
 * Provides: UserService, UserController
 */
@Module({
  imports: [CoreUserModule],
  exports: [CoreUserModule],
})
export class IdentityUserModule {}

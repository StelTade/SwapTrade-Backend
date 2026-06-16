import { Module } from '@nestjs/common';
import { UserModule as OriginalUserModule } from '../../user/user.module';

/**
 * Identity User Facade Module
 *
 * Wraps the original UserModule from src/user/.
 * Provides: UserService, UserController
 */
@Module({
  imports: [OriginalUserModule],
  exports: [OriginalUserModule],
})
export class IdentityUserModule {}

import { Module } from '@nestjs/common';
import { AuthModule as OriginalAuthModule } from '../../auth/auth.module';

/**
 * Identity Auth Facade Module
 *
 * Wraps the original AuthModule from src/auth/.
 * Provides: AuthService, MFAService, AuthController, MFAController
 */
@Module({
  imports: [OriginalAuthModule],
  exports: [OriginalAuthModule],
})
export class IdentityAuthModule {}

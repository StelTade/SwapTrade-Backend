import { Module } from '@nestjs/common';
import { AuthModule as CoreAuthModule } from '../../auth/auth.module';

/**
 * Identity Auth Facade Module
 *
 * Wraps the core AuthModule from src/auth/.
 * Provides: AuthService, MFAService, AuthController, MFAController, JwtAuthGuard, JwtModule
 */
@Module({
  imports: [CoreAuthModule],
  exports: [CoreAuthModule],
})
export class IdentityAuthModule {}

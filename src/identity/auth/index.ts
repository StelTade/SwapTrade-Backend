/**
 * Identity Auth Module
 * JWT authentication, 2FA, session management, token rotation, password reset
 *
 * Facade over src/auth/ — original implementation location
 */

export { IdentityAuthModule } from './auth.module';
export { AuthModule } from '../../auth/auth.module';
export { AuthService } from '../../auth/auth.service';
export { MFAService } from '../../auth/mfa.service';
export { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
export type { JwtPayload } from '../../auth/guards/jwt-auth.guard';
export { CurrentUser } from '../../auth/decorators/current-user.decorator';
export { Public } from '../../auth/decorators/public.decorator';

/**
 * Identity Auth Module
 * JWT authentication, 2FA, session management, token validation
 *
 * Facade over src/auth/ — original implementation location
 */

export { IdentityAuthModule } from './auth.module';
export { AuthModule } from '../../auth/auth.module';
export { AuthService } from '../../auth/auth.service';
export { MFAService } from '../../auth/mfa.service';

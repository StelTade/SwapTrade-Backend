import { Module } from '@nestjs/common';

// Identity facade modules
import { IdentityAuthModule } from './auth/auth.module';
import { IdentityUserModule } from './user/user.module';
import { IdentityAdminModule } from './admin/admin.module';
import { IdentityKycModule } from './kyc/kyc.module';
import { IdentityComplianceModule } from './compliance/compliance.module';
import { IdentityPrivacyModule } from './privacy/privacy.module';
import { IdentityDidModule } from './did/did.module';
import { PermissionsModule } from '../permissions/permissions.module';

/**
 * Identity Domain Aggregate Module
 *
 * This is the top-level module for the Identity domain (ADR-001 Level 2).
 * It aggregates all identity sub-modules into a single import point.
 *
 * Sub-modules:
 *  - Auth: JWT authentication, 2FA, session management, token validation
 *  - User: User profiles, metadata, preferences, status management
 *  - Admin: Administrative functions, system admin dashboard, user management
 *  - KYC: Know-Your-Customer verification, KYC state machine, identity validation
 *  - Compliance: Compliance rules, regulatory checks, audit compliance
 *  - Privacy: Data privacy, encryption, GDPR compliance, data export
 *  - DID: Decentralized identifiers, digital identity, self-sovereign identity
 *  - Roles: Role-based access control, role hierarchy (via common guards)
 *  - Permissions: Permission definitions, permission checks (via common guards)
 *
 * Dependency Rules (ADR-002, ADR-003):
 *  - CAN import from: infrastructure/*, shared layer (types, constants, enums)
 *  - CANNOT import from: Accounts, Market, Exchange, or any higher-level business domain
 */
@Module({
  imports: [
    IdentityAuthModule,
    IdentityUserModule,
    IdentityAdminModule,
    IdentityKycModule,
    IdentityComplianceModule,
    IdentityPrivacyModule,
    IdentityDidModule,
    PermissionsModule,
  ],
  exports: [
    IdentityAuthModule,
    IdentityUserModule,
    IdentityAdminModule,
    IdentityKycModule,
    IdentityComplianceModule,
    IdentityPrivacyModule,
    IdentityDidModule,
    PermissionsModule,
  ],
})
export class IdentityModule {}

/**
 * Identity Domain
 *
 * Level 2 of the domain-driven architecture (ADR-001).
 * All identity services: auth, user, roles, permissions, admin,
 * KYC, compliance, privacy, DID.
 *
 * Dependency Rules:
 *  - CAN depend on: infrastructure/*, shared layer (types, constants), external npm packages
 *  - CANNOT depend on: any business domain module (accounts, market, exchange, etc.)
 */

// Aggregate module
export { IdentityModule } from './identity.module';

// Sub-module facades
export { IdentityAuthModule } from './auth';
export { IdentityUserModule } from './user';
export { IdentityAdminModule } from './admin';
export { IdentityKycModule } from './kyc';
export { IdentityComplianceModule } from './compliance';
export { IdentityPrivacyModule } from './privacy';
export { IdentityDidModule } from './did';

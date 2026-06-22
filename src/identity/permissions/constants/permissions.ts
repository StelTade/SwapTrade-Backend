/**
 * Permission Registry
 * Centralized list of all permissions in the system
 * @module identity/permissions
 */

// User management permissions
export const USERS_READ = 'users.read';
export const USERS_WRITE = 'users.write';

// Account management permissions
export const ACCOUNTS_READ = 'accounts.read';
export const ACCOUNTS_WRITE = 'accounts.write';

// Trading permissions
export const TRADES_READ = 'trades.read';
export const TRADES_WRITE = 'trades.write';

// Admin access
export const ADMIN_ACCESS = 'admin.access';

// Compliance permissions
export const COMPLIANCE_READ = 'compliance.read';
export const COMPLIANCE_WRITE = 'compliance.write';

// Audit permissions
export const AUDIT_READ = 'audit.read';

// Profile permissions
export const PROFILE_READ = 'profile.read';
export const PROFILE_WRITE = 'profile.write';

// Portfolio permissions
export const PORTFOLIO_READ = 'portfolio.read';
export const PORTFOLIO_WRITE = 'portfolio.write';

// Support permissions
export const SUPPORT_TICKETS_MANAGE = 'support.tickets.manage';

// Liquidity pool permissions
export const POOLS_READ = 'pools.read';
export const POOLS_WRITE = 'pools.write';
export const LIQUIDITY_MANAGE = 'liquidity.manage';

// Insurance fund permissions
export const INSURANCE_READ = 'insurance.read';
export const INSURANCE_WRITE = 'insurance.write';
export const INSURANCE_ADMIN = 'insurance.admin';

/**
 * All available permissions in the system
 */
export const ALL_PERMISSIONS = [
  USERS_READ,
  USERS_WRITE,
  ACCOUNTS_READ,
  ACCOUNTS_WRITE,
  TRADES_READ,
  TRADES_WRITE,
  ADMIN_ACCESS,
  COMPLIANCE_READ,
  COMPLIANCE_WRITE,
  AUDIT_READ,
  PROFILE_READ,
  PROFILE_WRITE,
  PORTFOLIO_READ,
  PORTFOLIO_WRITE,
  SUPPORT_TICKETS_MANAGE,
  POOLS_READ,
  POOLS_WRITE,
  LIQUIDITY_MANAGE,
  INSURANCE_READ,
  INSURANCE_WRITE,
  INSURANCE_ADMIN,
];

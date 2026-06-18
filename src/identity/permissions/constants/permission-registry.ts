/**
 * Permission Registry
 * Canonical list of all platform permissions
 * Each permission is a '<resource>.<action>' slug
 *
 * @module identity/permissions/constants
 */

export interface PermissionDefinition {
  resource: string;
  action: string;
  slug: string;
  description: string;
}

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  // ── Users ──────────────────────────────────────────────────────
  { resource: 'users', action: 'read',   slug: 'users.read',   description: 'Read user profiles and data' },
  { resource: 'users', action: 'write',  slug: 'users.write',  description: 'Create and update user profiles' },
  { resource: 'users', action: 'delete', slug: 'users.delete', description: 'Delete user accounts' },
  { resource: 'users', action: 'manage', slug: 'users.manage', description: 'Full user management access' },

  // ── Accounts ───────────────────────────────────────────────────
  { resource: 'accounts', action: 'read',    slug: 'accounts.read',    description: 'Read account balances and details' },
  { resource: 'accounts', action: 'write',   slug: 'accounts.write',   description: 'Modify account data' },
  { resource: 'accounts', action: 'suspend', slug: 'accounts.suspend', description: 'Suspend user accounts' },
  { resource: 'accounts', action: 'manage',  slug: 'accounts.manage',  description: 'Full account management access' },

  // ── Trades ─────────────────────────────────────────────────────
  { resource: 'trades', action: 'read',   slug: 'trades.read',   description: 'View trade history and positions' },
  { resource: 'trades', action: 'write',  slug: 'trades.write',  description: 'Create and modify trades' },
  { resource: 'trades', action: 'manage', slug: 'trades.manage', description: 'Full trade management access' },

  // ── Admin ──────────────────────────────────────────────────────
  { resource: 'admin', action: 'access', slug: 'admin.access', description: 'Access admin panel' },
  { resource: 'admin', action: 'manage', slug: 'admin.manage', description: 'Full admin management access' },

  // ── Roles ──────────────────────────────────────────────────────
  { resource: 'roles', action: 'read',   slug: 'roles.read',   description: 'View role definitions' },
  { resource: 'roles', action: 'write',  slug: 'roles.write',  description: 'Create and modify roles' },
  { resource: 'roles', action: 'assign', slug: 'roles.assign', description: 'Assign roles to users' },
  { resource: 'roles', action: 'revoke', slug: 'roles.revoke', description: 'Revoke roles from users' },
  { resource: 'roles', action: 'manage', slug: 'roles.manage', description: 'Full role management access' },

  // ── Permissions ────────────────────────────────────────────────
  { resource: 'permissions', action: 'read',   slug: 'permissions.read',   description: 'View permission definitions' },
  { resource: 'permissions', action: 'assign', slug: 'permissions.assign', description: 'Assign permissions to roles' },
  { resource: 'permissions', action: 'manage', slug: 'permissions.manage', description: 'Full permission management access' },

  // ── Audit ──────────────────────────────────────────────────────
  { resource: 'audit', action: 'read',   slug: 'audit.read',   description: 'Read audit logs' },
  { resource: 'audit', action: 'export', slug: 'audit.export', description: 'Export audit logs' },
  { resource: 'audit', action: 'manage', slug: 'audit.manage', description: 'Full audit log access' },

  // ── Compliance ─────────────────────────────────────────────────
  { resource: 'compliance', action: 'read',   slug: 'compliance.read',   description: 'View compliance records' },
  { resource: 'compliance', action: 'write',  slug: 'compliance.write',  description: 'Create compliance records' },
  { resource: 'compliance', action: 'manage', slug: 'compliance.manage', description: 'Full compliance management' },

  // ── KYC ────────────────────────────────────────────────────────
  { resource: 'kyc', action: 'read',   slug: 'kyc.read',   description: 'View KYC submissions' },
  { resource: 'kyc', action: 'review', slug: 'kyc.review', description: 'Review KYC documents' },
  { resource: 'kyc', action: 'manage', slug: 'kyc.manage', description: 'Full KYC management access' },
];

/** Map of slug → definition for O(1) lookups */
export const PERMISSION_MAP = new Map<string, PermissionDefinition>(
  PERMISSION_REGISTRY.map((p) => [p.slug, p]),
);

/** All known permission slugs */
export const ALL_PERMISSION_SLUGS: string[] = PERMISSION_REGISTRY.map((p) => p.slug);

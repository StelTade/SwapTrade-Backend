export enum SecurityRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  STAFF = 'STAFF',
  GOVERNANCE_OPERATOR = 'GOVERNANCE_OPERATOR',
  KYC_OPERATOR = 'KYC_OPERATOR',
  KYC_GOVERNANCE = 'KYC_GOVERNANCE',
}

export interface AuthenticatedActor {
  id: number;
  roles: string[];
}

export const GOVERNANCE_ROLE_VALUES = [
  SecurityRole.GOVERNANCE_OPERATOR,
] as const;

export const KYC_ROLE_VALUES = [
  SecurityRole.KYC_OPERATOR,
  SecurityRole.KYC_GOVERNANCE,
] as const;

export class RoleSeparationViolation extends Error {
  constructor(message = 'Governance and KYC roles are mutually exclusive.') {
    super(message);
    this.name = 'RoleSeparationViolation';
  }
}

export function normalizeRoleValues(
  roles: readonly unknown[] | unknown | undefined | null,
): string[] {
  const roleList = Array.isArray(roles) ? roles : roles ? [roles] : [];

  return Array.from(
    new Set(
      roleList
        .filter((role): role is string => typeof role === 'string')
        .map((role) => role.trim())
        .filter(Boolean),
    ),
  );
}

export function hasAnyRole(
  roles: readonly unknown[] | unknown | undefined | null,
  allowedRoles: readonly string[],
): boolean {
  const normalizedRoles = normalizeRoleValues(roles);
  return allowedRoles.some((role) => normalizedRoles.includes(role));
}

export function assertNoGovernanceKycRoleConflict(
  roles: readonly unknown[] | unknown | undefined | null,
): void {
  const normalizedRoles = normalizeRoleValues(roles);
  const hasGovernanceRole = hasAnyRole(normalizedRoles, GOVERNANCE_ROLE_VALUES);
  const hasKycRole = hasAnyRole(normalizedRoles, KYC_ROLE_VALUES);

  if (hasGovernanceRole && hasKycRole) {
    throw new RoleSeparationViolation();
  }
}

export function assertGovernanceActor(actor?: Partial<AuthenticatedActor>): void {
  if (actor?.id === undefined || actor.id === null || !actor.roles) {
    throw new RoleSeparationViolation('Authenticated governance actor is required.');
  }

  assertNoGovernanceKycRoleConflict(actor.roles);

  if (!hasAnyRole(actor.roles, GOVERNANCE_ROLE_VALUES)) {
    throw new RoleSeparationViolation('Governance role is required.');
  }
}

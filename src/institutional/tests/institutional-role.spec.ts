import { UserRole, ROLE_DESCRIPTIONS } from '../../identity/roles/enums/user-role.enum';
import {
  ROLE_HIERARCHY,
  ROLE_PRIORITY,
  getInheritedRoles,
} from '../../identity/roles/constants/role-hierarchy';
import { ROLE_METADATA } from '../../identity/roles/types/role-metadata';

describe('Institutional Client Role Integration', () => {
  describe('UserRole Enum', () => {
    it('should have INSTITUTIONAL_CLIENT role defined', () => {
      expect(UserRole.INSTITUTIONAL_CLIENT).toBeDefined();
      expect(UserRole.INSTITUTIONAL_CLIENT).toBe('INSTITUTIONAL_CLIENT');
    });

    it('should have a description for INSTITUTIONAL_CLIENT', () => {
      expect(ROLE_DESCRIPTIONS[UserRole.INSTITUTIONAL_CLIENT]).toBeDefined();
      expect(ROLE_DESCRIPTIONS[UserRole.INSTITUTIONAL_CLIENT]).toContain('Institutional');
    });
  });

  describe('Role Hierarchy', () => {
    it('should have INSTITUTIONAL_CLIENT inherit from TRADER', () => {
      const parents = ROLE_HIERARCHY[UserRole.INSTITUTIONAL_CLIENT];
      expect(parents).toBeDefined();
      expect(parents).toContain(UserRole.TRADER);
    });

    it('should have INSTITUTIONAL_CLIENT higher priority than TRADER', () => {
      expect(ROLE_PRIORITY[UserRole.INSTITUTIONAL_CLIENT]).toBeGreaterThan(
        ROLE_PRIORITY[UserRole.TRADER],
      );
    });

    it('should have INSTITUTIONAL_CLIENT lower priority than STAFF', () => {
      expect(ROLE_PRIORITY[UserRole.INSTITUTIONAL_CLIENT]).toBeLessThan(
        ROLE_PRIORITY[UserRole.STAFF],
      );
    });

    it('should allow INSTITUTIONAL_CLIENT to inherit USER role via TRADER', () => {
      const inherited = getInheritedRoles(UserRole.INSTITUTIONAL_CLIENT);
      expect(inherited).toContain(UserRole.INSTITUTIONAL_CLIENT);
      expect(inherited).toContain(UserRole.TRADER);
      expect(inherited).toContain(UserRole.USER);
    });
  });

  describe('Role Metadata', () => {
    it('should have metadata for INSTITUTIONAL_CLIENT', () => {
      const metadata = ROLE_METADATA[UserRole.INSTITUTIONAL_CLIENT];
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe(UserRole.INSTITUTIONAL_CLIENT);
    });

    it('should have institutional-specific permissions', () => {
      const metadata = ROLE_METADATA[UserRole.INSTITUTIONAL_CLIENT];
      expect(metadata.permissions).toContain('INSTITUTIONAL_API_ACCESS');
      expect(metadata.permissions).toContain('INSTITUTIONAL_BULK_TRADING');
      expect(metadata.permissions).toContain('INSTITUTIONAL_REPORTING');
      expect(metadata.permissions).toContain('INSTITUTIONAL_RECONCILIATION');
      expect(metadata.permissions).toContain('INSTITUTIONAL_SLA_MANAGEMENT');
      expect(metadata.permissions).toContain('INSTITUTIONAL_SUPPORT_PRIORITY');
      expect(metadata.permissions).toContain('INSTITUTIONAL_ACCOUNT_MANAGEMENT');
      expect(metadata.permissions).toContain('INSTITUTIONAL_QUOTA_MANAGEMENT');
      expect(metadata.permissions).toContain('INSTITUTIONAL_PORTAL_ACCESS');
    });

    it('should inherit TRADER permissions', () => {
      const metadata = ROLE_METADATA[UserRole.INSTITUTIONAL_CLIENT];
      expect(metadata.permissions).toContain('TRADING_READ');
      expect(metadata.permissions).toContain('TRADING_WRITE');
      expect(metadata.permissions).toContain('PORTFOLIO_READ');
      expect(metadata.permissions).toContain('ADVANCED_TRADING');
    });

    it('should have higher maxDailyActions than regular TRADER', () => {
      const institutionalMetadata = ROLE_METADATA[UserRole.INSTITUTIONAL_CLIENT];
      const traderMetadata = ROLE_METADATA[UserRole.TRADER];
      expect(institutionalMetadata.constraints?.maxDailyActions).toBeGreaterThan(
        traderMetadata.constraints?.maxDailyActions ?? 0,
      );
    });

    it('should have priority 45', () => {
      const metadata = ROLE_METADATA[UserRole.INSTITUTIONAL_CLIENT];
      expect(metadata.priority).toBe(45);
    });
  });
});

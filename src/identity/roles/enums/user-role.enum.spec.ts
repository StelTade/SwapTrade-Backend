import { UserRole, ROLE_DESCRIPTIONS } from './user-role.enum';

describe('UserRole Enum', () => {
  describe('Role Definitions', () => {
    it('should have all required platform roles defined', () => {
      expect(UserRole.ADMIN).toBeDefined();
      expect(UserRole.USER).toBeDefined();
      expect(UserRole.STAFF).toBeDefined();
    });

    it('should have all required governance roles defined', () => {
      expect(UserRole.GOVERNANCE_OPERATOR).toBeDefined();
      expect(UserRole.KYC_OPERATOR).toBeDefined();
      expect(UserRole.KYC_GOVERNANCE).toBeDefined();
    });

    it('should have correct string values for roles', () => {
      expect(UserRole.ADMIN).toBe('ADMIN');
      expect(UserRole.USER).toBe('USER');
      expect(UserRole.STAFF).toBe('STAFF');
      expect(UserRole.GOVERNANCE_OPERATOR).toBe('GOVERNANCE_OPERATOR');
      expect(UserRole.KYC_OPERATOR).toBe('KYC_OPERATOR');
      expect(UserRole.KYC_GOVERNANCE).toBe('KYC_GOVERNANCE');
    });
  });

  describe('Role Descriptions', () => {
    it('should have descriptions for all roles', () => {
      Object.values(UserRole).forEach((role) => {
        expect(ROLE_DESCRIPTIONS[role]).toBeDefined();
        expect(typeof ROLE_DESCRIPTIONS[role]).toBe('string');
        expect(ROLE_DESCRIPTIONS[role].length).toBeGreaterThan(0);
      });
    });

    it('should have meaningful descriptions', () => {
      expect(ROLE_DESCRIPTIONS[UserRole.ADMIN]).toContain('Administrator');
      expect(ROLE_DESCRIPTIONS[UserRole.USER]).toContain('Standard user');
      expect(ROLE_DESCRIPTIONS[UserRole.STAFF]).toContain('Staff');
      expect(ROLE_DESCRIPTIONS[UserRole.KYC_OPERATOR]).toContain('KYC');
    });

    it('should not have duplicate descriptions', () => {
      const descriptions = Object.values(ROLE_DESCRIPTIONS);
      const uniqueDescriptions = new Set(descriptions);
      expect(uniqueDescriptions.size).toBe(descriptions.length);
    });
  });

  describe('Enum integrity', () => {
    it('should have exactly 6 roles', () => {
      expect(Object.keys(UserRole).length).toBe(6);
    });

    it('should have matching descriptions count', () => {
      expect(Object.keys(ROLE_DESCRIPTIONS).length).toBe(
        Object.keys(UserRole).length
      );
    });
  });
});

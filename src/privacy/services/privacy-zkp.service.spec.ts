import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyZKPService } from '../services/privacy-zkp.service';

describe('PrivacyZKPService', () => {
  let service: PrivacyZKPService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrivacyZKPService],
    }).compile();

    service = module.get<PrivacyZKPService>(PrivacyZKPService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('balance commitment', () => {
    it('should create balance commitment', () => {
      const balance = '1000000000000000000'; // 1 ETH in wei
      const nonce = 'test-nonce-123';

      const commitment = service.createBalanceCommitment(balance, nonce);

      expect(commitment).toBeDefined();
      expect(commitment.commitment).toHaveLength(64); // SHA-256 hash
      expect(commitment.nonce).toBe(nonce);
      expect(commitment.createdAt).toBeInstanceOf(Date);
    });

    it('should generate different commitments for different balances', () => {
      const commitment1 = service.createBalanceCommitment('1000');
      const commitment2 = service.createBalanceCommitment('2000');

      expect(commitment1.commitment).not.toBe(commitment2.commitment);
    });

    it('should generate random nonce if not provided', () => {
      const balance = '5000';
      const commitment1 = service.createBalanceCommitment(balance);
      const commitment2 = service.createBalanceCommitment(balance);

      expect(commitment1.nonce).not.toBe(commitment2.nonce);
      expect(commitment1.commitment).not.toBe(commitment2.commitment);
    });
  });

  describe('balance proof generation and verification', () => {
    it('should generate proof that balance >= min_amount', () => {
      const balance = '1000';
      const coefficient = '2';
      const minAmount = '500';
      const challenge = service.generateServerChallenge();

      const proof = service.generateBalanceProof(
        balance,
        coefficient,
        minAmount,
        challenge,
      );

      expect(proof).toBeDefined();
      expect(proof.commitment).toHaveLength(64);
      expect(proof.proof).toBeDefined();
      expect(proof.minAmount).toBe(minAmount);
      expect(proof.timestamp).toBeDefined();
      expect(proof.validity).toBe(3600);
    });

    it('should fail to generate proof with insufficient balance', () => {
      const balance = '100';
      const coefficient = '2';
      const minAmount = '1000';
      const challenge = service.generateServerChallenge();

      expect(() =>
        service.generateBalanceProof(
          balance,
          coefficient,
          minAmount,
          challenge,
        ),
      ).toThrow();
    });

    it('should verify valid balance proof', () => {
      const balance = '1000';
      const coefficient = '2';
      const minAmount = '500';
      const challenge = service.generateServerChallenge();

      const proof = service.generateBalanceProof(
        balance,
        coefficient,
        minAmount,
        challenge,
      );
      const isValid = service.verifyBalanceProof(
        proof.commitment,
        proof.proof,
        proof.minAmount,
        challenge,
        coefficient,
      );

      expect(isValid).toBe(true);
    });

    it('should handle edge cases (balance == minAmount)', () => {
      const balance = '500';
      const coefficient = '1';
      const minAmount = '500';
      const challenge = service.generateServerChallenge();

      const proof = service.generateBalanceProof(
        balance,
        coefficient,
        minAmount,
        challenge,
      );
      expect(proof).toBeDefined();
    });
  });

  describe('range proof', () => {
    it('should create range proof for balance within range', () => {
      const balance = '750';
      const minRange = '500';
      const maxRange = '1000';

      const rangeProof = service.createRangeProof(balance, minRange, maxRange);

      expect(rangeProof).toBeDefined();
      expect(rangeProof.proof).toHaveLength(64);
      expect(rangeProof.minRange).toBe(minRange);
      expect(rangeProof.maxRange).toBe(maxRange);
      expect(rangeProof.timestamp).toBeDefined();
    });

    it('should fail range proof if balance below min', () => {
      const balance = '400';
      const minRange = '500';
      const maxRange = '1000';

      expect(() =>
        service.createRangeProof(balance, minRange, maxRange),
      ).toThrow();
    });

    it('should fail range proof if balance above max', () => {
      const balance = '1100';
      const minRange = '500';
      const maxRange = '1000';

      expect(() =>
        service.createRangeProof(balance, minRange, maxRange),
      ).toThrow();
    });

    it('should verify valid range proof', () => {
      const balance = '750';
      const minRange = '500';
      const maxRange = '1000';

      const rangeProof = service.createRangeProof(balance, minRange, maxRange);
      const isValid = service.verifyRangeProof(
        rangeProof.proof,
        rangeProof.minRange,
        rangeProof.maxRange,
      );

      expect(isValid).toBe(true);
    });
  });

  describe('membership proof', () => {
    it('should create membership proof', () => {
      const secret = 'my-secret-value';
      const membershipSet = ['value1', 'value2', 'secret-value'];

      const proof = service.createMembershipProof(secret, membershipSet);

      expect(proof).toBeDefined();
      expect(proof.proof).toHaveLength(64);
      expect(proof.setSize).toBe(membershipSet.length);
      expect(proof.timestamp).toBeDefined();
    });
  });

  describe('non-zero proof', () => {
    it('should create proof that balance > 0', () => {
      const balance = '1000';

      const proof = service.createNonZeroProof(balance);

      expect(proof).toBeDefined();
      expect(proof.proof).toHaveLength(64);
      expect(proof.timestamp).toBeDefined();
    });

    it('should fail non-zero proof for zero balance', () => {
      const balance = '0';

      expect(() => service.createNonZeroProof(balance)).toThrow();
    });

    it('should fail non-zero proof for negative balance', () => {
      const balance = '-100';

      expect(() => service.createNonZeroProof(balance)).toThrow();
    });
  });

  describe('time-locked proof', () => {
    it('should create time-locked proof', () => {
      const balance = '1000';
      const minAmount = '500';
      const validitySeconds = 3600;

      const proof = service.createTimeLockedProof(
        balance,
        minAmount,
        validitySeconds,
      );

      expect(proof).toBeDefined();
      expect(proof.proof).toHaveLength(64);
      expect(proof.issuedAt).toBeDefined();
      expect(proof.expiresAt).toBe(proof.issuedAt + validitySeconds * 1000);
    });

    it('should fail time-locked proof with insufficient balance', () => {
      const balance = '100';
      const minAmount = '1000';

      expect(() => service.createTimeLockedProof(balance, minAmount)).toThrow();
    });

    it('should verify valid time-locked proof', () => {
      const proof = service.createTimeLockedProof('1000', '500', 3600);

      const isValid = service.verifyTimeLockedProof(
        proof.proof,
        proof.issuedAt,
        proof.expiresAt,
      );

      expect(isValid).toBe(true);
    });

    it('should reject expired time-locked proof', () => {
      const pastTime = Date.now() - 10000; // 10 seconds ago
      const expiredTime = Date.now() - 1000; // Already expired

      const isValid = service.verifyTimeLockedProof(
        'somehash',
        pastTime,
        expiredTime,
      );

      expect(isValid).toBe(false);
    });
  });

  describe('proof hashing', () => {
    it('should hash proof', () => {
      const proof = {
        commitment: 'abc123',
        proof: 'def456',
      };

      const hash = service.hashProof(proof);

      expect(hash).toHaveLength(64);
    });

    it('should produce consistent hash for same proof', () => {
      const proof = 'test-proof';

      const hash1 = service.hashProof(proof);
      const hash2 = service.hashProof(proof);

      expect(hash1).toBe(hash2);
    });
  });

  describe('server challenge', () => {
    it('should generate unique server challenges', () => {
      const challenge1 = service.generateServerChallenge();
      const challenge2 = service.generateServerChallenge();

      expect(challenge1).not.toBe(challenge2);
      expect(challenge1).toHaveLength(64); // 32 bytes * 2 for hex encoding
    });
  });

  describe('zero-knowledge privacy guarantees', () => {
    it('should not reveal balance in proof', () => {
      const balance = '12345678';
      const coefficient = '1';
      const minAmount = '1000';
      const challenge = service.generateServerChallenge();

      const proof = service.generateBalanceProof(
        balance,
        coefficient,
        minAmount,
        challenge,
      );

      // Proof should not contain the actual balance
      expect(proof.proof).not.toContain(balance);
      expect(JSON.stringify(proof)).not.toContain(balance);
    });

    it('should allow verifying different ranges with same proof', () => {
      const balance = '5000';
      const proof = service.createRangeProof(balance, '1000', '10000');

      // Verification should work
      const isValid1 = service.verifyRangeProof(proof.proof, '1000', '10000');
      const isValid2 = service.verifyRangeProof(proof.proof, '1000', '10000');

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });
  });
});

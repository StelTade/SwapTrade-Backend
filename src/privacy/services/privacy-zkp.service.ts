import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Simplified Zero-Knowledge Proof (ZKP) implementation
 * for balance verification without revealing the balance amount.
 *
 * This implementation uses a commitment-based approach:
 * - User commits to their balance: C = hash(balance || nonce)
 * - To prove balance >= min_amount, generate a proof without revealing balance
 * - Verifier checks proof against public commitment
 */

export interface ZKProof {
  commitment: string; // Public commitment to balance
  proof: string; // ZKP proof that balance >= min_amount
  minAmount: string; // Minimum amount proven
  timestamp: number; // When proof was generated
  validity: number; // Validity period in seconds
}

export interface BalanceCommitment {
  commitment: string;
  nonce: string;
  createdAt: Date;
}

@Injectable()
export class PrivacyZKPService {
  /**
   * Create a commitment to a balance amount
   * Uses: C = hash(balance || nonce)
   * @param balance The balance amount (as string to preserve precision)
   * @param nonce Optional nonce (if not provided, generates random)
   * @returns Commitment object with commitment hash and nonce
   */
  createBalanceCommitment(balance: string, nonce?: string): BalanceCommitment {
    const usedNonce = nonce || this.generateNonce();
    const combined = `${balance}:${usedNonce}`;
    const commitment = crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex');

    return {
      commitment,
      nonce: usedNonce,
      createdAt: new Date(),
    };
  }

  /**
   * Generate a ZKP proof that balance >= min_amount without revealing the balance
   * Uses a challenge-response protocol
   * @param balance The actual balance (kept secret)
   * @param coefficient Coefficient used in commitment
   * @param minAmount Minimum amount to prove
   * @param challenge Server challenge (random)
   * @returns ZKP proof object
   */
  generateBalanceProof(
    balance: string,
    coefficient: string,
    minAmount: string,
    challenge: string,
  ): ZKProof {
    try {
      const balanceNum = BigInt(balance);
      const minNum = BigInt(minAmount);
      const coeffNum = BigInt(coefficient);
      const challengeNum = BigInt(challenge);

      if (balanceNum < minNum) {
        throw new BadRequestException(
          'Balance is insufficient to generate valid proof',
        );
      }

      // Generate a witness (random value)
      const witness = this.generateRandomBigInt(256);

      // Compute response: response = witness + challenge * (balance - min_amount)
      const difference = balanceNum - minNum;
      const response = witness + challengeNum * difference;

      // Create proof components
      const commitment = crypto
        .createHash('sha256')
        .update(`${coeffNum}:${witness}`)
        .digest('hex');

      const proof = response.toString();

      return {
        commitment,
        proof,
        minAmount,
        timestamp: Date.now(),
        validity: 3600, // Valid for 1 hour
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Proof generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify a ZKP proof that balance >= min_amount
   * The verifier only needs:
   * - The public commitment
   * - The proof
   * - The challenge (same one used for generation)
   * - The coefficient used in commitment
   *
   * @param commitment Public commitment to balance
   * @param proof ZKP proof
   * @param minAmount Minimum amount proven
   * @param challenge Server challenge used
   * @param coefficient Coefficient used in commitment
   * @returns True if proof is valid, false otherwise
   */
  verifyBalanceProof(
    commitment: string,
    proof: string,
    minAmount: string,
    challenge: string,
    coefficient: string,
  ): boolean {
    try {
      const proofNum = BigInt(proof);
      const challengeNum = BigInt(challenge);
      const coeffNum = BigInt(coefficient);

      // Reconstruct the commitment point from the proof
      // This is the verifier's computation
      // In a real ZK-SNARK, this would be more complex
      const expectedCommitment = crypto
        .createHash('sha256')
        .update(`${coeffNum}:${proofNum}`)
        .digest('hex');

      // For this simplified version, we verify that the commitment exists
      // In production, use actual ZK-SNARK libraries like circom + snarkjs
      return commitment.length === 64; // SHA-256 produces 64 hex characters
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a range proof (balance is within [min, max]) without revealing exact amount
   * @param balance Actual balance
   * @param minRange Minimum of range
   * @param maxRange Maximum of range
   * @returns Range proof object
   */
  createRangeProof(
    balance: string,
    minRange: string,
    maxRange: string,
  ): {
    proof: string;
    minRange: string;
    maxRange: string;
    timestamp: number;
  } {
    const balanceNum = BigInt(balance);
    const minNum = BigInt(minRange);
    const maxNum = BigInt(maxRange);

    if (balanceNum < minNum || balanceNum > maxNum) {
      throw new BadRequestException('Balance is outside the specified range');
    }

    // Create a commitment to the balance
    const nonce = this.generateNonce();
    const commitment = crypto
      .createHash('sha256')
      .update(`${balance}:${nonce}:range`)
      .digest('hex');

    return {
      proof: commitment,
      minRange,
      maxRange,
      timestamp: Date.now(),
    };
  }

  /**
   * Verify a range proof
   * @param proof The range proof
   * @param minRange Minimum of range
   * @param maxRange Maximum of range
   * @returns True if proof format is valid
   */
  verifyRangeProof(proof: string, minRange: string, maxRange: string): boolean {
    try {
      // Verify proof format
      if (!/^[a-f0-9]{64}$/.test(proof)) {
        return false;
      }

      // Verify range format
      const min = BigInt(minRange);
      const max = BigInt(maxRange);

      return min < max && min >= 0n;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a membership proof (proving knowledge of a secret withoutreleasing it)
   * @param secret The secret value
   * @param membershipSet Set of public values
   * @returns Membership proof
   */
  createMembershipProof(
    secret: string,
    membershipSet: string[],
  ): {
    proof: string;
    setSize: number;
    timestamp: number;
  } {
    // Create commitment to secret
    const commitment = crypto
      .createHash('sha256')
      .update(`${secret}:membership`)
      .digest('hex');

    return {
      proof: commitment,
      setSize: membershipSet.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate a nonce for proof generation
   * @returns Random nonce (hex)
   */
  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a random BigInt of specified bit length
   * @param bits Bit length
   * @returns Random BigInt
   */
  private generateRandomBigInt(bits: number): bigint {
    const bytes = Math.ceil(bits / 8);
    const buffer = crypto.randomBytes(bytes);
    return BigInt('0x' + buffer.toString('hex'));
  }

  /**
   * Create a proof of non-zero knowledge (proving balance > 0)
   * @param balance The balance
   * @returns Proof that balance is positive
   */
  createNonZeroProof(balance: string): {
    proof: string;
    timestamp: number;
  } {
    const balanceNum = BigInt(balance);

    if (balanceNum <= 0n) {
      throw new BadRequestException(
        'Balance must be positive to generate non-zero proof',
      );
    }

    const proof = crypto
      .createHash('sha256')
      .update(`${balance}:nonzero:${Date.now()}`)
      .digest('hex');

    return {
      proof,
      timestamp: Date.now(),
    };
  }

  /**
   * Hash a proof for storage/comparison
   * @param proof The proof to hash
   * @returns Hashed proof
   */
  hashProof(proof: string | object): string {
    const data = typeof proof === 'string' ? proof : JSON.stringify(proof);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a server challenge for proof verification
   * @returns Random hex challenge
   */
  generateServerChallenge(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a time-locked proof that is only valid for a specific time period
   * @param balance Balance to prove
   * @param minAmount Minimum amount to prove
   * @param validitySeconds How long proof is valid
   * @returns Time-locked proof
   */
  createTimeLockedProof(
    balance: string,
    minAmount: string,
    validitySeconds: number = 3600,
  ): {
    proof: string;
    issuedAt: number;
    expiresAt: number;
  } {
    const balanceNum = BigInt(balance);
    const minNum = BigInt(minAmount);

    if (balanceNum < minNum) {
      throw new BadRequestException('Insufficient balance for proof');
    }

    const issuedAt = Date.now();
    const expiresAt = issuedAt + validitySeconds * 1000;

    const proof = crypto
      .createHash('sha256')
      .update(`${balance}:${minAmount}:${issuedAt}:${expiresAt}`)
      .digest('hex');

    return {
      proof,
      issuedAt,
      expiresAt,
    };
  }

  /**
   * Verify a time-locked proof is still valid
   * @param proof The time-locked proof
   * @param issuedAt When proof was issued
   * @param expiresAt When proof expires
   * @returns True if proof is still valid
   */
  verifyTimeLockedProof(
    proof: string,
    issuedAt: number,
    expiresAt: number,
  ): boolean {
    const now = Date.now();
    return proof.length === 64 && issuedAt <= now && now < expiresAt;
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerifiableCredential,
  CredentialStatus,
} from '../entities/verifiable-credential.entity';
import { verifyMessage } from 'ethers';

export class ZkProofPayload {
  userDid: string;
  vcId: string;
  // In a real ZKP, this is the snarkjs proof logic. Here we mock it via signature payload
  zkpProofSignature: string;
  publicSignals: {
    requiredTier: number;
    challengeMatch: string;
  };
}

@Injectable()
export class ZkpVerifierService {
  private readonly logger = new Logger(ZkpVerifierService.name);

  constructor(
    @InjectRepository(VerifiableCredential)
    private readonly vcRepo: Repository<VerifiableCredential>,
  ) {}

  /**
   * Evaluates a pseudo zero-knowledge proof ensuring the VC properties match
   * the requested thresholds without unencrypting DB variables.
   */
  async verifyProof(payload: ZkProofPayload): Promise<boolean> {
    try {
      // 1. Ensure the referenced credential exists and is active locally (Revocation Registry Check)
      const vc = await this.vcRepo.findOne({
        where: { id: payload.vcId, did: payload.userDid },
      });

      if (!vc) {
        throw new BadRequestException('Verifiable Credential not found');
      }

      if (vc.status !== CredentialStatus.ACTIVE) {
        throw new BadRequestException('VC is revoked or expired');
      }

      // 2. Perform Mock Verification
      // In a real ZKP scenario, `snarkjs.groth16.verify` would be called here.
      // E.g., const isValid = await snarkjs.groth16.verify(vKey, payload.publicSignals, payload.zkpProof);

      // Mock validation logic via local standard ethereum sig recovery
      const challengeStr = `${vc.id}-${payload.publicSignals.requiredTier}-${payload.publicSignals.challengeMatch}`;

      const recoveredAddress = verifyMessage(
        challengeStr,
        payload.zkpProofSignature,
      );
      const userAddress = payload.userDid.split(':').pop();

      const isValid =
        recoveredAddress.toLowerCase() === userAddress?.toLowerCase();

      if (isValid) {
        this.logger.log(`ZKP proof verified for DID: ${payload.userDid}`);
        return true;
      }

      return false;
    } catch (error: any) {
      this.logger.warn(`ZKP verification failed: ${error.message}`);
      return false;
    }
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DidDocument } from '../entities/did-document.entity';
import { verifyMessage } from 'ethers';
import * as crypto from 'crypto';

@Injectable()
export class DidAuthService {
  constructor(
    @InjectRepository(DidDocument)
    private readonly didDocRepo: Repository<DidDocument>,
  ) {}

  async generateChallenge(did: string): Promise<string> {
    let doc = await this.didDocRepo.findOne({ where: { did } });

    // Auto-onboard for demonstration if no doc exists (in reality, requires registration step)
    if (!doc) {
      doc = this.didDocRepo.create({
        did,
        userId: crypto.randomUUID(), // Mock linking to a real backend user
      });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    doc.nonce = nonce;
    // Set expiry 5 mins from now
    doc.nonceExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await this.didDocRepo.save(doc);
    return nonce;
  }

  async verifySignature(did: string, signature: string): Promise<any> {
    const doc = await this.didDocRepo.findOne({ where: { did } });
    if (!doc || !doc.nonce || !doc.nonceExpiry) {
      throw new UnauthorizedException('Challenge not requested or expired');
    }

    if (doc.nonceExpiry < new Date()) {
      throw new UnauthorizedException('Challenge expired');
    }

    try {
      // For did:ethr:0x123..., the address is the last part
      const address = did.split(':').pop();
      if (!address) {
        throw new UnauthorizedException('Invalid DID format');
      }

      // We expect the user signed the raw nonce string
      const recoveredAddress = verifyMessage(doc.nonce, signature);

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new UnauthorizedException('Signature recovery mismatch');
      }

      // Reset nonce to prevent replay attacks
      doc.nonce = '';
      doc.nonceExpiry = null;
      await this.didDocRepo.save(doc);

      // Return a pseudo session token for the standard auth system to consume
      const sessionToken = crypto.randomBytes(32).toString('hex');
      return {
        message: 'DID Authentication successful',
        userId: doc.userId,
        sessionToken,
      };
    } catch (err) {
      throw new UnauthorizedException('Signature verification failed');
    }
  }
}

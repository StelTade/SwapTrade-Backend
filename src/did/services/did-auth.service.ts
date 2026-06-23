import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
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

  /**
   * Register a new DID and anchor its W3C DID document.
   * Returns a minimal W3C DID Core compliant document.
   */
  async registerDid(
    did: string,
    publicKey: string,
  ): Promise<Record<string, unknown>> {
    const existing = await this.didDocRepo.findOne({ where: { did } });
    if (existing) {
      throw new ConflictException(`DID '${did}' is already registered`);
    }

    const doc = this.didDocRepo.create({
      did,
      publicKey,
      userId: crypto.randomUUID(),
    });
    await this.didDocRepo.save(doc);

    return this.buildW3cDocument(doc);
  }

  /**
   * Resolve a DID to its W3C-compliant DID document.
   */
  async resolveDidDocument(
    did: string,
  ): Promise<Record<string, unknown> | null> {
    const doc = await this.didDocRepo.findOne({ where: { did } });
    if (!doc) return null;
    return this.buildW3cDocument(doc);
  }

  async generateChallenge(did: string): Promise<string> {
    let doc = await this.didDocRepo.findOne({ where: { did } });

    if (!doc) {
      doc = this.didDocRepo.create({
        did,
        userId: crypto.randomUUID(),
      });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    doc.nonce = nonce;
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
      const address = did.split(':').pop();
      if (!address) {
        throw new UnauthorizedException('Invalid DID format');
      }

      const recoveredAddress = verifyMessage(doc.nonce, signature);

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new UnauthorizedException('Signature recovery mismatch');
      }

      // Reset nonce to prevent replay attacks
      doc.nonce = '';
      doc.nonceExpiry = null;
      await this.didDocRepo.save(doc);

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

  private buildW3cDocument(doc: DidDocument): Record<string, unknown> {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/secp256k1-2019/v1',
      ],
      id: doc.did,
      verificationMethod: doc.publicKey
        ? [
            {
              id: `${doc.did}#keys-1`,
              type: 'EcdsaSecp256k1VerificationKey2019',
              controller: doc.did,
              publicKeyHex: doc.publicKey,
            },
          ]
        : [],
      authentication: doc.publicKey ? [`${doc.did}#keys-1`] : [],
      assertionMethod: doc.publicKey ? [`${doc.did}#keys-1`] : [],
      created: doc.createdAt,
      updated: doc.updatedAt,
    };
  }
}

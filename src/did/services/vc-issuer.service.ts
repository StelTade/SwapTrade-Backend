import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  VerifiableCredential,
  CredentialStatus,
} from '../entities/verifiable-credential.entity';
import * as crypto from 'crypto';

@Injectable()
export class VcIssuerService {
  private readonly logger = new Logger(VcIssuerService.name);

  // Simulated Master Issuer DID (Ideally verified externally)
  private readonly issuerDid = 'did:ethr:0xSwapTradeKycIssuer000000';
  private readonly encryptionKey = crypto.scryptSync(
    'SwapTradeMasterSuperSecret',
    'salt',
    32,
  );

  constructor(
    @InjectRepository(VerifiableCredential)
    private readonly vcRepo: Repository<VerifiableCredential>,
  ) {}

  async issueKycCredential(
    userDid: string,
    kycTier: number,
    fullName: string,
    dateOfBirth: string,
  ): Promise<VerifiableCredential> {
    try {
      // 1. Construct raw credential payload
      const credentialPayload = {
        subject: userDid,
        claims: {
          tier: kycTier,
          fullName,
          dateOfBirth,
          clearedAt: new Date().toISOString(),
        },
        issuer: this.issuerDid,
      };

      // 2. Encrypt the payload for Privacy-Preservation
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        iv,
      );
      let encrypted = cipher.update(
        JSON.stringify(credentialPayload),
        'utf8',
        'hex',
      );
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      const securePayload = JSON.stringify({
        iv: iv.toString('hex'),
        content: encrypted,
        authTag, // Stores authTag ensuring E2E data wasn't tampered
      });

      // 3. Issue and anchor locally
      const vc = this.vcRepo.create({
        did: userDid,
        issuerDid: this.issuerDid,
        credentialType: 'KYC_CLEARANCE',
        encryptedPayload: securePayload,
        status: CredentialStatus.ACTIVE,
      });

      await this.vcRepo.save(vc);
      this.logger.log(`Issued KYC VC for ${userDid}`);
      return vc;
    } catch (e) {
      this.logger.error('Failed to issue credential', e);
      throw new InternalServerErrorException('Credential generation failed');
    }
  }

  async revokeCredential(vcId: string): Promise<boolean> {
    const vc = await this.vcRepo.findOne({ where: { id: vcId } });
    if (!vc) throw new NotFoundException('Credential not found');

    vc.status = CredentialStatus.REVOKED;
    await this.vcRepo.save(vc);

    this.logger.log(`Revoked VC ${vcId}`);
    return true;
  }
}

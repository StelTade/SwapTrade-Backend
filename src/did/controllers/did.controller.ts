import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DidAuthService } from '../services/did-auth.service';
import { VcIssuerService } from '../services/vc-issuer.service';
import {
  ZkpVerifierService,
  ZkProofPayload,
} from '../services/zkp-verifier.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerifiableCredential } from '../entities/verifiable-credential.entity';

@ApiTags('DID & Self-Sovereign Identity')
@Controller('api/did')
export class DidController {
  constructor(
    private readonly didAuthService: DidAuthService,
    private readonly vcIssuerService: VcIssuerService,
    private readonly zkpVerifierService: ZkpVerifierService,
    @InjectRepository(VerifiableCredential)
    private readonly vcRepo: Repository<VerifiableCredential>,
  ) {}

  @Post('auth/challenge')
  @ApiOperation({
    summary: 'Generate a cryptographic nonce challenge for DID authentication',
  })
  async getChallenge(@Body('did') did: string) {
    if (!did)
      throw new HttpException('DID is required', HttpStatus.BAD_REQUEST);
    const nonce = await this.didAuthService.generateChallenge(did);
    return { nonce };
  }

  @Post('auth/verify')
  @ApiOperation({
    summary: 'Verify DID signature and establish an authenticated session',
  })
  async verifySignature(
    @Body('did') did: string,
    @Body('signature') signature: string,
  ) {
    if (!did || !signature) {
      throw new HttpException(
        'DID and signature are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const sessionToken = await this.didAuthService.verifySignature(
      did,
      signature,
    );
    return sessionToken; // Returns standard app token session
  }

  @Get('credentials/:did')
  @ApiOperation({
    summary:
      'Retrieve public privacy-preserving schemas for a particular DID profile',
  })
  async getCredentials(@Param('did') did: string) {
    // Only return non-PII attributes off the VCs (hiding the encrypted payloads)
    const vcs = await this.vcRepo.find({ where: { did } });

    return vcs.map((vc) => ({
      id: vc.id,
      credentialType: vc.credentialType,
      issuerDid: vc.issuerDid,
      status: vc.status,
      issuedAt: vc.issuedAt,
    }));
  }

  @Post('verify-proof')
  @ApiOperation({
    summary:
      'Third-party API for ZKP credential verification (KYC/AML Compliance Rules)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns boolean validating the zero-knowledge proof constraint',
  })
  async verifyZkp(@Body() payload: ZkProofPayload) {
    if (!payload.userDid || !payload.vcId || !payload.zkpProofSignature) {
      throw new HttpException(
        'Invalid Zero-Knowledge Proof payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isValid = await this.zkpVerifierService.verifyProof(payload);

    return {
      verified: isValid,
      timestamp: new Date().toISOString(),
    };
  }
}

import {
  Controller,
  Post,
  Get,
  Patch,
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

  // ── DID Document Management ────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new DID and anchor its DID document' })
  @ApiResponse({ status: 201, description: 'DID document created' })
  async registerDid(
    @Body('did') did: string,
    @Body('publicKey') publicKey: string,
  ) {
    if (!did || !publicKey) {
      throw new HttpException(
        'did and publicKey are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const document = await this.didAuthService.registerDid(did, publicKey);
    return document;
  }

  @Get('document/:did')
  @ApiOperation({ summary: 'Resolve a W3C-compliant DID document' })
  @ApiResponse({ status: 200, description: 'W3C DID document' })
  async resolveDidDocument(@Param('did') did: string) {
    const document = await this.didAuthService.resolveDidDocument(did);
    if (!document) {
      throw new HttpException('DID not found', HttpStatus.NOT_FOUND);
    }
    return document;
  }

  // ── DID Authentication ─────────────────────────────────────────────────────

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
    return sessionToken;
  }

  // ── Verifiable Credentials ─────────────────────────────────────────────────

  @Post('credentials/issue')
  @ApiOperation({ summary: 'Issue a KYC verifiable credential for a DID' })
  @ApiResponse({ status: 201, description: 'VC issued successfully' })
  async issueCredential(
    @Body('userDid') userDid: string,
    @Body('kycTier') kycTier: number,
    @Body('fullName') fullName: string,
    @Body('dateOfBirth') dateOfBirth: string,
  ) {
    if (!userDid || kycTier === undefined || !fullName || !dateOfBirth) {
      throw new HttpException(
        'userDid, kycTier, fullName, and dateOfBirth are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const vc = await this.vcIssuerService.issueKycCredential(
      userDid,
      kycTier,
      fullName,
      dateOfBirth,
    );
    return {
      id: vc.id,
      did: vc.did,
      issuerDid: vc.issuerDid,
      credentialType: vc.credentialType,
      status: vc.status,
      issuedAt: vc.issuedAt,
    };
  }

  @Get('credentials/:did')
  @ApiOperation({
    summary: 'Retrieve public credential metadata for a DID (no PII exposed)',
  })
  async getCredentials(@Param('did') did: string) {
    const vcs = await this.vcRepo.find({ where: { did } });
    return vcs.map((vc) => ({
      id: vc.id,
      credentialType: vc.credentialType,
      issuerDid: vc.issuerDid,
      status: vc.status,
      issuedAt: vc.issuedAt,
    }));
  }

  @Patch('credentials/:id/revoke')
  @ApiOperation({ summary: 'Revoke a verifiable credential by ID' })
  @ApiResponse({ status: 200, description: 'Credential revoked' })
  async revokeCredential(@Param('id') id: string) {
    const revoked = await this.vcIssuerService.revokeCredential(id);
    return { revoked, vcId: id, revokedAt: new Date().toISOString() };
  }

  // ── Zero-Knowledge Proofs ──────────────────────────────────────────────────

  @Post('verify-proof')
  @ApiOperation({
    summary: 'Verify a ZKP credential proof without revealing raw KYC data',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns boolean validating the zero-knowledge proof',
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

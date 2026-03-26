import {
  Controller,
  Get,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { StellarUsdcService } from './stellar-usdc.service';

@Controller('stellar')
export class StellarUsdcController {
  private readonly logger = new Logger(StellarUsdcController.name);

  constructor(private readonly stellarUsdcService: StellarUsdcService) {}

  /**
   * Get USDC configuration
   * GET /api/stellar/usdc/config
   */
  @Get('usdc/config')
  @HttpCode(HttpStatus.OK)
  getConfig(): {
    issuer: string | null;
    assetCode: string;
    horizonUrl: string;
    isConfigured: boolean;
  } {
    return this.stellarUsdcService.getConfig();
  }

  /**
   * Get USDC balance for a Stellar account
   * GET /api/stellar/balance/:publicKey
   * 
   * This is the main endpoint requested in Issue #207
   */
  @Get('balance/:publicKey')
  @HttpCode(HttpStatus.OK)
  async getUSDCBalance(
    @Param('publicKey') publicKey: string,
  ): Promise<{
    publicKey: string;
    balance: string;
    issuer: string;
    hasTrustline: boolean;
    accountExists: boolean;
    queriedAt: Date;
    error?: string;
    code?: string;
  }> {
    // Validate public key format first
    if (!this.stellarUsdcService.isValidPublicKey(publicKey)) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    const result = await this.stellarUsdcService.getUSDCBalance(publicKey);

    return {
      publicKey,
      balance: result.balance || '0',
      issuer: this.stellarUsdcService.getIssuer() || '',
      hasTrustline: result.hasTrustline || false,
      accountExists: result.accountExists || false,
      queriedAt: new Date(),
      error: result.error,
      code: result.code,
    };
  }

  /**
   * Check if account has USDC trustline
   * GET /api/stellar/balance/:publicKey/trustline
   */
  @Get('balance/:publicKey/trustline')
  @HttpCode(HttpStatus.OK)
  async checkTrustline(
    @Param('publicKey') publicKey: string,
  ): Promise<{
    publicKey: string;
    hasTrustline: boolean;
    issuer: string;
  }> {
    if (!this.stellarUsdcService.isValidPublicKey(publicKey)) {
      throw new BadRequestException('Invalid Stellar public key format');
    }

    const result = await this.stellarUsdcService.hasUSDCTrustline(publicKey);

    return {
      publicKey,
      hasTrustline: result.hasTrustline || false,
      issuer: this.stellarUsdcService.getIssuer() || '',
    };
  }
}

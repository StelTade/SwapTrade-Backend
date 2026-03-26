import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Horizon, Networks, Asset } from 'stellar-sdk';
import * as StellarSdk from 'stellar-sdk';

@Injectable()
export class StellarUsdcService implements OnModuleInit {
  private readonly logger = new Logger(StellarUsdcService.name);
  private readonly server: Horizon.Server;
  private readonly horizonUrl: string;
  private readonly usdcIssuer: string | null;
  private readonly usdcAsset: Asset | null;

  constructor(private readonly configService: ConfigService) {
    this.horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org'
    );
    
    this.usdcIssuer = this.configService.get<string>('STELLAR_USDC_ISSUER', null);
    
    this.server = new Horizon.Server(this.horizonUrl);
    
    // Create USDC asset if issuer is configured
    if (this.usdcIssuer) {
      this.usdcAsset = new Asset('USDC', this.usdcIssuer);
      this.logger.log(`USDC configured with issuer: ${this.usdcIssuer}`);
    } else {
      this.usdcAsset = null;
      this.logger.warn('STELLAR_USDC_ISSUER not configured. USDC balance endpoints will return errors.');
    }
  }

  async onModuleInit() {
    try {
      await this.server.root();
      this.logger.log('Stellar Horizon connection verified');
    } catch (error) {
      this.logger.error('Failed to connect to Stellar Horizon', error);
    }
  }

  /**
   * Check if USDC is configured
   */
  isUsdcConfigured(): boolean {
    return !!this.usdcIssuer && !!this.usdcAsset;
  }

  /**
   * Get USDC configuration
   */
  getConfig(): {
    issuer: string | null;
    assetCode: string;
    horizonUrl: string;
    isConfigured: boolean;
  } {
    return {
      issuer: this.usdcIssuer,
      assetCode: 'USDC',
      horizonUrl: this.horizonUrl,
      isConfigured: this.isUsdcConfigured(),
    };
  }

  /**
   * Validate a Stellar public key
   */
  isValidPublicKey(publicKey: string): boolean {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get USDC balance for a Stellar account
   */
  async getUSDCBalance(publicKey: string): Promise<{
    success: boolean;
    balance?: string;
    hasTrustline?: boolean;
    accountExists?: boolean;
    error?: string;
    code?: string;
  }> {
    // Validate public key
    if (!this.isValidPublicKey(publicKey)) {
      return {
        success: false,
        error: 'Invalid Stellar public key',
        code: 'INVALID_PUBLIC_KEY',
      };
    }

    // Check if USDC is configured
    if (!this.isUsdcConfigured()) {
      return {
        success: false,
        error: 'USDC issuer not configured. Set STELLAR_USDC_ISSUER environment variable.',
        code: 'USDC_NOT_CONFIGURED',
      };
    }

    try {
      // Load the account
      const account = await this.server.loadAccount(publicKey);
      
      // Find USDC balance
      const usdcBalance = account.balances.find(b => 
        b.asset_type !== 'native' &&
        b.asset_code === 'USDC' &&
        b.asset_issuer === this.usdcIssuer
      );

      return {
        success: true,
        balance: usdcBalance?.balance || '0',
        hasTrustline: !!usdcBalance,
        accountExists: true,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return {
          success: true,
          balance: '0',
          hasTrustline: false,
          accountExists: false,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'HORIZON_ERROR',
      };
    }
  }

  /**
   * Check if account has USDC trustline
   */
  async hasUSDCTrustline(publicKey: string): Promise<{
    success: boolean;
    hasTrustline?: boolean;
    error?: string;
  }> {
    const result = await this.getUSDCBalance(publicKey);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    return {
      success: true,
      hasTrustline: result.hasTrustline,
    };
  }

  /**
   * Get the USDC asset for transaction building
   */
  getUSDAsset(): Asset | null {
    return this.usdcAsset;
  }

  /**
   * Get the issuer account ID
   */
  getIssuer(): string | null {
    return this.usdcIssuer;
  }
}

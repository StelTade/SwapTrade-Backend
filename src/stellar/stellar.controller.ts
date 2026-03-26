import {
  Controller,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { StellarService } from './stellar.service';

@Controller('stellar')
export class StellarController {
  private readonly logger = new Logger(StellarController.name);

  constructor(private readonly stellarService: StellarService) {}

  /**
   * Get service configuration and status
   * GET /api/stellar/config
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  getConfig(): {
    horizonUrl: string;
    networkPassphrase: string;
    usdcIssuer: string | null;
    usdcConfigured: boolean;
  } {
    return this.stellarService.getConfig();
  }

  /**
   * Health check for Stellar service
   * GET /api/stellar/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    horizonConnected: boolean;
    usdcConfigured: boolean;
    latestLedger?: number;
    error?: string;
  }> {
    return this.stellarService.healthCheck();
  }

  /**
   * Load an account and its balances
   * GET /api/stellar/account/:accountId
   */
  @Get('account/:accountId')
  @HttpCode(HttpStatus.OK)
  async loadAccount(
    @Param('accountId') accountId: string,
  ): Promise<{
    success: boolean;
    account?: any;
    balances?: any[];
    error?: string;
  }> {
    if (!accountId || accountId.length !== 56) {
      throw new BadRequestException('Invalid account ID. Must be a valid Stellar public key.');
    }

    return this.stellarService.loadAccount(accountId);
  }

  /**
   * Get account balances
   * GET /api/stellar/account/:accountId/balances
   */
  @Get('account/:accountId/balances')
  @HttpCode(HttpStatus.OK)
  async getAccountBalances(
    @Param('accountId') accountId: string,
  ): Promise<{
    success: boolean;
    balances?: any[];
    availableBalance?: string;
    minBalance?: string;
    error?: string;
  }> {
    if (!accountId || accountId.length !== 56) {
      throw new BadRequestException('Invalid account ID');
    }

    return this.stellarService.getAccountBalances(accountId);
  }

  /**
   * Get USDC balance for an account
   * GET /api/stellar/account/:accountId/usdc
   */
  @Get('account/:accountId/usdc')
  @HttpCode(HttpStatus.OK)
  async getUSDCBalance(
    @Param('accountId') accountId: string,
  ): Promise<{
    success: boolean;
    balance?: string;
    hasTrustline?: boolean;
    issuer?: string;
    error?: string;
  }> {
    if (!accountId || accountId.length !== 56) {
      throw new BadRequestException('Invalid account ID');
    }

    return this.stellarService.getUSDCBalance(accountId);
  }

  /**
   * Get recent transactions for an account
   * GET /api/stellar/account/:accountId/transactions
   * 
   * Query params:
   * - limit: Number of transactions to return (default: 10)
   */
  @Get('account/:accountId/transactions')
  @HttpCode(HttpStatus.OK)
  async getRecentTransactions(
    @Param('accountId') accountId: string,
    @Query('limit') limit?: number,
  ): Promise<{
    success: boolean;
    transactions?: any[];
    error?: string;
  }> {
    if (!accountId || accountId.length !== 56) {
      throw new BadRequestException('Invalid account ID');
    }

    return this.stellarService.getRecentTransactions(accountId, limit || 10);
  }

  /**
   * Get latest ledger info
   * GET /api/stellar/ledger/latest
   */
  @Get('ledger/latest')
  @HttpCode(HttpStatus.OK)
  async getLatestLedger(): Promise<{
    success: boolean;
    ledger?: {
      sequence: number;
      hash: string;
      closeTime: Date;
      transactionCount: number;
    };
    error?: string;
  }> {
    return this.stellarService.getLatestLedger();
  }

  /**
   * Check if an account exists
   * GET /api/stellar/account/:accountId/exists
   */
  @Get('account/:accountId/exists')
  @HttpCode(HttpStatus.OK)
  async checkAccountExists(
    @Param('accountId') accountId: string,
  ): Promise<{ exists: boolean }> {
    if (!accountId || accountId.length !== 56) {
      throw new BadRequestException('Invalid account ID');
    }

    const exists = await this.stellarService.accountExists(accountId);
    return { exists };
  }
}

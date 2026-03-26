import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Horizon,
  Networks,
  Asset,
  TransactionBuilder,
  Operation,
  Keypair,
  BASE_FEE,
} from 'stellar-sdk';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly server: Horizon.Server;
  private readonly horizonUrl: string;
  private readonly networkPassphrase: string;
  private readonly usdcIssuer: string | null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {
    // Get configuration from environment
    this.horizonUrl = this.configService.get<string>(
      'STELLAR_HORIZON_URL',
      'https://horizon-testnet.stellar.org'
    );
    
    this.networkPassphrase = this.configService.get<string>(
      'STELLAR_NETWORK_PASSPHRASE',
      Networks.TESTNET
    );
    
    this.usdcIssuer = this.configService.get<string>('STELLAR_USDC_ISSUER', null);
    
    // Initialize Horizon server
    this.server = new Horizon.Server(this.horizonUrl);
    
    this.logger.log(`Stellar service configured with Horizon URL: ${this.horizonUrl}`);
    if (this.usdcIssuer) {
      this.logger.log(`USDC issuer configured: ${this.usdcIssuer}`);
    }
  }

  async onModuleInit() {
    try {
      // Verify connection to Horizon
      await this.server.root();
      this.isInitialized = true;
      this.logger.log('Stellar Horizon connection verified successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Stellar Horizon', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    horizonUrl: string;
    networkPassphrase: string;
    usdcIssuer: string | null;
    usdcConfigured: boolean;
  } {
    return {
      horizonUrl: this.horizonUrl,
      networkPassphrase: this.networkPassphrase,
      usdcIssuer: this.usdcIssuer,
      usdcConfigured: !!this.usdcIssuer,
    };
  }

  /**
   * Load an account and its balances
   */
  async loadAccount(accountId: string): Promise<{
    success: boolean;
    account?: any;
    balances?: any[];
    error?: string;
  }> {
    try {
      const account = await this.server.loadAccount(accountId);
      
      return {
        success: true,
        account: {
          accountId: account.accountId(),
          sequence: account.sequenceNumber(),
        },
        balances: account.balances.map(b => ({
          assetType: b.asset_type,
          assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
          issuer: b.asset_issuer,
          balance: b.balance,
          isNative: b.asset_type === 'native',
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to load account ${accountId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get account balances with detailed info
   */
  async getAccountBalances(accountId: string): Promise<{
    success: boolean;
    balances?: any[];
    availableBalance?: string;
    minBalance?: string;
    error?: string;
  }> {
    try {
      const account = await this.server.loadAccount(accountId);
      
      const balances = account.balances.map(b => ({
        assetType: b.asset_type,
        assetCode: b.asset_type === 'native' ? 'XLM' : b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
        isNative: b.asset_type === 'native',
      }));

      // Calculate available balance
      const nativeBalance = balances.find(b => b.isNative);
      const totalXlm = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
      const subentryCount = account.subentry_count || 0;
      const minBalance = (2 + subentryCount * 0.5).toFixed(7);
      const availableBalance = Math.max(0, totalXlm - parseFloat(minBalance)).toFixed(7);

      return {
        success: true,
        balances,
        availableBalance,
        minBalance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get USDC balance for an account
   */
  async getUSDCBalance(accountId: string): Promise<{
    success: boolean;
    balance?: string;
    hasTrustline?: boolean;
    issuer?: string;
    error?: string;
  }> {
    if (!this.usdcIssuer) {
      return {
        success: false,
        error: 'USDC issuer not configured. Set STELLAR_USDC_ISSUER environment variable.',
      };
    }

    try {
      const account = await this.server.loadAccount(accountId);
      
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
        issuer: this.usdcIssuer,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get USDC asset object for transaction building
   */
  getUSDAsset(): Asset | null {
    if (!this.usdcIssuer) {
      return null;
    }
    return new Asset('USDC', this.usdcIssuer);
  }

  /**
   * Get the Horizon server instance for advanced operations
   */
  getServer(): Horizon.Server {
    return this.server;
  }

  /**
   * Get network passphrase for transaction building
   */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Fetch recent transactions for an account
   */
  async getRecentTransactions(accountId: string, limit: number = 10): Promise<{
    success: boolean;
    transactions?: any[];
    error?: string;
  }> {
    try {
      const transactions = await this.server.transactions()
        .forAccount(accountId)
        .order('desc')
        .limit(limit)
        .call();

      return {
        success: true,
        transactions: transactions.records.map(tx => ({
          hash: tx.hash,
          ledger: tx.ledger_attr,
          createdAt: tx.created_at,
          sourceAccount: tx.source_account,
          operationCount: tx.operation_count,
          feePaid: tx.fee_paid,
          successful: tx.successful,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get latest ledger info
   */
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
    try {
      const ledgers = await this.server.ledgers()
        .order('desc')
        .limit(1)
        .call();

      if (ledgers.records.length === 0) {
        return { success: false, error: 'No ledgers found' };
      }

      const ledger = ledgers.records[0];
      return {
        success: true,
        ledger: {
          sequence: ledger.sequence,
          hash: ledger.hash,
          closeTime: new Date(ledger.closed_at),
          transactionCount: ledger.successful_transaction_count || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check account existence
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      await this.server.loadAccount(accountId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Health check for the Stellar service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    horizonConnected: boolean;
    usdcConfigured: boolean;
    latestLedger?: number;
    error?: string;
  }> {
    try {
      const ledger = await this.getLatestLedger();
      
      return {
        status: 'healthy',
        horizonConnected: true,
        usdcConfigured: !!this.usdcIssuer,
        latestLedger: ledger.ledger?.sequence,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        horizonConnected: false,
        usdcConfigured: !!this.usdcIssuer,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

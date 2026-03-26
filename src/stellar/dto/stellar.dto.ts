export class StellarAccountBalanceDto {
  /** Asset type (native, credit_alphanum4, credit_alphanum12) */
  assetType: string;
  
  /** Asset code (XLM for native, otherwise the asset code) */
  assetCode: string;
  
  /** Issuer account ID (for non-native assets) */
  issuer?: string;
  
  /** Balance amount */
  balance: string;
  
  /** Whether this is the native XLM asset */
  isNative: boolean;
}

export class StellarAccountDto {
  /** Account ID (public key) */
  accountId: string;
  
  /** Account sequence number */
  sequence: string;
  
  /** Account balances */
  balances: StellarAccountBalanceDto[];
  
  /** Number of subentries (affects minimum balance) */
  subentryCount: number;
  
  /** Available balance (total - reserved) */
  availableBalance: string;
  
  /** Minimum balance required */
  minBalance: string;
}

export class USDCBalanceDto {
  /** Account ID */
  accountId: string;
  
  /** USDC balance */
  balance: string;
  
  /** USDC issuer */
  issuer: string;
  
  /** Whether the account has a USDC trustline */
  hasTrustline: boolean;
}

export class StellarConfigDto {
  /** Horizon URL */
  horizonUrl: string;
  
  /** Network passphrase */
  networkPassphrase: string;
  
  /** USDC issuer */
  usdcIssuer: string | null;
  
  /** Whether USDC is configured */
  usdcConfigured: boolean;
}

export class StellarTransactionDto {
  /** Transaction hash */
  hash: string;
  
  /** Ledger number */
  ledger: number;
  
  /** Creation time */
  createdAt: Date;
  
  /** Source account */
  sourceAccount: string;
  
  /** Operation count */
  operationCount: number;
  
  /** Fee paid */
  feePaid: string;
  
  /** Whether successful */
  successful: boolean;
}

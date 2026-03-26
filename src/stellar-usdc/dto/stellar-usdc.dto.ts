export class USDCBalanceResponseDto {
  /** Stellar public key */
  publicKey: string;
  
  /** USDC balance (as string for precision) */
  balance: string;
  
  /** USDC issuer account ID */
  issuer: string;
  
  /** Whether the account has a USDC trustline */
  hasTrustline: boolean;
  
  /** Account exists on the network */
  accountExists: boolean;
  
  /** Timestamp of the query */
  queriedAt: Date;
}

export class USDCBalanceErrorDto {
  /** Error message */
  error: string;
  
  /** Error code */
  code: string;
  
  /** Invalid public key (if applicable) */
  invalidPublicKey?: boolean;
  
  /** USDC not configured */
  usdcNotConfigured?: boolean;
}

export class USDCConfigDto {
  /** USDC issuer account ID */
  issuer: string;
  
  /** Asset code */
  assetCode: string;
  
  /** Horizon URL */
  horizonUrl: string;
  
  /** Whether USDC is configured */
  isConfigured: boolean;
}

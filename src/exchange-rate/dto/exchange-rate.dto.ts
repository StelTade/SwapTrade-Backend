export class ExchangeRateResponseDto {
  /** Base currency (USD) */
  base: string;
  
  /** Exchange rates for different currencies */
  rates: Record<string, number>;
  
  /** Timestamp of the last update */
  lastUpdated: Date;
  
  /** Source of the exchange rate data */
  source: string;
}

export class ExchangeRateErrorDto {
  /** Error message */
  error: string;
  
  /** Whether fallback data is being used */
  isFallback: boolean;
  
  /** Timestamp of the last successful update */
  lastSuccessfulUpdate?: Date;
}

export class CachedExchangeRate {
  rates: Record<string, number>;
  lastUpdated: Date;
  source: string;
}

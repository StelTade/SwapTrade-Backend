export interface CacheWarmingStrategy {
  name: string;
  description: string;
  warm: () => Promise<void>;
  isEnabled: boolean;
}

export interface CacheWarmingConfig {
  enabled: boolean;
  timeout: number;
  strategies: string[];
}

export interface CacheWarmingMetrics {
  totalKeysWarmed: number;
  warmingDuration: number;
  successCount: number;
  failureCount: number;
  strategyResults: Record<string, {
    success: boolean;
    keysWarmed: number;
    duration: number;
    error?: string;
  }>;
}

export interface CacheHitMissMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  warmedHits: number;
  warmedMisses: number;
  warmedHitRate: number;
}

export interface WarmingStrategyResult {
  strategyName: string;
  success: boolean;
  keysWarmed: number;
  duration: number;
  error?: string;
}
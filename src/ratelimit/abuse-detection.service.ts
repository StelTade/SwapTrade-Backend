import { Injectable, Logger } from '@nestjs/common';
import { RedisPoolService } from '../common/cache/redis-pool.service';
import { ConfigService } from '../config/config.service';
import { MetricsService } from '../common/logging/metrics_service';

interface AbusePattern {
  identifier: string; // user ID or IP
  type: 'rapid_requests' | 'distributed_attack' | 'credential_stuffing' | 'scraping' | 'suspicious_pattern';
  score: number; // 0-100
  detectedAt: Date;
  metadata: Record<string, any>;
}

interface AbuseScore {
  identifier: string;
  totalScore: number;
  patterns: AbusePattern[];
  isBlocked: boolean;
  blockExpiresAt?: Date;
}

@Injectable()
export class AbuseDetectionService {
  private readonly logger = new Logger(AbuseDetectionService.name);
  
  // Thresholds
  private readonly ABUSE_SCORE_THRESHOLD = 70;
  private readonly BLOCK_DURATION_MS = 3600000; // 1 hour
  private readonly PATTERN_WINDOW_MS = 300000; // 5 minutes
  
  // Pattern detection thresholds
  private readonly RAPID_REQUEST_THRESHOLD = 50; // requests per minute
  private readonly FAILED_AUTH_THRESHOLD = 5; // failed attempts
  private readonly ENDPOINT_DIVERSITY_THRESHOLD = 0.8; // scraping indicator
  
  constructor(
    private readonly pool: RedisPoolService,
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Track a request and detect abuse patterns
   */
  async trackRequest(
    identifier: string,
    endpoint: string,
    metadata: { statusCode?: number; userAgent?: string; method?: string } = {},
  ): Promise<AbuseScore> {
    const now = Date.now();
    const key = `abuse:track:${identifier}`;
    
    // Store request data
    await this.pool.withClient(async (client) => {
      const requestData = JSON.stringify({
        endpoint,
        timestamp: now,
        ...metadata,
      });
      
      await client.zadd(key, now, requestData);
      await client.pexpire(key, this.PATTERN_WINDOW_MS * 2);
    });
    
    // Analyze patterns
    const patterns = await this.detectPatterns(identifier);
    const totalScore = this.calculateAbuseScore(patterns);
    const isBlocked = await this.isBlocked(identifier);
    
    // Auto-block if score exceeds threshold
    if (totalScore >= this.ABUSE_SCORE_THRESHOLD && !isBlocked) {
      await this.blockIdentifier(identifier, this.BLOCK_DURATION_MS);
      this.logger.warn(`Auto-blocked identifier ${identifier} with abuse score ${totalScore}`);
      this.metrics.recordError('abuse_detection', 403);
    }
    
    return {
      identifier,
      totalScore,
      patterns,
      isBlocked,
      blockExpiresAt: isBlocked ? await this.getBlockExpiry(identifier) : undefined,
    };
  }

  /**
   * Detect abuse patterns for an identifier
   */
  private async detectPatterns(identifier: string): Promise<AbusePattern[]> {
    const patterns: AbusePattern[] = [];
    const now = Date.now();
    const windowStart = now - this.PATTERN_WINDOW_MS;
    
    const requests = await this.pool.withClient(async (client) => {
      const key = `abuse:track:${identifier}`;
      const data = await client.zrangebyscore(key, windowStart, now);
      return data.map(d => JSON.parse(d));
    });
    
    if (requests.length === 0) return patterns;
    
    // Pattern 1: Rapid requests
    const requestsPerMinute = (requests.length / this.PATTERN_WINDOW_MS) * 60000;
    if (requestsPerMinute > this.RAPID_REQUEST_THRESHOLD) {
      patterns.push({
        identifier,
        type: 'rapid_requests',
        score: Math.min(40, (requestsPerMinute / this.RAPID_REQUEST_THRESHOLD) * 20),
        detectedAt: new Date(),
        metadata: { requestsPerMinute, totalRequests: requests.length },
      });
    }
    
    // Pattern 2: Failed authentication attempts
    const failedAuths = requests.filter(r => 
      r.endpoint.includes('/auth') && r.statusCode === 401
    ).length;
    
    if (failedAuths >= this.FAILED_AUTH_THRESHOLD) {
      patterns.push({
        identifier,
        type: 'credential_stuffing',
        score: Math.min(50, failedAuths * 10),
        detectedAt: new Date(),
        metadata: { failedAttempts: failedAuths },
      });
    }
    
    // Pattern 3: Scraping behavior (high endpoint diversity)
    const uniqueEndpoints = new Set(requests.map(r => r.endpoint)).size;
    const endpointDiversity = uniqueEndpoints / requests.length;
    
    if (endpointDiversity > this.ENDPOINT_DIVERSITY_THRESHOLD && requests.length > 20) {
      patterns.push({
        identifier,
        type: 'scraping',
        score: 30,
        detectedAt: new Date(),
        metadata: { uniqueEndpoints, totalRequests: requests.length, diversity: endpointDiversity },
      });
    }
    
    // Pattern 4: Distributed attack (multiple IPs for same user)
    if (identifier.includes('user:')) {
      const ipCount = await this.countUniqueIPs(identifier);
      if (ipCount > 5) {
        patterns.push({
          identifier,
          type: 'distributed_attack',
          score: Math.min(40, ipCount * 5),
          detectedAt: new Date(),
          metadata: { uniqueIPs: ipCount },
        });
      }
    }
    
    // Pattern 5: Suspicious user agent patterns
    const suspiciousUAs = requests.filter(r => 
      !r.userAgent || r.userAgent.includes('bot') || r.userAgent.length < 10
    ).length;
    
    if (suspiciousUAs > requests.length * 0.5) {
      patterns.push({
        identifier,
        type: 'suspicious_pattern',
        score: 20,
        detectedAt: new Date(),
        metadata: { suspiciousRequests: suspiciousUAs, totalRequests: requests.length },
      });
    }
    
    return patterns;
  }

  /**
   * Calculate total abuse score from patterns
   */
  private calculateAbuseScore(patterns: AbusePattern[]): number {
    if (patterns.length === 0) return 0;
    
    // Use weighted sum with diminishing returns
    const baseScore = patterns.reduce((sum, p) => sum + p.score, 0);
    const multiplier = 1 + (patterns.length - 1) * 0.2; // Multiple patterns increase severity
    
    return Math.min(100, baseScore * multiplier);
  }

  /**
   * Block an identifier for a duration
   */
  async blockIdentifier(identifier: string, durationMs: number): Promise<void> {
    const key = `abuse:block:${identifier}`;
    const expiresAt = Date.now() + durationMs;
    
    await this.pool.withClient(async (client) => {
      await client.set(key, expiresAt.toString());
      await client.pexpire(key, durationMs);
    });
    
    this.logger.warn(`Blocked identifier: ${identifier} until ${new Date(expiresAt).toISOString()}`);
  }

  /**
   * Check if an identifier is blocked
   */
  async isBlocked(identifier: string): Promise<boolean> {
    const key = `abuse:block:${identifier}`;
    
    const result = await this.pool.withClient(async (client) => {
      return await client.get(key);
    });
    
    return result !== null;
  }

  /**
   * Get block expiry time
   */
  private async getBlockExpiry(identifier: string): Promise<Date | undefined> {
    const key = `abuse:block:${identifier}`;
    
    const expiresAt = await this.pool.withClient(async (client) => {
      return await client.get(key);
    });
    
    return expiresAt ? new Date(parseInt(expiresAt)) : undefined;
  }

  /**
   * Manually unblock an identifier
   */
  async unblockIdentifier(identifier: string): Promise<void> {
    const key = `abuse:block:${identifier}`;
    
    await this.pool.withClient(async (client) => {
      await client.del(key);
    });
    
    this.logger.log(`Unblocked identifier: ${identifier}`);
  }

  /**
   * Get abuse score for an identifier
   */
  async getAbuseScore(identifier: string): Promise<AbuseScore> {
    const patterns = await this.detectPatterns(identifier);
    const totalScore = this.calculateAbuseScore(patterns);
    const isBlocked = await this.isBlocked(identifier);
    
    return {
      identifier,
      totalScore,
      patterns,
      isBlocked,
      blockExpiresAt: isBlocked ? await this.getBlockExpiry(identifier) : undefined,
    };
  }

  /**
   * Count unique IPs for a user identifier
   */
  private async countUniqueIPs(userIdentifier: string): Promise<number> {
    const key = `abuse:ips:${userIdentifier}`;
    const now = Date.now();
    const windowStart = now - this.PATTERN_WINDOW_MS;
    
    return this.pool.withClient(async (client) => {
      const count = await client.zcount(key, windowStart, now);
      return count;
    });
  }

  /**
   * Track IP for a user (for distributed attack detection)
   */
  async trackUserIP(userId: string, ip: string): Promise<void> {
    const key = `abuse:ips:user:${userId}`;
    const now = Date.now();
    
    await this.pool.withClient(async (client) => {
      await client.zadd(key, now, ip);
      await client.pexpire(key, this.PATTERN_WINDOW_MS * 2);
    });
  }

  /**
   * Get all blocked identifiers
   */
  async getBlockedIdentifiers(): Promise<Array<{ identifier: string; expiresAt: Date }>> {
    const pattern = 'abuse:block:*';
    
    return this.pool.withClient(async (client) => {
      const keys = await client.keys(pattern);
      const blocked: Array<{ identifier: string; expiresAt: Date }> = [];
      
      for (const key of keys) {
        const expiresAt = await client.get(key);
        if (expiresAt) {
          blocked.push({
            identifier: key.replace('abuse:block:', ''),
            expiresAt: new Date(parseInt(expiresAt)),
          });
        }
      }
      
      return blocked;
    });
  }

  /**
   * Clear all tracking data for an identifier
   */
  async clearTrackingData(identifier: string): Promise<void> {
    const keys = [
      `abuse:track:${identifier}`,
      `abuse:block:${identifier}`,
      `abuse:ips:${identifier}`,
    ];
    
    await this.pool.withClient(async (client) => {
      await client.del(...keys);
    });
    
    this.logger.log(`Cleared tracking data for: ${identifier}`);
  }
}

export { AbusePattern, AbuseScore };

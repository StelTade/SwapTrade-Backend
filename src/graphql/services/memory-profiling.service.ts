import { Injectable, Logger } from '@nestjs/common';

interface MemorySnapshot {
  timestamp: Date;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface MemoryProfile {
  resolverName: string;
  operationType: string;
  startTime: Date;
  endTime: Date;
  startMemory: MemorySnapshot;
  endMemory: MemorySnapshot;
  memoryDelta: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
  peakMemory: MemorySnapshot;
  duration: number;
  userId?: string;
  parameters?: any;
}

@Injectable()
export class MemoryProfilingService {
  private readonly logger = new Logger(MemoryProfilingService.name);
  private profiles: MemoryProfile[] = [];
  private peakMemory: MemorySnapshot | null = null;

  /**
   * Start profiling a GraphQL resolver
   */
  startProfiling(
    resolverName: string,
    operationType: string,
    userId?: string,
    parameters?: any,
  ): () => MemoryProfile {
    const startTime = new Date();
    const startMemory = this.getMemorySnapshot();

    // Track peak memory during operation
    let currentPeak = startMemory;
    const peakCheckInterval = setInterval(() => {
      const current = this.getMemorySnapshot();
      if (current.heapUsed > currentPeak.heapUsed) {
        currentPeak = current;
      }
    }, 10); // Check every 10ms

    return (): MemoryProfile => {
      clearInterval(peakCheckInterval);

      const endTime = new Date();
      const endMemory = this.getMemorySnapshot();

      const profile: MemoryProfile = {
        resolverName,
        operationType,
        startTime,
        endTime,
        startMemory,
        endMemory,
        memoryDelta: {
          rss: endMemory.rss - startMemory.rss,
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          external: endMemory.external - startMemory.external,
          arrayBuffers: endMemory.arrayBuffers - startMemory.arrayBuffers,
        },
        peakMemory: currentPeak,
        duration: endTime.getTime() - startTime.getTime(),
        userId,
        parameters,
      };

      this.addProfile(profile);
      return profile;
    };
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalProfiles: number;
    averageMemoryDelta: number;
    peakMemoryUsage: number;
    memoryIntensiveOperations: MemoryProfile[];
    recommendations: string[];
  } {
    if (this.profiles.length === 0) {
      return {
        totalProfiles: 0,
        averageMemoryDelta: 0,
        peakMemoryUsage: 0,
        memoryIntensiveOperations: [],
        recommendations: [],
      };
    }

    const totalMemoryDelta = this.profiles.reduce(
      (sum, profile) => sum + profile.memoryDelta.heapUsed,
      0,
    );

    const averageMemoryDelta = totalMemoryDelta / this.profiles.length;

    const peakMemoryUsage = Math.max(
      ...this.profiles.map((profile) => profile.peakMemory.heapUsed),
    );

    // Find memory intensive operations (>10MB delta)
    const memoryIntensiveOperations = this.profiles
      .filter((profile) => profile.memoryDelta.heapUsed > 10 * 1024 * 1024)
      .sort((a, b) => b.memoryDelta.heapUsed - a.memoryDelta.heapUsed)
      .slice(0, 10);

    const recommendations = this.generateRecommendations();

    return {
      totalProfiles: this.profiles.length,
      averageMemoryDelta,
      peakMemoryUsage,
      memoryIntensiveOperations,
      recommendations,
    };
  }

  /**
   * Clear profile history
   */
  clearProfiles(): void {
    this.profiles = [];
    this.peakMemory = null;
    this.logger.log('Memory profiling history cleared');
  }

  /**
   * Get profiles by resolver
   */
  getProfilesByResolver(resolverName: string): MemoryProfile[] {
    return this.profiles.filter(
      (profile) => profile.resolverName === resolverName,
    );
  }

  /**
   * Get profiles by user
   */
  getProfilesByUser(userId: string): MemoryProfile[] {
    return this.profiles.filter((profile) => profile.userId === userId);
  }

  private addProfile(profile: MemoryProfile): void {
    this.profiles.push(profile);

    // Keep only last 1000 profiles to prevent memory leaks
    if (this.profiles.length > 1000) {
      this.profiles = this.profiles.slice(-1000);
    }

    // Log if memory usage is concerning
    const memoryDeltaMB = profile.memoryDelta.heapUsed / 1024 / 1024;
    if (memoryDeltaMB > 50) {
      this.logger.warn(
        `High memory usage detected in ${profile.resolverName}.${profile.operationType}: ${memoryDeltaMB.toFixed(2)}MB`,
        {
          resolverName: profile.resolverName,
          operationType: profile.operationType,
          memoryDeltaMB,
          duration: profile.duration,
          userId: profile.userId,
        },
      );
    } else if (memoryDeltaMB > 10) {
      this.logger.log(
        `Memory usage in ${profile.resolverName}.${profile.operationType}: ${memoryDeltaMB.toFixed(2)}MB`,
        {
          resolverName: profile.resolverName,
          operationType: profile.operationType,
          memoryDeltaMB,
          duration: profile.duration,
        },
      );
    }
  }

  private getMemorySnapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    return {
      timestamp: new Date(),
      rss: usage.rss,
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers || 0,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze patterns in memory usage
    const resolverStats = new Map<
      string,
      {
        count: number;
        totalDelta: number;
        maxDelta: number;
      }
    >();

    this.profiles.forEach((profile) => {
      const key = profile.resolverName;
      const existing = resolverStats.get(key) || {
        count: 0,
        totalDelta: 0,
        maxDelta: 0,
      };

      resolverStats.set(key, {
        count: existing.count + 1,
        totalDelta: existing.totalDelta + profile.memoryDelta.heapUsed,
        maxDelta: Math.max(existing.maxDelta, profile.memoryDelta.heapUsed),
      });
    });

    // Generate recommendations based on patterns
    for (const [resolver, stats] of resolverStats.entries()) {
      const avgDeltaMB = stats.totalDelta / stats.count / 1024 / 1024;
      const maxDeltaMB = stats.maxDelta / 1024 / 1024;

      if (avgDeltaMB > 20) {
        recommendations.push(
          `${resolver}: Consider implementing pagination or result streaming (avg: ${avgDeltaMB.toFixed(1)}MB)`,
        );
      }

      if (maxDeltaMB > 100) {
        recommendations.push(
          `${resolver}: Implement memory optimization for large datasets (peak: ${maxDeltaMB.toFixed(1)}MB)`,
        );
      }
    }

    // Check for memory leaks
    const recentProfiles = this.profiles.slice(-50);
    const recentAvgDelta =
      recentProfiles.reduce(
        (sum, profile) => sum + profile.memoryDelta.heapUsed,
        0,
      ) / recentProfiles.length;

    const overallAvgDelta =
      this.profiles.reduce(
        (sum, profile) => sum + profile.memoryDelta.heapUsed,
        0,
      ) / this.profiles.length;

    if (recentAvgDelta > overallAvgDelta * 1.5) {
      recommendations.push(
        'Possible memory leak detected - recent operations using more memory than average',
      );
    }

    return recommendations;
  }
}

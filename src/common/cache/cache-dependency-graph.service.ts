import { Injectable, Logger } from '@nestjs/common';

export interface CacheDependency {
  pattern: string;
  cascades: string[];
}

/**
 * Manages a dependency graph for cache keys.
 * When a key is invalidated, all dependent keys are also invalidated.
 */
@Injectable()
export class CacheDependencyGraphService {
  private readonly logger = new Logger(CacheDependencyGraphService.name);

  /**
   * Dependency graph: key pattern → dependent patterns to also invalidate
   */
  private readonly dependencyGraph = new Map<string, Set<string>>([
    ['user:balance:*', new Set(['user:portfolio:*', 'user:balances:list:*'])],
    ['user:balances:list:*', new Set(['user:portfolio:*'])],
    ['market:data:*', new Set(['user:portfolio:*', 'trading:orderbook:*'])],
    ['trading:order:*', new Set(['user:portfolio:*', 'user:balance:*'])],
  ]);

  /**
   * Register a new dependency: when `from` is invalidated, also invalidate `to`
   */
  registerDependency(from: string, to: string): void {
    if (!this.dependencyGraph.has(from)) {
      this.dependencyGraph.set(from, new Set());
    }
    this.dependencyGraph.get(from)!.add(to);
    this.logger.debug(`Registered dependency: ${from} → ${to}`);
  }

  /**
   * Get all patterns that should be invalidated when `pattern` changes,
   * including transitive dependencies.
   */
  getInvalidationPatterns(pattern: string): string[] {
    const result = new Set<string>([pattern]);
    const queue = [pattern];

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check exact match and wildcard matches
      for (const [key, deps] of this.dependencyGraph) {
        if (this.patternMatches(current, key) || this.patternMatches(key, current)) {
          for (const dep of deps) {
            if (!result.has(dep)) {
              result.add(dep);
              queue.push(dep);
            }
          }
        }
      }
    }

    return Array.from(result);
  }

  /**
   * Simple wildcard pattern matching (supports * glob)
   */
  patternMatches(value: string, pattern: string): boolean {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(`^${regexStr}$`).test(value);
  }
}
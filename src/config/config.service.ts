// src/config/config.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import {
  Configuration,
  AppConfig,
  DatabaseConfig,
  RedisConfig,
  CacheConfig,
  QueueConfig,
  AuthConfig,
  RateLimitConfig,
  LoggingConfig,
  CorsConfig,
  SwaggerConfig,
  FeatureFlags,
  Environment,
} from './configuration';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private config: Configuration;
  private envFilePath: string;
  private hotReloadEnabled: boolean = false;
  private watcher: fs.FSWatcher | null = null;

  constructor(
    private readonly nestConfigService: NestConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.loadConfiguration();
    this.setupHotReload();
  }

  private async loadConfiguration(): Promise<void> {
    const configObject = {
      app: {
        nodeEnv: this.nestConfigService.get<Environment>('NODE_ENV', Environment.DEVELOPMENT),
        port: this.nestConfigService.get<number>('PORT', 3000),
        host: this.nestConfigService.get<string>('HOST', 'localhost'),
        enableShutdownHooks: this.nestConfigService.get<boolean>('ENABLE_SHUTDOWN_HOOKS', true),
        shutdownTimeout: this.nestConfigService.get<number>('SHUTDOWN_TIMEOUT', 30000),
        cors: {
          origin: this.nestConfigService.get<string>('CORS_ORIGIN', '*'),
          credentials: this.nestConfigService.get<boolean>('CORS_CREDENTIALS', true),
          methods: this.nestConfigService.get<string>('CORS_METHODS', 'GET,POST,PUT,DELETE,PATCH').split(','),
          allowedHeaders: this.nestConfigService.get<string>('CORS_ALLOWED_HEADERS', 'Content-Type,Authorization').split(','),
        },
        swagger: {
          title: this.nestConfigService.get<string>('SWAGGER_TITLE', 'SwapTrade API'),
          description: this.nestConfigService.get<string>('SWAGGER_DESCRIPTION', 'API documentation for the SwapTrade application'),
          version: this.nestConfigService.get<string>('SWAGGER_VERSION', '1.0'),
          path: this.nestConfigService.get<string>('SWAGGER_PATH', 'api'),
          enabled: this.nestConfigService.get<boolean>('SWAGGER_ENABLED', true),
        },
        logging: {
          level: this.nestConfigService.get<string>('LOG_LEVEL', 'info'),
          enableConsole: this.nestConfigService.get<boolean>('LOG_ENABLE_CONSOLE', true),
          enableFile: this.nestConfigService.get<boolean>('LOG_ENABLE_FILE', true),
          logDir: this.nestConfigService.get<string>('LOG_DIR', 'logs'),
          maxFiles: this.nestConfigService.get<number>('LOG_MAX_FILES', 30),
          format: this.nestConfigService.get<string>('LOG_FORMAT', 'json'),
        },
      },
      database: {
        type: this.nestConfigService.get<string>('DB_TYPE', 'sqlite'),
        host: this.nestConfigService.get<string>('DB_HOST'),
        port: this.nestConfigService.get<number>('DB_PORT'),
        username: this.nestConfigService.get<string>('DB_USERNAME'),
        password: this.nestConfigService.get<string>('DB_PASSWORD'),
        database: this.nestConfigService.get<string>('DB_NAME', 'swaptrade.db'),
        synchronize: this.nestConfigService.get<boolean>('DB_SYNCHRONIZE', false),
        logging: this.nestConfigService.get<boolean>('DB_LOGGING', true),
        autoLoadEntities: this.nestConfigService.get<boolean>('DB_AUTO_LOAD_ENTITIES', true),
        migrations: ['src/database/migrations/*.ts'],
        migrationsTableName: 'migrations',
      },
      redis: {
        host: this.nestConfigService.get<string>('REDIS_HOST', 'localhost'),
        port: this.nestConfigService.get<number>('REDIS_PORT', 6379),
        username: this.nestConfigService.get<string>('REDIS_USERNAME'),
        password: this.nestConfigService.get<string>('REDIS_PASSWORD'),
        db: this.nestConfigService.get<number>('REDIS_DB', 0),
        retryDelayOnFailover: this.nestConfigService.get<number>('REDIS_RETRY_DELAY_ON_FAILOVER', 100),
        enableReadyCheck: this.nestConfigService.get<boolean>('REDIS_ENABLE_READY_CHECK', false),
        maxRetriesPerRequest: this.nestConfigService.get<number>('REDIS_MAX_RETRIES_PER_REQUEST', 3),
        poolMin: this.nestConfigService.get<number>('REDIS_POOL_MIN', 2),
        poolMax: this.nestConfigService.get<number>('REDIS_POOL_MAX', 10),
        backoffBaseMs: this.nestConfigService.get<number>('REDIS_BACKOFF_BASE_MS', 100),
        backoffMaxMs: this.nestConfigService.get<number>('REDIS_BACKOFF_MAX_MS', 30000),
        backoffMaxAttempts: this.nestConfigService.get<number>('REDIS_BACKOFF_MAX_ATTEMPTS', 10),
        circuitBreakerThreshold: this.nestConfigService.get<number>('REDIS_CIRCUIT_BREAKER_THRESHOLD', 5),
        circuitBreakerResetMs: this.nestConfigService.get<number>('REDIS_CIRCUIT_BREAKER_RESET_MS', 60000),
      },
      cache: {
        enabled: this.nestConfigService.get<boolean>('CACHE_ENABLED', true),
        ttl: this.nestConfigService.get<number>('CACHE_TTL', 300),
        maxItems: this.nestConfigService.get<number>('CACHE_MAX_ITEMS', 1000),
        ttlConfig: {
          userBalances: this.nestConfigService.get<number>('CACHE_TTL_USER_BALANCES', 30),
          marketPrices: this.nestConfigService.get<number>('CACHE_TTL_MARKET_PRICES', 300),
          portfolio: this.nestConfigService.get<number>('CACHE_TTL_PORTFOLIO', 60),
          tradingData: this.nestConfigService.get<number>('CACHE_TTL_TRADING_DATA', 10),
          userProfile: this.nestConfigService.get<number>('CACHE_TTL_USER_PROFILE', 600),
        },
        warming: {
          enabled: this.nestConfigService.get<boolean>('CACHE_WARMING_ENABLED', true),
          timeout: this.nestConfigService.get<number>('CACHE_WARMING_TIMEOUT', 30000),
          strategies: this.nestConfigService.get<string>('CACHE_WARMING_STRATEGIES', 'user_balances,market_data,portfolio').split(','),
        },
        redis: {
          host: this.nestConfigService.get<string>('REDIS_HOST', 'localhost'),
          port: this.nestConfigService.get<number>('REDIS_PORT', 6379),
          username: this.nestConfigService.get<string>('REDIS_USERNAME'),
          password: this.nestConfigService.get<string>('REDIS_PASSWORD'),
          db: this.nestConfigService.get<number>('REDIS_DB', 0),
          retryDelayOnFailover: this.nestConfigService.get<number>('REDIS_RETRY_DELAY_ON_FAILOVER', 100),
          enableReadyCheck: this.nestConfigService.get<boolean>('REDIS_ENABLE_READY_CHECK', false),
          maxRetriesPerRequest: this.nestConfigService.get<number>('REDIS_MAX_RETRIES_PER_REQUEST', 3),
          poolMin: this.nestConfigService.get<number>('REDIS_POOL_MIN', 2),
          poolMax: this.nestConfigService.get<number>('REDIS_POOL_MAX', 10),
          backoffBaseMs: this.nestConfigService.get<number>('REDIS_BACKOFF_BASE_MS', 100),
          backoffMaxMs: this.nestConfigService.get<number>('REDIS_BACKOFF_MAX_MS', 30000),
          backoffMaxAttempts: this.nestConfigService.get<number>('REDIS_BACKOFF_MAX_ATTEMPTS', 10),
          circuitBreakerThreshold: this.nestConfigService.get<number>('REDIS_CIRCUIT_BREAKER_THRESHOLD', 5),
          circuitBreakerResetMs: this.nestConfigService.get<number>('REDIS_CIRCUIT_BREAKER_RESET_MS', 60000),
        },
      },
      queue: {
        redis: {
          host: this.nestConfigService.get<string>('REDIS_HOST', 'localhost'),
          port: this.nestConfigService.get<number>('REDIS_PORT', 6379),
          username: this.nestConfigService.get<string>('REDIS_USERNAME'),
          password: this.nestConfigService.get<string>('REDIS_PASSWORD'),
          db: this.nestConfigService.get<number>('REDIS_DB', 0),
          retryDelayOnFailover: this.nestConfigService.get<number>('REDIS_RETRY_DELAY_ON_FAILOVER', 100),
          enableReadyCheck: this.nestConfigService.get<boolean>('REDIS_ENABLE_READY_CHECK', false),
          maxRetriesPerRequest: this.nestConfigService.get<number>('REDIS_MAX_RETRIES_PER_REQUEST', 3),
        },
        concurrency: this.nestConfigService.get<number>('QUEUE_CONCURRENCY', 5),
        maxStalledCount: this.nestConfigService.get<number>('QUEUE_MAX_STALLED_COUNT', 10),
        stalledInterval: this.nestConfigService.get<number>('QUEUE_STALLED_INTERVAL', 30000),
        removeOnComplete: this.nestConfigService.get<boolean>('QUEUE_REMOVE_ON_COMPLETE', true),
        removeOnFail: this.nestConfigService.get<boolean>('QUEUE_REMOVE_ON_FAIL', false),
      },
      auth: {
        jwtSecret: this.nestConfigService.get<string>('JWT_SECRET'),
        jwtExpiresIn: this.nestConfigService.get<number>('JWT_EXPIRES_IN', 3600),
        jwtRefreshSecret: this.nestConfigService.get<string>('JWT_REFRESH_SECRET'),
        jwtRefreshExpiresIn: this.nestConfigService.get<number>('JWT_REFRESH_EXPIRES_IN', 604800),
        bcryptRounds: this.nestConfigService.get<number>('BCRYPT_ROUNDS', 12),
        maxLoginAttempts: this.nestConfigService.get<number>('AUTH_MAX_LOGIN_ATTEMPTS', 5),
        lockoutDuration: this.nestConfigService.get<number>('AUTH_LOCKOUT_DURATION', 900000),
      },
      rateLimit: {
        windowMs: this.nestConfigService.get<number>('RATE_LIMIT_WINDOW_MS', 900000),
        maxRequests: this.nestConfigService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
        skipSuccessfulRequests: this.nestConfigService.get<boolean>('RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS', false),
        skipFailedRequests: this.nestConfigService.get<boolean>('RATE_LIMIT_SKIP_FAILED_REQUESTS', false),
        keyGenerator: this.nestConfigService.get<string>('RATE_LIMIT_KEY_GENERATOR', 'req.ip'),
        standardHeaders: this.nestConfigService.get<boolean>('RATE_LIMIT_STANDARD_HEADERS', true),
        message: this.nestConfigService.get<string>('RATE_LIMIT_MESSAGE', 'Too many requests from this IP, please try again later.'),
      },
      features: {
        enableAdvancedCaching: this.nestConfigService.get<boolean>('FEATURE_ADVANCED_CACHING', true),
        enableQueueMonitoring: this.nestConfigService.get<boolean>('FEATURE_QUEUE_MONITORING', true),
        enableRateLimiting: this.nestConfigService.get<boolean>('FEATURE_RATE_LIMITING', true),
        enableAuditLogging: this.nestConfigService.get<boolean>('FEATURE_AUDIT_LOGGING', true),
        enableHotReload: this.nestConfigService.get<boolean>('FEATURE_HOT_RELOAD', false),
        enableABTesting: this.nestConfigService.get<boolean>('FEATURE_AB_TESTING', false),
        enablePerformanceMonitoring: this.nestConfigService.get<boolean>('FEATURE_PERFORMANCE_MONITORING', true),
        enableErrorTracking: this.nestConfigService.get<boolean>('FEATURE_ERROR_TRACKING', true),
      },
      vaultUrl: this.nestConfigService.get<string>('VAULT_URL'),
      vaultToken: this.nestConfigService.get<string>('VAULT_TOKEN'),
      useVault: this.nestConfigService.get<boolean>('USE_VAULT', false),
    };

    this.config = plainToClass(Configuration, configObject);

    // Validate configuration
    const errors = await validate(this.config);
    if (errors.length > 0) {
      const errorMessages = errors.map(err => {
        return `${err.property}: ${Object.values(err.constraints || {}).join(', ')}`;
      });
      throw new Error(`Configuration validation failed: ${errorMessages.join('; ')}`);
    }

    this.hotReloadEnabled = this.config.features?.enableHotReload || false;

    // Audit log configuration load
    if (this.config.features?.enableAuditLogging) {
      this.logger.log('Configuration loaded and validated successfully');
      this.eventEmitter.emit('config.loaded', { config: this.getSanitizedConfig() });
    }
  }

  private setupHotReload(): void {
    if (!this.hotReloadEnabled) return;

    this.envFilePath = this.nestConfigService.get<string>('ENV_FILE_PATH', '.env');

    if (fs.existsSync(this.envFilePath)) {
      this.watcher = fs.watch(this.envFilePath, (eventType) => {
        if (eventType === 'change') {
          this.logger.log('Environment file changed, reloading configuration...');
          setTimeout(() => this.reloadConfiguration(), 1000); // Debounce
        }
      });
    }
  }

  private async reloadConfiguration(): Promise<void> {
    try {
      // Clear config cache
      delete require.cache[require.resolve('dotenv')];

      // Reload environment variables
      require('dotenv').config({ path: this.envFilePath });

      // Reload configuration
      await this.loadConfiguration();

      this.logger.log('Configuration reloaded successfully');
      this.eventEmitter.emit('config.reloaded', { config: this.getSanitizedConfig() });
    } catch (error) {
      this.logger.error('Failed to reload configuration:', error);
      this.eventEmitter.emit('config.reloadFailed', { error: error.message });
    }
  }

  private getSanitizedConfig(): Partial<Configuration> {
    const sanitized = { ...this.config };
    // Remove sensitive data
    if (sanitized.auth) {
      sanitized.auth.jwtSecret = '[REDACTED]';
      sanitized.auth.jwtRefreshSecret = '[REDACTED]';
    }
    if (sanitized.database) {
      sanitized.database.password = '[REDACTED]';
    }
    if (sanitized.redis) {
      sanitized.redis.password = '[REDACTED]';
    }
    if (sanitized.vaultToken) {
      sanitized.vaultToken = '[REDACTED]';
    }
    return sanitized;
  }

  // Type-safe getters
  get app(): AppConfig {
    return this.config.app;
  }

  get database(): DatabaseConfig {
    return this.config.database;
  }

  get redis(): RedisConfig {
    return this.config.redis;
  }

  get cache(): CacheConfig {
    return this.config.cache;
  }

  get queue(): QueueConfig {
    return this.config.queue;
  }

  get auth(): AuthConfig {
    return this.config.auth;
  }

  get rateLimit(): RateLimitConfig | undefined {
    return this.config.rateLimit;
  }

  get features(): FeatureFlags | undefined {
    return this.config.features;
  }

  get vaultUrl(): string | undefined {
    return this.config.vaultUrl;
  }

  get vaultToken(): string | undefined {
    return this.config.vaultToken;
  }

  get useVault(): boolean {
    return this.config.useVault || false;
  }

  // Utility methods
  isProduction(): boolean {
    return this.config.app.nodeEnv === Environment.PRODUCTION;
  }

  isDevelopment(): boolean {
    return this.config.app.nodeEnv === Environment.DEVELOPMENT;
  }

  isStaging(): boolean {
    return this.config.app.nodeEnv === Environment.STAGING;
  }

  getEnv(): Environment {
    return this.config.app.nodeEnv;
  }

  // Feature flag checks
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.config.features?.[feature] || false;
  }

  onConfigReload(callback: (config: Partial<Configuration>) => void): void {
    this.eventEmitter.on('config.reloaded', ({ config }) => callback(config));
  }

  onConfigLoad(callback: (config: Partial<Configuration>) => void): void {
    this.eventEmitter.on('config.loaded', ({ config }) => callback(config));
  }

  onConfigReloadFailed(callback: (error: string) => void): void {
    this.eventEmitter.on('config.reloadFailed', ({ error }) => callback(error));
  }

  // Cleanup
  onModuleDestroy() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
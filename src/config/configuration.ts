// src/config/configuration.ts
import { IsString, IsNumber, IsBoolean, IsOptional, IsEnum, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export class DatabaseConfig {
  @IsString()
  @IsOptional()
  type: string = 'sqlite';

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  database: string = 'swaptrade.db';

  @IsBoolean()
  @IsOptional()
  synchronize?: boolean = false;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  migrations?: string[] = ['src/database/migrations/*.ts'];

  @IsString()
  @IsOptional()
  migrationsTableName?: string = 'migrations';

  @IsBoolean()
  @IsOptional()
  logging?: boolean = true;

  @IsBoolean()
  @IsOptional()
  autoLoadEntities?: boolean = true;
}

export class RedisConfig {
  @IsString()
  host: string = 'localhost';

  @IsNumber()
  @Min(1)
  @Max(65535)
  port: number = 6379;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsNumber()
  @Min(0)
  @Max(15)
  @IsOptional()
  db?: number = 0;

  @IsNumber()
  @Min(0)
  @IsOptional()
  retryDelayOnFailover?: number = 100;

  @IsBoolean()
  @IsOptional()
  enableReadyCheck?: boolean = false;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxRetriesPerRequest?: number = 3;

  /** Connection pool: minimum number of connections to keep open */
  @IsNumber()
  @Min(1)
  @IsOptional()
  poolMin?: number = 2;

  /** Connection pool: maximum number of connections */
  @IsNumber()
  @Min(1)
  @IsOptional()
  poolMax?: number = 10;

  /** Adaptive backoff: base delay in ms for exponential backoff */
  @IsNumber()
  @Min(1)
  @IsOptional()
  backoffBaseMs?: number = 100;

  /** Adaptive backoff: max delay in ms */
  @IsNumber()
  @Min(1)
  @IsOptional()
  backoffMaxMs?: number = 30000;

  /** Adaptive backoff: max number of retry attempts */
  @IsNumber()
  @Min(1)
  @IsOptional()
  backoffMaxAttempts?: number = 10;

  /** Circuit breaker: failures before opening */
  @IsNumber()
  @Min(1)
  @IsOptional()
  circuitBreakerThreshold?: number = 5;

  /** Circuit breaker: ms before half-open */
  @IsNumber()
  @Min(1000)
  @IsOptional()
  circuitBreakerResetMs?: number = 60000;
}

export class CacheTtlConfig {
  @IsNumber()
  @Min(0)
  userBalances: number = 30; // 30 seconds

  @IsNumber()
  @Min(0)
  marketPrices: number = 300; // 5 minutes

  @IsNumber()
  @Min(0)
  portfolio: number = 60; // 1 minute

  @IsNumber()
  @Min(0)
  @IsOptional()
  tradingData?: number = 10; // 10 seconds

  @IsNumber()
  @Min(0)
  @IsOptional()
  userProfile?: number = 600; // 10 minutes
}

export class CacheWarmingConfig {
  @IsBoolean()
  @IsOptional()
  enabled: boolean = true;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  timeout: number = 30000; // 30 seconds

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  strategies: string[] = ['user_balances', 'market_data', 'portfolio'];
}

export class CacheConfig {
  @IsBoolean()
  @IsOptional()
  enabled: boolean = true;

  @IsNumber()
  @Min(0)
  @IsOptional()
  ttl: number = 300; // 5 minutes default

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxItems: number = 1000;

  ttlConfig?: CacheTtlConfig;

  warming?: CacheWarmingConfig;

  @ValidateNested()
  @Type(() => RedisConfig)
  redis: RedisConfig = new RedisConfig();
}

export class QueueConfig {
  @ValidateNested()
  @Type(() => RedisConfig)
  redis: RedisConfig = new RedisConfig();

  @IsNumber()
  @Min(1)
  @IsOptional()
  concurrency?: number = 5;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxStalledCount?: number = 10;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  stalledInterval?: number = 30000;

  @IsBoolean()
  @IsOptional()
  removeOnComplete?: boolean = true;

  @IsBoolean()
  @IsOptional()
  removeOnFail?: boolean = false;
}

export class AuthConfig {
  @IsString()
  jwtSecret: string;

  @IsNumber()
  @Min(1)
  jwtExpiresIn: number = 3600; // 1 hour

  @IsString()
  @IsOptional()
  jwtRefreshSecret?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  jwtRefreshExpiresIn?: number = 604800; // 7 days

  @IsNumber()
  @Min(1)
  @IsOptional()
  bcryptRounds?: number = 12;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxLoginAttempts?: number = 5;

  @IsNumber()
  @Min(1)
  @IsOptional()
  lockoutDuration?: number = 900000; // 15 minutes
}

export class RateLimitConfig {
  @IsNumber()
  @Min(1)
  @IsOptional()
  windowMs?: number = 900000; // 15 minutes

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxRequests?: number = 100;

  @IsNumber()
  @Min(1)
  @IsOptional()
  skipSuccessfulRequests?: boolean = false;

  @IsNumber()
  @Min(1)
  @IsOptional()
  skipFailedRequests?: boolean = false;

  @IsString()
  @IsOptional()
  keyGenerator?: string = 'req.ip';

  @IsBoolean()
  @IsOptional()
  standardHeaders?: boolean = true;

  @IsString()
  @IsOptional()
  message?: string = 'Too many requests from this IP, please try again later.';
}

export class LoggingConfig {
  @IsString()
  @IsOptional()
  level: string = 'info';

  @IsBoolean()
  @IsOptional()
  enableConsole: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableFile: boolean = true;

  @IsString()
  @IsOptional()
  logDir: string = 'logs';

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  maxFiles: number = 30;

  @IsString()
  @IsOptional()
  format: string = 'json';
}

export class CorsConfig {
  @IsString()
  @IsOptional()
  origin?: string = '*';

  @IsBoolean()
  @IsOptional()
  credentials?: boolean = true;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  methods?: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedHeaders?: string[] = ['Content-Type', 'Authorization'];
}

export class SwaggerConfig {
  @IsString()
  @IsOptional()
  title: string = 'SwapTrade API';

  @IsString()
  @IsOptional()
  description: string = 'API documentation for the SwapTrade application';

  @IsString()
  @IsOptional()
  version: string = '1.0';

  @IsString()
  @IsOptional()
  path: string = 'api';

  @IsBoolean()
  @IsOptional()
  enabled: boolean = true;
}

export class FeatureFlags {
  @IsBoolean()
  @IsOptional()
  enableAdvancedCaching: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableQueueMonitoring: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableRateLimiting: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableAuditLogging: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableHotReload: boolean = false;

  @IsBoolean()
  @IsOptional()
  enableABTesting: boolean = false;

  @IsBoolean()
  @IsOptional()
  enablePerformanceMonitoring: boolean = true;

  @IsBoolean()
  @IsOptional()
  enableErrorTracking: boolean = true;
}

export class AppConfig {
  @IsEnum(Environment)
  @IsOptional()
  nodeEnv: Environment = Environment.DEVELOPMENT;

  @IsNumber()
  @Min(1)
  @Max(65535)
  port: number = 3000;

  @IsString()
  @IsOptional()
  host?: string = 'localhost';

  @IsBoolean()
  @IsOptional()
  enableShutdownHooks?: boolean = true;

  @IsNumber()
  @Min(1000)
  @IsOptional()
  shutdownTimeout?: number = 30000;

  @ValidateNested()
  @Type(() => CorsConfig)
  @IsOptional()
  cors?: CorsConfig;

  @ValidateNested()
  @Type(() => SwaggerConfig)
  @IsOptional()
  swagger?: SwaggerConfig;

  @ValidateNested()
  @Type(() => LoggingConfig)
  @IsOptional()
  logging?: LoggingConfig;
}

export class Configuration {
  @ValidateNested()
  @Type(() => AppConfig)
  app: AppConfig = new AppConfig();

  @ValidateNested()
  @Type(() => DatabaseConfig)
  database: DatabaseConfig = new DatabaseConfig();

  @ValidateNested()
  @Type(() => RedisConfig)
  redis: RedisConfig = new RedisConfig();

  @ValidateNested()
  @Type(() => CacheConfig)
  cache: CacheConfig = new CacheConfig();

  @ValidateNested()
  @Type(() => QueueConfig)
  queue: QueueConfig = new QueueConfig();

  @ValidateNested()
  @Type(() => AuthConfig)
  auth: AuthConfig;

  @ValidateNested()
  @Type(() => RateLimitConfig)
  @IsOptional()
  rateLimit?: RateLimitConfig;

  @ValidateNested()
  @Type(() => FeatureFlags)
  @IsOptional()
  features?: FeatureFlags = new FeatureFlags();

  // Vault/secrets configuration
  @IsString()
  @IsOptional()
  vaultUrl?: string;

  @IsString()
  @IsOptional()
  vaultToken?: string;

  @IsBoolean()
  @IsOptional()
  useVault?: boolean = false;
}
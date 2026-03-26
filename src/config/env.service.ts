import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Joi from 'joi';

/**
 * Environment variable validation and documentation
 */

export interface EnvConfig {
  // Application
  NODE_ENV: 'development' | 'test' | 'production' | 'staging';
  PORT: number;
  API_PREFIX: string;

  // Database
  DATABASE_URL: string;
  DATABASE_SSL: boolean;

  // Redis
  REDIS_URL: string;
  REDIS_TLS: boolean;

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRATION: string;

  // Stellar
  STELLAR_HORIZON_URL: string;
  STELLAR_NETWORK_PASSPHRASE: string;
  STELLAR_USDC_ISSUER: string;
  STELLAR_POLLING_ENABLED: boolean;

  // Exchange Rate
  EXCHANGE_RATE_URL: string;

  // Email
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;

  // Rate Limiting
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;

  // CORS
  CORS_ORIGINS: string;

  // Logging
  LOG_LEVEL: string;
}

/**
 * Environment variable schema for validation
 */
export const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production', 'staging')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  // Database
  DATABASE_URL: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().default(false),

  // Redis
  REDIS_URL: Joi.string().required(),
  REDIS_TLS: Joi.boolean().default(false),

  // JWT
  JWT_SECRET: Joi.string().required().min(32),
  JWT_EXPIRATION: Joi.string().default('1d'),

  // Stellar
  STELLAR_HORIZON_URL: Joi.string()
    .uri()
    .default('https://horizon-testnet.stellar.org'),
  STELLAR_NETWORK_PASSPHRASE: Joi.string().default(
    'Test SDF Network ; September 2015'
  ),
  STELLAR_USDC_ISSUER: Joi.string().allow(null, '').optional(),
  STELLAR_POLLING_ENABLED: Joi.boolean().default(false),

  // Exchange Rate
  EXCHANGE_RATE_URL: Joi.string().allow(null, '').optional(),

  // Email
  SMTP_HOST: Joi.string().allow(null, '').optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow(null, '').optional(),
  SMTP_PASS: Joi.string().allow(null, '').optional(),
  EMAIL_FROM: Joi.string().allow(null, '').optional(),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // CORS
  CORS_ORIGINS: Joi.string().default('*'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
});

/**
 * Required environment variables by environment
 */
export const requiredVars: Record<string, string[]> = {
  development: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'],
  test: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'],
  staging: [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ],
  production: [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ],
};

@Injectable()
export class EnvService {
  private readonly logger = new Logger(EnvService.name);
  private readonly config: Partial<EnvConfig>;

  constructor(private readonly configService: ConfigService) {
    this.config = this.validateConfig();
    this.logConfig();
  }

  /**
   * Validate environment variables
   */
  private validateConfig(): Partial<EnvConfig> {
    const envVars = process.env;
    const nodeEnv = envVars.NODE_ENV || 'development';

    // Validate schema
    const { error, value } = envSchema.validate(envVars, {
      allowUnknown: true,
      stripUnknown: false,
    });

    if (error) {
      this.logger.error(`Config validation error: ${error.message}`);
      throw new Error(`Config validation error: ${error.message}`);
    }

    // Check required variables for current environment
    const required = requiredVars[nodeEnv] || [];
    const missing = required.filter((key) => !envVars[key]);

    if (missing.length > 0) {
      this.logger.error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`
      );
    }

    return value;
  }

  /**
   * Log current configuration (without secrets)
   */
  private logConfig(): void {
    const nodeEnv = this.config.NODE_ENV || 'development';
    this.logger.log(`Environment: ${nodeEnv}`);
    this.logger.log(`Port: ${this.config.PORT}`);
    this.logger.log(`API Prefix: ${this.config.API_PREFIX}`);
    this.logger.log(`Stellar Horizon: ${this.config.STELLAR_HORIZON_URL}`);
    this.logger.log(
      `USDC Configured: ${this.config.STELLAR_USDC_ISSUER ? 'Yes' : 'No'}`
    );
  }

  /**
   * Get a config value
   */
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this.config[key];
  }

  /**
   * Get all config (for debugging, masks secrets)
   */
  getAll(): Partial<EnvConfig> {
    return {
      NODE_ENV: this.config.NODE_ENV,
      PORT: this.config.PORT,
      API_PREFIX: this.config.API_PREFIX,
      DATABASE_SSL: this.config.DATABASE_SSL,
      REDIS_TLS: this.config.REDIS_TLS,
      STELLAR_HORIZON_URL: this.config.STELLAR_HORIZON_URL,
      STELLAR_POLLING_ENABLED: this.config.STELLAR_POLLING_ENABLED,
      RATE_LIMIT_TTL: this.config.RATE_LIMIT_TTL,
      RATE_LIMIT_MAX: this.config.RATE_LIMIT_MAX,
      LOG_LEVEL: this.config.LOG_LEVEL,
    };
  }

  /**
   * Check if we're in production
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if we're in development
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if email is configured
   */
  isEmailConfigured(): boolean {
    return !!(this.config.SMTP_HOST && this.config.SMTP_USER);
  }

  /**
   * Check if Stellar is configured
   */
  isStellarConfigured(): boolean {
    return !!this.config.STELLAR_USDC_ISSUER;
  }
}

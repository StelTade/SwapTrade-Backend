// src/config/config.schema.ts
import * as Joi from 'joi';

export const configSchema = Joi.object({
  // App Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  HOST: Joi.string().default('localhost'),

  // Database Configuration
  DB_TYPE: Joi.string().default('sqlite'),
  DB_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().integer().min(1).max(65535).optional(),
  DB_USERNAME: Joi.string().optional(),
  DB_PASSWORD: Joi.string().optional().allow(''),
  DB_NAME: Joi.string().default('swaptrade.db'),
  DB_SYNCHRONIZE: Joi.boolean().default(false),
  DB_LOGGING: Joi.boolean().default(true),
  DB_AUTO_LOAD_ENTITIES: Joi.boolean().default(true),

  // Redis Configuration
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
  REDIS_USERNAME: Joi.string().optional().allow(''),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_RETRY_DELAY_ON_FAILOVER: Joi.number().integer().min(0).default(100),
  REDIS_ENABLE_READY_CHECK: Joi.boolean().default(false),
  REDIS_MAX_RETRIES_PER_REQUEST: Joi.number().integer().min(0).default(3),

  // Cache Configuration
  CACHE_ENABLED: Joi.boolean().default(true),
  CACHE_TTL: Joi.number().integer().min(0).default(300),
  CACHE_MAX_ITEMS: Joi.number().integer().min(0).default(1000),
  CACHE_TTL_USER_BALANCES: Joi.number().integer().min(0).default(30),
  CACHE_TTL_MARKET_PRICES: Joi.number().integer().min(0).default(300),
  CACHE_TTL_PORTFOLIO: Joi.number().integer().min(0).default(60),
  CACHE_TTL_TRADING_DATA: Joi.number().integer().min(0).default(10),
  CACHE_TTL_USER_PROFILE: Joi.number().integer().min(0).default(600),
  CACHE_WARMING_ENABLED: Joi.boolean().default(true),
  CACHE_WARMING_TIMEOUT: Joi.number().integer().min(1000).default(30000),
  CACHE_WARMING_STRATEGIES: Joi.string().default('user_balances,market_data,portfolio'),

  // Queue Configuration
  QUEUE_CONCURRENCY: Joi.number().integer().min(1).default(5),
  QUEUE_MAX_STALLED_COUNT: Joi.number().integer().min(0).default(10),
  QUEUE_STALLED_INTERVAL: Joi.number().integer().min(1000).default(30000),
  QUEUE_REMOVE_ON_COMPLETE: Joi.boolean().default(true),
  QUEUE_REMOVE_ON_FAIL: Joi.boolean().default(false),

  // Auth Configuration
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.number().integer().min(1).default(3600),
  JWT_REFRESH_SECRET: Joi.string().optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.number().integer().min(1).default(604800),
  BCRYPT_ROUNDS: Joi.number().integer().min(1).default(12),
  AUTH_MAX_LOGIN_ATTEMPTS: Joi.number().integer().min(1).default(5),
  AUTH_LOCKOUT_DURATION: Joi.number().integer().min(1).default(900000),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1).default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(100),
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: Joi.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED_REQUESTS: Joi.boolean().default(false),
  RATE_LIMIT_KEY_GENERATOR: Joi.string().default('req.ip'),
  RATE_LIMIT_STANDARD_HEADERS: Joi.boolean().default(true),
  RATE_LIMIT_MESSAGE: Joi.string().default('Too many requests from this IP, please try again later.'),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_ENABLE_CONSOLE: Joi.boolean().default(true),
  LOG_ENABLE_FILE: Joi.boolean().default(true),
  LOG_DIR: Joi.string().default('logs'),
  LOG_MAX_FILES: Joi.number().integer().min(1).max(100).default(30),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),

  // CORS
  CORS_ORIGIN: Joi.string().default('*'),
  CORS_CREDENTIALS: Joi.boolean().default(true),
  CORS_METHODS: Joi.string().default('GET,POST,PUT,DELETE,PATCH'),
  CORS_ALLOWED_HEADERS: Joi.string().default('Content-Type,Authorization'),

  // Swagger
  SWAGGER_TITLE: Joi.string().default('SwapTrade API'),
  SWAGGER_DESCRIPTION: Joi.string().default('API documentation for the SwapTrade application'),
  SWAGGER_VERSION: Joi.string().default('1.0'),
  SWAGGER_PATH: Joi.string().default('api'),
  SWAGGER_ENABLED: Joi.boolean().default(true),

  // Feature Flags
  FEATURE_ADVANCED_CACHING: Joi.boolean().default(true),
  FEATURE_QUEUE_MONITORING: Joi.boolean().default(true),
  FEATURE_RATE_LIMITING: Joi.boolean().default(true),
  FEATURE_AUDIT_LOGGING: Joi.boolean().default(true),
  FEATURE_HOT_RELOAD: Joi.boolean().default(false),
  FEATURE_AB_TESTING: Joi.boolean().default(false),
  FEATURE_PERFORMANCE_MONITORING: Joi.boolean().default(true),
  FEATURE_ERROR_TRACKING: Joi.boolean().default(true),

  // Vault/Secrets
  VAULT_URL: Joi.string().uri().optional(),
  VAULT_TOKEN: Joi.string().optional(),
  USE_VAULT: Joi.boolean().default(false),

  // Shutdown
  ENABLE_SHUTDOWN_HOOKS: Joi.boolean().default(true),
  SHUTDOWN_TIMEOUT: Joi.number().integer().min(1000).default(30000),
});
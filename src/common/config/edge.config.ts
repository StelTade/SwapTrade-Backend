import { registerAs } from '@nestjs/config';

export default registerAs('edge', () => ({
  // CDN Configuration
  cdn: {
    enabled: process.env.CDN_ENABLED === 'true',
    provider: process.env.CDN_PROVIDER || 'cloudflare', // cloudflare, cloudfront, fastly
    apiKey: process.env.CDN_API_KEY,
    zoneId: process.env.CDN_ZONE_ID,
    distributionId: process.env.CDN_DISTRIBUTION_ID,
    baseUrl: process.env.CDN_BASE_URL || 'https://cdn.swaptrade.io',
    cacheControl: {
      static: 'public, max-age=31536000, immutable', // 1 year for static assets
      api: 'public, max-age=60, s-maxage=300', // 1 min browser, 5 min CDN for API
      dynamic: 'private, no-cache, no-store', // No caching for dynamic content
    },
  },

  // Edge Computing Configuration
  edge: {
    enabled: process.env.EDGE_COMPUTING_ENABLED === 'true',
    regions: (process.env.EDGE_REGIONS || 'us-east,eu-west,ap-southeast').split(
      ',',
    ),
    computeUnits: parseInt(process.env.EDGE_COMPUTE_UNITS || '10', 10),
    timeout: parseInt(process.env.EDGE_TIMEOUT || '5000', 10),
    retryAttempts: parseInt(process.env.EDGE_RETRY_ATTEMPTS || '3', 10),
  },

  // Response Optimization
  optimization: {
    compression: {
      enabled: process.env.COMPRESSION_ENABLED !== 'false',
      level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10), // 1KB
      types: [
        'application/json',
        'text/html',
        'text/css',
        'application/javascript',
      ],
    },
    http2: {
      enabled: process.env.HTTP2_ENABLED === 'true',
      push: process.env.HTTP2_PUSH_ENABLED === 'true',
    },
    keepAlive: {
      enabled: process.env.KEEP_ALIVE_ENABLED !== 'false',
      timeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10), // 65 seconds
      maxRequests: parseInt(process.env.KEEP_ALIVE_MAX_REQUESTS || '1000', 10),
    },
  },

  // Edge Caching
  edgeCache: {
    enabled: process.env.EDGE_CACHE_ENABLED === 'true',
    ttl: {
      static: parseInt(process.env.EDGE_CACHE_TTL_STATIC || '86400', 10), // 24 hours
      api: parseInt(process.env.EDGE_CACHE_TTL_API || '300', 10), // 5 minutes
      dynamic: parseInt(process.env.EDGE_CACHE_TTL_DYNAMIC || '0', 10), // No cache
    },
    staleWhileRevalidate: parseInt(
      process.env.EDGE_CACHE_STALE_WHILE_REVALIDATE || '60',
      10,
    ),
    staleIfError: parseInt(
      process.env.EDGE_CACHE_STALE_IF_ERROR || '86400',
      10,
    ), // 24 hours
  },

  // Request Deduplication
  deduplication: {
    enabled: process.env.REQUEST_DEDUPLICATION_ENABLED === 'true',
    windowMs: parseInt(process.env.DEDUPLICATION_WINDOW_MS || '100', 10),
    maxQueueSize: parseInt(
      process.env.DEDUPLICATION_MAX_QUEUE_SIZE || '1000',
      10,
    ),
  },

  // Geographic Distribution
  geographic: {
    enabled: process.env.GEOGRAPHIC_DISTRIBUTION_ENABLED === 'true',
    defaultRegion: process.env.DEFAULT_REGION || 'us-east',
    routingStrategy: process.env.ROUTING_STRATEGY || 'latency', // latency, geo, round-robin
    healthCheck: {
      enabled: process.env.HEALTH_CHECK_ENABLED === 'true',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10), // 30 seconds
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    },
  },

  // Performance Targets
  performance: {
    targetResponseTime: parseInt(process.env.TARGET_RESPONSE_TIME || '100', 10), // 100ms
    maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME || '500', 10), // 500ms
    p95ResponseTime: parseInt(process.env.P95_RESPONSE_TIME || '150', 10), // 150ms
    p99ResponseTime: parseInt(process.env.P99_RESPONSE_TIME || '200', 10), // 200ms
  },

  // Monitoring
  monitoring: {
    enabled: process.env.EDGE_MONITORING_ENABLED !== 'false',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '60000', 10), // 1 minute
    alertThreshold: parseInt(process.env.ALERT_THRESHOLD || '200', 10), // 200ms
  },
}));

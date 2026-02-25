export interface CorrelationContext {
  correlationId: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: CorrelationContext;
  service: string;
  version: string;
  environment: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  duration?: number;
  tags?: string[];
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
  unit?: string;
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export interface BusinessMetrics {
  tradesPerSecond: number;
  totalVolume: number;
  activeUsers: number;
  portfolioValue: number;
  orderBookDepth: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, HealthCheck>;
  timestamp: string;
  duration: number;
}

export interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  output?: string;
  observedValue?: any;
  observedUnit?: string;
  duration?: number;
}

export interface SLODefinition {
  name: string;
  description: string;
  objective: string;
  target: number;
  window: string;
  alerting: {
    burnRateThresholds: number[];
    alertOnBurnRate: boolean;
    alertOnErrorBudget: boolean;
    errorBudgetThreshold: number;
  };
}

export interface AlertRule {
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  duration: string;
  description: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface TraceConfig {
  enabled: boolean;
  samplingRate: number;
  exportInterval: number;
  headers: Record<string, string>;
  serviceName: string;
  serviceVersion: string;
  environment: string;
}

export interface LogConfig {
  level: LogLevel;
  format: 'json' | 'text';
  correlationId: boolean;
  structured: boolean;
  console: boolean;
  file?: {
    enabled: boolean;
    path: string;
    maxSize: string;
    maxFiles: number;
  };
  external?: {
    enabled: boolean;
    provider: 'elasticsearch' | 'cloudwatch' | 'datadog';
    endpoint: string;
    index?: string;
    region?: string;
  };
}

export interface MonitoringConfig {
  logging: LogConfig;
  tracing: TraceConfig;
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
    collectDefaultMetrics: boolean;
  };
  health: {
    enabled: boolean;
    path: string;
    detailed: boolean;
  };
  alerting: {
    enabled: boolean;
    webhookUrl?: string;
    slackWebhook?: string;
    emailRecipients?: string[];
  };
}

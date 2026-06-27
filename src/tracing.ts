/**
 * OpenTelemetry SDK bootstrap — must be imported as the very first statement
 * in main.ts so auto-instrumentation patches Node.js core modules (http,
 * express, TypeORM) before they are loaded by NestJS.
 *
 * Env vars (all optional, see .env.example):
 *   OTEL_ENABLED                    – master switch (default: false)
 *   OTEL_SERVICE_NAME               – service name in traces
 *   OTEL_SERVICE_VERSION            – semver string
 *   OTEL_EXPORTER_TYPE              – otlp | console  (default: otlp)
 *   OTEL_EXPORTER_OTLP_ENDPOINT     – collector endpoint
 *   OTEL_SAMPLING_RATE              – 0.0–1.0  (default: 1.0)
 *   NODE_ENV                        – deployment.environment attribute
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import {
  context,
  trace,
  propagation,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// ---------------------------------------------------------------------------
// Resolve configuration from environment
// ---------------------------------------------------------------------------
const OTEL_ENABLED = process.env.OTEL_ENABLED === 'true';

if (!OTEL_ENABLED) {
  // SDK is disabled — exit early, no-op implementations are used by default

  console.log('[tracing] OpenTelemetry disabled (OTEL_ENABLED != true)');
} else {
  // Enable internal OTel diagnostics in development
  if (process.env.NODE_ENV !== 'production') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'swaptrade-backend';
  const serviceVersion =
    process.env.OTEL_SERVICE_VERSION || process.env.APP_VERSION || '1.0.0';
  const deploymentEnv = process.env.NODE_ENV || 'development';
  const exporterType = process.env.OTEL_EXPORTER_TYPE || 'otlp';
  const samplingRate = parseFloat(process.env.OTEL_SAMPLING_RATE || '1.0');

  // ---------------------------------------------------------------------------
  // Build the span exporter
  // ---------------------------------------------------------------------------
  function buildExporter() {
    if (exporterType === 'console') {
      return new ConsoleSpanExporter();
    }

    // Default: OTLP over HTTP (collector or Jaeger OTLP receiver)
    // We use a dynamic require so that projects that haven't installed
    // @opentelemetry/exporter-trace-otlp-http can still boot in console mode.
    try {
      const {
        OTLPTraceExporter,
      } = require('@opentelemetry/exporter-trace-otlp-http');
      return new OTLPTraceExporter({
        url:
          process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
          'http://localhost:4318/v1/traces',
        headers: {},
      });
    } catch {
      // Package not installed — fall back to console exporter and warn

      console.warn(
        '[tracing] @opentelemetry/exporter-trace-otlp-http not found, ' +
          'falling back to ConsoleSpanExporter. ' +
          'Run: npm install @opentelemetry/exporter-trace-otlp-http',
      );
      return new ConsoleSpanExporter();
    }
  }

  // ---------------------------------------------------------------------------
  // Build auto-instrumentations (http, express, pg, graphql, etc.)
  // ---------------------------------------------------------------------------
  function buildInstrumentations() {
    try {
      const {
        getNodeAutoInstrumentations,
      } = require('@opentelemetry/auto-instrumentations-node');
      return getNodeAutoInstrumentations({
        // Suppress noisy internal spans
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          // Ignore health and metrics endpoints to reduce cardinality
          ignoreIncomingRequestHook: (req: any) => {
            const url: string = req.url || '';
            return (
              url.startsWith('/health') ||
              url.startsWith('/metrics') ||
              url === '/favicon.ico'
            );
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-graphql': {
          enabled: true,
          mergeItems: true,
          depth: 2,
        },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      });
    } catch {
      console.warn(
        '[tracing] @opentelemetry/auto-instrumentations-node not found. ' +
          'Auto-instrumentation disabled. ' +
          'Run: npm install @opentelemetry/auto-instrumentations-node',
      );
      return [];
    }
  }

  const exporter = buildExporter();
  const spanProcessor =
    process.env.NODE_ENV === 'production'
      ? new BatchSpanProcessor(exporter, {
          maxQueueSize: 2048,
          maxExportBatchSize: 512,
          scheduledDelayMillis: 5000,
          exportTimeoutMillis: 30000,
        })
      : new SimpleSpanProcessor(exporter);

  const sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(samplingRate),
  });

  // Use AsyncLocalStorage for reliable async context propagation
  const contextManager = new AsyncLocalStorageContextManager();
  contextManager.enable();
  context.setGlobalContextManager(contextManager);

  // W3C Trace Context + Baggage propagation (standard for distributed tracing)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: deploymentEnv,
    }),
    spanProcessors: [spanProcessor],
    sampler,
    instrumentations: buildInstrumentations(),
  });

  sdk.start();

  console.log(
    `[tracing] OpenTelemetry SDK started — service="${serviceName}" ` +
      `exporter="${exporterType}" sampling=${samplingRate}`,
  );

  // Graceful shutdown: flush spans before the process exits
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('[tracing] SDK shutdown complete'))
      .catch((err) => console.error('[tracing] SDK shutdown error', err));
  });

  // Expose the configured tracer globally so other modules can reference it
  // without re-importing the SDK (avoids double-init issues)
  (global as any).__swaptrade_tracer = trace.getTracer(serviceName);
}

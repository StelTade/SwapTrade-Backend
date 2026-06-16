/**
 * Infrastructure Domain
 *
 * Level 1 of the domain-driven architecture (ADR-001).
 * All infrastructure services: config, database, cache, queue, websocket,
 * graphql, events, logging, monitoring, scheduler, rate-limiter, audit-log.
 *
 * Dependency Rules:
 *  - CAN depend on: shared layer (types, constants), external npm packages
 *  - CANNOT depend on: any business domain module
 */

// Aggregate module
export { InfrastructureModule } from './infrastructure.module';

// Sub-module facades
export { InfrastructureConfigModule } from './config';
export { InfrastructureDatabaseModule } from './database';
export { InfrastructureCacheModule } from './cache';
export { InfrastructureQueueModule } from './queue';
export { InfrastructureWebSocketModule } from './websocket';
export { InfrastructureGraphQLModule } from './graphql';
export { EventsModule } from './events';
export { InfrastructureLoggingModule } from './logging';
export { InfrastructureMonitoringModule } from './monitoring';
export { InfrastructureSchedulerModule } from './scheduler';
export { InfrastructureRateLimiterModule } from './rate-limiter';
export { InfrastructureAuditLogModule } from './audit-log';
export { InfrastructureCommonModule } from './common';

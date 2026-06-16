import { Module } from '@nestjs/common';

// Infrastructure facade modules
import { InfrastructureConfigModule } from './config/config.module';
import { InfrastructureDatabaseModule } from './database/database.module';
import { InfrastructureCacheModule } from './cache/cache.module';
import { InfrastructureQueueModule } from './queue/queue.module';
import { InfrastructureWebSocketModule } from './websocket/websocket.module';
import { InfrastructureGraphQLModule } from './graphql/graphql.module';
import { EventsModule } from './events/events.module';
import { InfrastructureLoggingModule } from './logging/logging.module';
import { InfrastructureMonitoringModule } from './monitoring/monitoring.module';
import { InfrastructureSchedulerModule } from './scheduler/scheduler.module';
import { InfrastructureRateLimiterModule } from './rate-limiter/rate-limiter.module';
import { InfrastructureAuditLogModule } from './audit-log/audit-log.module';
import { InfrastructureCommonModule } from './common/common.module';

/**
 * Infrastructure Domain Aggregate Module
 *
 * This is the top-level module for the Infrastructure domain (ADR-001 Level 1).
 * It aggregates all infrastructure sub-modules into a single import point.
 *
 * Sub-modules:
 *  - Config: Environment variables, configuration schemas, validators
 *  - Database: TypeORM setup, entity management, database services
 *  - Cache: Redis integration, cache-manager, multi-level caching
 *  - Queue: Bull job queue, worker management, horizontal scaling
 *  - WebSocket: Socket.io integration, real-time updates, gateway pattern
 *  - GraphQL: Apollo server, schema composition, resolvers, dataloader
 *  - Events: Centralized event bus for pub/sub communication
 *  - Logging: Centralized logging, structured logs, observability
 *  - Monitoring: Prometheus metrics, Grafana dashboards, health checks
 *  - Scheduler: Job scheduling, cron jobs, distributed scheduling
 *  - Rate Limiter: Rate limiting, DDoS protection, quota management
 *  - Audit Log: Audit trail, compliance logging, security events
 *  - Common: Shared decorators, guards, filters, error handling
 *
 * Dependency Rules (ADR-002, ADR-003):
 *  - CAN import from: shared layer (types, constants, enums), external npm packages
 *  - CANNOT import from: Identity, Accounts, Market, Exchange, or any business domain
 */
@Module({
  imports: [
    InfrastructureConfigModule,
    InfrastructureDatabaseModule,
    InfrastructureCacheModule,
    InfrastructureQueueModule,
    InfrastructureWebSocketModule,
    InfrastructureGraphQLModule,
    EventsModule,
    InfrastructureLoggingModule,
    InfrastructureMonitoringModule,
    InfrastructureSchedulerModule,
    InfrastructureRateLimiterModule,
    InfrastructureAuditLogModule,
    InfrastructureCommonModule,
  ],
  exports: [
    InfrastructureConfigModule,
    InfrastructureDatabaseModule,
    InfrastructureCacheModule,
    InfrastructureQueueModule,
    InfrastructureWebSocketModule,
    InfrastructureGraphQLModule,
    EventsModule,
    InfrastructureLoggingModule,
    InfrastructureMonitoringModule,
    InfrastructureSchedulerModule,
    InfrastructureRateLimiterModule,
    InfrastructureAuditLogModule,
    InfrastructureCommonModule,
  ],
})
export class InfrastructureModule {}

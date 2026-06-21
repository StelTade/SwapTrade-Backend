import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { InstitutionalClient } from './entities/institutional-client.entity';
import { SlaPolicy } from './entities/sla-policy.entity';
import { SlaViolation } from './entities/sla-violation.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { ReconciliationReport } from './entities/reconciliation-report.entity';

// External entities needed
import { Trade } from '../database/entities/trade.entity';
import { Order } from '../orders/entities/order.entity';
import { UserBalance } from '../database/entities/user-balance.entity';

// Services
import { InstitutionalClientService } from './services/institutional-client.service';
import { BulkTradeService } from './services/bulk-trade.service';
import { ReconciliationService } from './services/reconciliation.service';
import { SlaMonitoringService } from './services/sla-monitoring.service';
import { SupportTicketService } from './services/support-ticket.service';

// Controller
import { InstitutionalController } from './controllers/institutional.controller';

// Guard dependencies
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../identity/roles/roles.module';

/**
 * Institutional Portal Module
 *
 * Provides a comprehensive set of features for institutional trading clients:
 *
 * 1. **Client Profile Management** — Register, configure, and manage institutional
 *    client profiles with custom SLA tiers, API quotas, and IP whitelists.
 *
 * 2. **Bulk Trade APIs** — High-throughput batch trading supporting 1000+ trades/sec
 *    with atomic and non-atomic execution modes.
 *
 * 3. **Custom Reporting & Reconciliation** — Daily, weekly, and monthly reconciliation
 *    reports with P&L calculation, balance discrepancy detection, and audit trails.
 *
 * 4. **SLA Monitoring** — Real-time SLA policy evaluation with automatic violation
 *    detection, alert escalation, and compliance tracking.
 *
 * 5. **Dedicated Support System** — Priority-based support tickets with SLA-backed
 *    response and resolution times, account manager assignment, and escalation flows.
 *
 * 6. **Advanced Rate Limits** — Institutional-specific rate limits and quotas
 *    configured at the client level (see ratelimit.config.ts).
 *
 * @module Institutional
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstitutionalClient,
      SlaPolicy,
      SlaViolation,
      SupportTicket,
      ReconciliationReport,
      Trade,
      Order,
      UserBalance,
    ]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    AuthModule,
    RolesModule,
  ],
  controllers: [InstitutionalController],
  providers: [
    InstitutionalClientService,
    BulkTradeService,
    ReconciliationService,
    SlaMonitoringService,
    SupportTicketService,
  ],
  exports: [
    InstitutionalClientService,
    BulkTradeService,
    ReconciliationService,
    SlaMonitoringService,
    SupportTicketService,
  ],
})
export class InstitutionalModule {}

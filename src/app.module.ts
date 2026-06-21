import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  I18nModule,
  AcceptLanguageResolver,
  HeaderResolver,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

// Root
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Phase 1 — Infrastructure Domain
import { InfrastructureModule } from './infrastructure/infrastructure.module';

import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';

// Phase 2 — Identity Domain
import { IdentityModule } from './identity/identity.module';

// Governance Domain
import { GovernanceModule } from './governance/governance.module';

// Error handling (infrastructure-level, used by main.ts)
import { ErrorModule } from './error/error.module';

// ── Identity Domain Entities (Phase 2) ──
import { User } from './user/entities/user.entity';
import { Auth } from './auth/entities/auth.entity';
import { Session } from './auth/entities/session.entity';
import { KycRecord } from './kyc/entities/kyc-records.entity';
import { DidDocument } from './did/entities/did-document.entity';
import { VerifiableCredential } from './did/entities/verifiable-credential.entity';
import { PrivacyProfile } from './privacy/entities/privacy-profile.entity';
import { EncryptedOrder } from './privacy/entities/encrypted-order.entity';
import { PrivacyAuditLog } from './privacy/entities/privacy-audit-log.entity';
import { ComplianceRuleEntity } from './compliance/entities/compliance-rule.entity';
import { ComplianceAlertEntity } from './compliance/entities/compliance-alert.entity';
import { AuditTrailEntity } from './compliance/entities/audit-trail.entity';
import { RegulatoryReportEntity } from './compliance/entities/regulatory-report.entity';
import { GovernanceProposal } from './governance/entities/governance-proposal.entity';
import { GovernanceVote } from './governance/entities/governance-vote.entity';
import { GovernanceDiscussion } from './governance/entities/governance-discussion.entity';
import { VoteDelegation } from './governance/entities/vote-delegation.entity';
import { GovernanceExecution } from './governance/entities/governance-execution.entity';
import { GovernanceConfig } from './governance/entities/governance-config.entity';
import { TokenHolding } from './governance/entities/token-holding.entity';

// Supporting entities (required by Identity & Infrastructure modules)
import { UserBalance } from './database/entities/user-balance.entity';
import { VirtualAsset } from './database/entities/virtual-asset.entity';
import { Trade } from './database/entities/trade.entity';

// Trading Features — Advanced der Types (issue #382)
import { Order } from './orders/entities/order.entity';
import { OrdersModule } from './orders/orders.module';

// Institutional Portal
import { InstitutionalModule } from './institutional/institutional.module';
import { InstitutionalClient } from './institutional/entities/institutional-client.entity';
import { SlaPolicy } from './institutional/entities/sla-policy.entity';
import { SlaViolation } from './institutional/entities/sla-violation.entity';
import { SupportTicket } from './institutional/entities/support-ticket.entity';
import { ReconciliationReport } from './institutional/entities/reconciliation-report.entity';
// Exchange Domain Entities (Phase 3 — DeFi Integration)
import { LiquidityPool } from './exchange/entities/liquidity-pool.entity';
import { PoolPosition } from './exchange/entities/pool-position.entity';
import { PoolSwap } from './exchange/entities/pool-swap.entity';
import { EmergencyWithdrawal } from './exchange/entities/emergency-withdrawal.entity';
import { ExchangeModule } from './exchange/exchange.module';

@Module({
  imports: [
    // ── Core NestJS ──
    ConfigModule.forRoot({ isGlobal: true }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        HeaderResolver,
        AcceptLanguageResolver,
      ],
    }),
    // CacheModule.registerAsync({
    //   isGlobal: true,
    //   imports: [ConfigModule],
    //   useFactory: async (configService: ConfigService) => ({
    //     ttl: 600,
    //     max: 1000,
    //   }),
    //   inject: [ConfigService],
    // }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: configService.get<string>('DB_TYPE', 'postgres') as
          | ''
          | 'sqlite',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'swaptrade'),
        entities: [
          // Identity — Auth
          Auth,
          Session,
          // Identity — User
          User,
          // Identity — KYC
          KycRecord,
          // Identity — DID
          DidDocument,
          VerifiableCredential,
          // Identity — Privacy
          PrivacyProfile,
          EncryptedOrder,
          PrivacyAuditLog,
          // Identity — Compliance
          ComplianceRuleEntity,
          ComplianceAlertEntity,
          AuditTrailEntity,
          RegulatoryReportEntity,
          // Supporting (required by UserModule & DatabaseModule)
          UserBalance,
          VirtualAsset,
          Trade,
          // Trading Features — Advanced Order Types (issue #382)
          Order,
          // Institutional Portal
          InstitutionalClient,
          SlaPolicy,
          SlaViolation,
          SupportTicket,
          ReconciliationReport,
          GovernanceProposal,
          GovernanceVote,
          GovernanceDiscussion,
          VoteDelegation,
          GovernanceExecution,
          GovernanceConfig,
          TokenHolding,
        ],
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true),
        logging: configService.get<boolean>('DB_LOGGING', false),
        autoLoadEntities: configService.get<boolean>(
          'DB_AUTO_LOAD_ENTITIES',
          true,
        ),
      }),
    }),

    // ── Domain Modules ──
    InfrastructureModule,
    IdentityModule,
    GovernanceModule,

    // ── Phase 3: Exchange Domain (DeFi Integration) ──
    ExchangeModule,

    // ── Trading Features — Advanced Order Types (issue #382) ──
    OrdersModule,

    // ── Institutional Portal ──
    InstitutionalModule,

    // ── Error Handling ──
    ErrorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

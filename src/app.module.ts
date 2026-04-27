import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GovernanceModule } from './governance/governance.module';
import { OptionsModule } from './options/options.module';
import { LiquidityMiningModule } from './liquidity-mining/liquidity-mining.module';
import { MobileModule } from './mobile/mobile.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditEntry } from './platform/entities/audit-entry.entity';
import { GovernanceProposal } from './governance/entities/governance-proposal.entity';
import { GovernanceParameter } from './governance/entities/governance-parameter.entity';
import { PendingGovernanceParameterUpdate } from './governance/entities/pending-governance-parameter-update.entity';
import { GovernanceVote } from './governance/entities/governance-vote.entity';
import { GovernanceStake } from './governance/entities/governance-stake.entity';
import { OptionContract } from './options/entities/option-contract.entity';
import { OptionOrder } from './options/entities/option-order.entity';
import { OptionPosition } from './options/entities/option-position.entity';
import { LiquidityPool } from './liquidity-mining/entities/liquidity-pool.entity';
import { LiquidityMiningProgram } from './liquidity-mining/entities/liquidity-mining-program.entity';
import { LiquidityStakePosition } from './liquidity-mining/entities/liquidity-stake-position.entity';
import { LiquidityRewardLedger } from './liquidity-mining/entities/liquidity-reward-ledger.entity';
import { PrivacyProfile } from './privacy/entities/privacy-profile.entity';
import { EncryptedOrder } from './privacy/entities/encrypted-order.entity';
import { PrivacyAuditLog } from './privacy/entities/privacy-audit-log.entity';
import { PlatformModule } from './platform/platform.module';
import { RiskModule } from './risk/risk.module';
import { RiskProfile } from './risk/entities/risk-profile.entity';
import { RiskOrder } from './risk/entities/risk-order.entity';
import { DidModule } from './did/did.module';
import { DidDocument } from './did/entities/did-document.entity';
import { VerifiableCredential } from './did/entities/verifiable-credential.entity';
import { AdvancedAnalyticsModule } from './advanced-analytics/advanced-analytics.module';
import { PricePredictionModule } from './price-prediction/price-prediction.module';
import { User } from './user/entities/user.entity';
import { Trade } from './trading/entities/trade.entity';
import { SocialTradingModule } from './social-trading/social-trading.module';
import { SocialTraderProfile } from './social-trading/entities/social-trader-profile.entity';
import { SharedStrategy } from './social-trading/entities/shared-strategy.entity';
import { TraderFollow } from './social-trading/entities/trader-follow.entity';
import { CopyTradingRelationship } from './social-trading/entities/copy-trading-relationship.entity';
import { CopiedTrade } from './social-trading/entities/copied-trade.entity';
import { StrategyComment } from './social-trading/entities/strategy-comment.entity';
import { StrategyLike } from './social-trading/entities/strategy-like.entity';
import { TraderRevenueShare } from './social-trading/entities/trader-revenue-share.entity';
import { PortfolioAnalyticsModule } from './portfolio-analytics/portfolio-analytics.module';
import { PortfolioSnapshot } from './portfolio-analytics/entities/portfolio-snapshot.entity';
import { RiskMetrics } from './portfolio-analytics/entities/risk-metrics.entity';
import { PerformanceHistory } from './portfolio-analytics/entities/performance-history.entity';
import { Benchmark } from './portfolio-analytics/entities/benchmark.entity';
import { CacheModule } from '@nestjs/cache-manager';
import { ErrorModule } from './error/error.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { MarketSurveillanceModule } from './market-surveillance/market-surveillance.module';
import { DatabaseModule } from './database/database.module';
import { HorizontalScalingModule } from './queue/horizontal-scaling.module';
import { MLPipelineModule } from './ml-pipeline/ml-pipeline.module';

import { 
  AnomalyAlert, 
  OrderBookSnapshot, 
  SuspiciousActor, 
  ViolationEvent, 
  HeatmapMetric, 
  PatternTemplate 
} from './market-surveillance/entities';
import { TrainingJob, ModelVersion, PerformanceMetrics } from './ml-pipeline/entities';
import { UserBalance } from './balance/entities/user-balance.entity';
import { VirtualAsset } from './trading/entities/virtual-asset.entity';
import { KycModule } from './kyc/kyc.module';
import { KycRecord } from './kyc/entities/kyc-records.entity';
import { I18nModule, AcceptLanguageResolver, HeaderResolver, QueryResolver } from 'nestjs-i18n';
import * as path from 'path';

@Module({
  imports: [
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
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        ttl: 600,
        max: 1000,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'swaptrade.db',
      entities: [
        AuditEntry, GovernanceProposal, GovernanceVote, GovernanceStake,
        GovernanceParameter, PendingGovernanceParameterUpdate,
        OptionContract, OptionOrder, OptionPosition,
        LiquidityPool, LiquidityMiningProgram, LiquidityStakePosition, LiquidityRewardLedger,
        User, Trade, RiskOrder, RiskProfile,
        DidDocument, VerifiableCredential,
        PrivacyProfile, EncryptedOrder, PrivacyAuditLog,
        SocialTraderProfile, SharedStrategy, TraderFollow, CopyTradingRelationship, CopiedTrade, StrategyComment, StrategyLike, TraderRevenueShare,
        PortfolioSnapshot, RiskMetrics, PerformanceHistory, Benchmark,
        AnomalyAlert, OrderBookSnapshot, SuspiciousActor, ViolationEvent, HeatmapMetric, PatternTemplate,
        TrainingJob, ModelVersion, PerformanceMetrics,
        UserBalance, VirtualAsset, KycRecord,
      ],
      synchronize: true,
    }),
    PlatformModule,
    GovernanceModule,
    OptionsModule,
    LiquidityMiningModule,
    MobileModule,
    ScheduleModule.forRoot(),
    RiskModule,
    DidModule,
    AdvancedAnalyticsModule,
    PricePredictionModule,
    PrivacyModule,
    KycModule,
    ErrorModule,
    DatabaseModule,
    // Note: Some modules are now loaded dynamically to optimize startup
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'LAZY_MODULES',
      useFactory: async () => {
        // Simulating code splitting and lazy loading of heavy modules
        const [surveillance, social, portfolio, scaling, ml, kyc] = await Promise.all([
          import('./market-surveillance/market-surveillance.module.js'),
          import('./social-trading/social-trading.module.js'),
          import('./portfolio-analytics/portfolio-analytics.module.js'),
          import('./queue/horizontal-scaling.module.js'),
          import('./ml-pipeline/ml-pipeline.module.js'),
          import('./kyc/kyc.module.js'),
        ]);
        return {
          MarketSurveillanceModule: surveillance.MarketSurveillanceModule,
          SocialTradingModule: social.SocialTradingModule,
          PortfolioAnalyticsModule: portfolio.PortfolioAnalyticsModule,
          HorizontalScalingModule: scaling.HorizontalScalingModule,
          MLPipelineModule: ml.MLPipelineModule,
          KycModule: kyc.KycModule,
        };
      },
    },
  ],
})
export class AppModule {}

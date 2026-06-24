import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InsuranceFundService } from './services/insurance-fund.service';
import { FundHealthService } from './services/fund-health.service';
import { LiquidationProtectionService } from './services/liquidation-protection.service';
import { InsuranceFeeContributionService } from './services/insurance-fee-contribution.service';
import { InsuranceFund } from './entities/insurance-fund.entity';
import { InsuranceFundTier } from './entities/insurance-fund-tier.entity';
import { InsuranceTransaction } from './entities/insurance-transaction.entity';
import { LiquidationEvent } from './entities/liquidation-event.entity';
import { FundTier } from './enums/fund-tier.enum';
import { FundHealthStatus } from './enums/fund-health-status.enum';
import { InsuranceTxType } from './enums/insurance-tx-type.enum';

/**
 * Integration test: initialize funds → fee contribution → cover shortfall →
 * health monitoring → replenish → audit trail
 */
describe('Insurance Fund Integration', () => {
  let insuranceFundService: InsuranceFundService;
  let fundHealthService: FundHealthService;
  let liquidationProtection: LiquidationProtectionService;
  let feeContribution: InsuranceFeeContributionService;

  const tiers: Record<string, unknown>[] = [];
  const funds: Record<string, unknown>[] = [];
  const transactions: Record<string, unknown>[] = [];
  const liquidations: Record<string, unknown>[] = [];
  let tierIdCounter = 1;
  let fundIdCounter = 1;

  beforeEach(async () => {
    tiers.length = 0;
    funds.length = 0;
    transactions.length = 0;
    liquidations.length = 0;
    tierIdCounter = 1;
    fundIdCounter = 1;

    const tierRepo = {
      findOne: jest.fn(
        async ({ where }) => tiers.find((t) => t.tier === where.tier) ?? null,
      ),
      find: jest.fn(async () => tiers),
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => {
        const tier = { ...d, id: tierIdCounter++ };
        tiers.push(tier);
        return tier;
      }),
    };

    const fundRepo = {
      findOne: jest.fn(async (opts) => {
        const where = opts?.where ?? {};
        if (where.id) return funds.find((f) => f.id === where.id) ?? null;
        if (where.tierId && where.asset) {
          return (
            funds.find(
              (f) => f.tierId === where.tierId && f.asset === where.asset,
            ) ?? null
          );
        }
        return null;
      }),
      find: jest.fn(async () =>
        funds.map((f) => ({
          ...f,
          tier: tiers.find((t) => t.id === f.tierId),
        })),
      ),
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => {
        const idx = funds.findIndex((f) => f.id === d.id);
        if (idx >= 0) {
          funds[idx] = { ...funds[idx], ...d };
          return funds[idx];
        }
        const fund = { ...d, id: fundIdCounter++ };
        funds.push(fund);
        return fund;
      }),
    };

    const txRepo = {
      find: jest.fn(async () => transactions),
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => {
        const tx = { ...d, id: `tx-${transactions.length + 1}` };
        transactions.push(tx);
        return tx;
      }),
    };

    const liquidationRepo = {
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => {
        const ev = { ...d, id: `liq-${liquidations.length + 1}` };
        liquidations.push(ev);
        return ev;
      }),
    };

    const eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceFundService,
        FundHealthService,
        LiquidationProtectionService,
        InsuranceFeeContributionService,
        { provide: getRepositoryToken(InsuranceFund), useValue: fundRepo },
        { provide: getRepositoryToken(InsuranceFundTier), useValue: tierRepo },
        {
          provide: getRepositoryToken(InsuranceTransaction),
          useValue: txRepo,
        },
        {
          provide: getRepositoryToken(LiquidationEvent),
          useValue: liquidationRepo,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    insuranceFundService = module.get(InsuranceFundService);
    fundHealthService = module.get(FundHealthService);
    liquidationProtection = module.get(LiquidationProtectionService);
    feeContribution = module.get(InsuranceFeeContributionService);
  });

  it('should complete full insurance fund lifecycle', async () => {
    const initialized = await insuranceFundService.initializeFunds('USDT');
    expect(initialized.length).toBe(4);

    const feeResult = await feeContribution.contributeFromTradeFee(
      'trade-001',
      1000,
      'USDT',
      FundTier.MEDIUM,
    );
    expect(feeResult.contributed).toBe(100);

    const coverResult = await liquidationProtection.coverShortfall(
      42,
      5000,
      'position-abc',
      'USDT',
      FundTier.MEDIUM,
    );
    expect(coverResult.cascadePrevented).toBe(true);
    expect(coverResult.coveredAmount).toBe(5000);

    const dashboard = await fundHealthService.getDashboard();
    expect(dashboard.funds.length).toBe(4);
    expect(dashboard.overallHealthPercent).toBeGreaterThan(0);

    await insuranceFundService.replenishFund(
      initialized[0].id,
      25000,
      'replenish-001',
      'Manual replenishment',
    );

    const history = await insuranceFundService.getTransactionHistory();
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(
      history.some((t) => t.type === InsuranceTxType.FEE_CONTRIBUTION),
    ).toBe(true);
    expect(history.some((t) => t.type === InsuranceTxType.PAYOUT)).toBe(true);
    expect(history.some((t) => t.type === InsuranceTxType.REPLENISHMENT)).toBe(
      true,
    );
  });

  it('should trigger health alert when reserves drop below 20%', async () => {
    await insuranceFundService.initializeFunds('USDT');
    const mediumFund = await insuranceFundService.getFundsByTier(
      FundTier.MEDIUM,
      'USDT',
    );

    const fund = funds.find((f) => f.id === mediumFund.id)!;
    fund.balance = 10000;
    fund.targetReserve = 100000;
    fund.healthPercent = 50;
    fund.healthStatus = FundHealthStatus.HEALTHY;

    await fundHealthService.updateFundHealth(mediumFund.id);

    const updated = funds.find((f) => f.id === mediumFund.id)!;
    expect(Number(updated.healthPercent)).toBe(10);
    expect(updated.healthStatus).toBe(FundHealthStatus.CRITICAL);

    const alerts = await fundHealthService.getActiveAlerts();
    expect(alerts.some((a) => a.isBelowThreshold)).toBe(true);
  });
});

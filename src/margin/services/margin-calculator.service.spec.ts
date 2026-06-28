import { MarginCalculatorService } from './margin-calculator.service';
import { PositionSide } from '../enums/position-side.enum';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';

describe('MarginCalculatorService', () => {
  let service: MarginCalculatorService;

  beforeEach(() => {
    service = new MarginCalculatorService();
  });

  it('calculates long unrealized PnL', () => {
    const pnl = service.calculateUnrealizedPnl(PositionSide.LONG, 10, 100, 110);
    expect(pnl).toBe(100);
  });

  it('calculates short unrealized PnL', () => {
    const pnl = service.calculateUnrealizedPnl(PositionSide.SHORT, 10, 100, 90);
    expect(pnl).toBe(100);
  });

  it('calculates equity after interest', () => {
    expect(service.calculateEquity(1000, 200, 50)).toBe(1150);
  });

  it('detects liquidation when equity at maintenance threshold', () => {
    expect(service.shouldLiquidate(500, 500)).toBe(true);
    expect(service.shouldLiquidate(501, 500)).toBe(false);
  });

  it('caps leverage based on volatility', () => {
    const config = {
      maxLeverage: 10,
      volatilityPct: 50,
      volatilityLeverageFactor: 2,
    } as MarginPairConfig;

    // 1 / (0.5 * 2) = 1x cap
    expect(service.calculateEffectiveMaxLeverage(config)).toBe(1);
  });

  it('uses configured max leverage when volatility is low', () => {
    const config = {
      maxLeverage: 10,
      volatilityPct: 5,
      volatilityLeverageFactor: 2,
    } as MarginPairConfig;

    expect(service.calculateEffectiveMaxLeverage(config)).toBe(10);
  });

  it('calculates daily interest accurately', () => {
    // 10000 borrowed at 10 bps (0.1%) = 10 per day
    expect(service.calculateDailyInterest(10000, 10)).toBe(10);
  });

  it('computes margin metrics for a long position', () => {
    const metrics = service.computeMetrics(
      PositionSide.LONG,
      10,
      100,
      105,
      1000,
      0,
      0.05,
    );

    expect(metrics.notional).toBe(1050);
    expect(metrics.unrealizedPnl).toBe(50);
    expect(metrics.equity).toBe(1050);
    expect(metrics.maintenanceRequirement).toBe(52.5);
    expect(metrics.marginRatio).toBeCloseTo(20, 5);
  });

  it('calculates liquidation price for long position', () => {
    const liqPrice = service.calculateLiquidationPrice(
      PositionSide.LONG,
      10,
      100,
      500,
      0.05,
    );
    expect(liqPrice).toBeGreaterThan(0);
    expect(liqPrice).toBeLessThan(100);
  });
});

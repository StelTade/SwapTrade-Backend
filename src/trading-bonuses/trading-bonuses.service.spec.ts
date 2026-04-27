import { TradingBonusesService } from './trading-bonuses.service';

describe('TradingBonusesService.computeBonus', () => {
  let service: TradingBonusesService;

  beforeEach(() => {
    // Instantiate with null repos — only testing pure computeBonus
    service = new TradingBonusesService(null as any, null as any);
  });

  it('should return 0% bonus for volume below $1,000', () => {
    expect(service.computeBonus(0)).toEqual({ bonusRate: 0, bonusAmount: 0 });
    expect(service.computeBonus(500)).toEqual({ bonusRate: 0, bonusAmount: 0 });
    expect(service.computeBonus(999.99)).toEqual({ bonusRate: 0, bonusAmount: 0 });
  });

  it('should return 1% bonus for volume between $1,000 and $9,999.99', () => {
    const result = service.computeBonus(1000);
    expect(result.bonusRate).toBe(0.01);
    expect(result.bonusAmount).toBeCloseTo(10, 5);
  });

  it('should return 1% bonus for volume of $5,000', () => {
    const result = service.computeBonus(5000);
    expect(result.bonusRate).toBe(0.01);
    expect(result.bonusAmount).toBeCloseTo(50, 5);
  });

  it('should return 2% bonus for volume between $10,000 and $99,999.99', () => {
    const result = service.computeBonus(10_000);
    expect(result.bonusRate).toBe(0.02);
    expect(result.bonusAmount).toBeCloseTo(200, 5);
  });

  it('should return 2% bonus for volume of $50,000', () => {
    const result = service.computeBonus(50_000);
    expect(result.bonusRate).toBe(0.02);
    expect(result.bonusAmount).toBeCloseTo(1000, 5);
  });

  it('should return 3% bonus for volume >= $100,000', () => {
    const result = service.computeBonus(100_000);
    expect(result.bonusRate).toBe(0.03);
    expect(result.bonusAmount).toBeCloseTo(3000, 5);
  });

  it('should return 3% bonus for volume of $500,000', () => {
    const result = service.computeBonus(500_000);
    expect(result.bonusRate).toBe(0.03);
    expect(result.bonusAmount).toBeCloseTo(15000, 5);
  });

  it('should return exactly $9,999 → 1% tier', () => {
    const result = service.computeBonus(9999);
    expect(result.bonusRate).toBe(0.01);
  });

  it('should handle exactly $99,999 → 2% tier', () => {
    const result = service.computeBonus(99_999);
    expect(result.bonusRate).toBe(0.02);
  });
});

/**
 * Shared Portfolio/Risk Interfaces
 *
 * These interfaces break the circular dependency between portfolio and risk modules.
 * Both modules can import from here without creating cycles.
 *
 * Original types from:
 * - portfolio/dto/portfolio-summary.dto.ts (AssetAllocation)
 * - portfolio/dto/portfolio-risk.dto.ts (StressTestResultDto)
 */

/** Asset allocation within a portfolio */
export interface IAssetAllocation {
  symbol: string;
  name: string;
  value: number;
  quantity: number;
  averagePrice: number;
  allocationPercentage: number;
}

/** Result of a stress test scenario */
export interface IStressTestResult {
  scenarioName: string;
  description: string;
  projectedPnL: number;
  projectedValue: number;
  percentageChange: number;
}

/** Diversification analysis output */
export interface IDiversificationAnalysis {
  isDiversified: boolean;
  score: number;
  recommendations: string[];
}

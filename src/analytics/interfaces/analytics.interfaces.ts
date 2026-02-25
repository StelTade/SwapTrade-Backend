export interface PortfolioAnalytics {
  userId: string;
  totalValue: number;
  totalValueChange24h: number;
  totalValueChange7d: number;
  totalValueChange30d: number;
  riskScore: RiskScore;
  diversification: DiversificationMetrics;
  performance: PerformanceMetrics;
  allocation: AssetAllocation[];
  recommendations: Recommendation[];
  lastUpdated: string;
}

export interface RiskScore {
  overall: number; // 0-100
  volatility: number;
  concentration: number;
  liquidity: number;
  market: number;
  factors: RiskFactor[];
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface DiversificationMetrics {
  score: number; // 0-100
  assetCount: number;
  sectorAllocation: SectorAllocation[];
  geographicAllocation: GeographicAllocation[];
  concentrationRatio: number; // Herfindahl-Hirschman Index
  effectiveAssets: number;
  diversificationBenefit: number;
}

export interface SectorAllocation {
  sector: string;
  percentage: number;
  value: number;
  risk: number;
}

export interface GeographicAllocation {
  region: string;
  percentage: number;
  value: number;
  risk: number;
}

export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  alpha: number;
  beta: number;
  informationRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface AssetAllocation {
  asset: string;
  symbol: string;
  quantity: number;
  value: number;
  percentage: number;
  price: number;
  change24h: number;
  change7d: number;
  change30d: number;
  risk: number;
  expectedReturn: number;
  correlation: number;
}

export interface Recommendation {
  type: 'REBALANCE' | 'DIVERSIFY' | 'RISK_REDUCE' | 'PERFORMANCE_IMPROVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  action: string;
  expectedImpact: string;
  confidence: number; // 0-100
  reasoning: string;
}

export interface HistoricalPerformance {
  period: '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';
  data: PerformanceDataPoint[];
  metrics: PeriodMetrics;
  benchmark: BenchmarkComparison;
}

export interface PerformanceDataPoint {
  date: string;
  value: number;
  return: number;
  cumulativeReturn: number;
  drawdown: number;
  volatility: number;
}

export interface PeriodMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  bestDay: number;
  worstDay: number;
  positiveDays: number;
  negativeDays: number;
  averageDailyReturn: number;
  standardDeviation: number;
}

export interface BenchmarkComparison {
  benchmark: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
  upCapture: number;
  downCapture: number;
}

export interface RiskMetrics {
  valueAtRisk: VaRMetrics;
  expectedShortfall: ESMetrics;
  stressTest: StressTestResults;
  scenarioAnalysis: ScenarioResults;
  correlationMatrix: CorrelationData;
}

export interface VaRMetrics {
  confidence: number;
  timeHorizon: string;
  var1Day: number;
  var5Day: number;
  var10Day: number;
  var30Day: number;
  methodology: 'HISTORICAL' | 'PARAMETRIC' | 'MONTE_CARLO';
}

export interface ESMetrics {
  confidence: number;
  timeHorizon: string;
  es1Day: number;
  es5Day: number;
  es10Day: number;
  es30Day: number;
  methodology: string;
}

export interface StressTestResults {
  scenarios: StressScenario[];
  worstCase: StressScenario;
  recoveryTime: number;
  maxLoss: number;
}

export interface StressScenario {
  name: string;
  description: string;
  probability: number;
  impact: number;
  portfolioValue: number;
  loss: number;
  duration: string;
}

export interface ScenarioResults {
  marketCrash: ScenarioResult;
  interestRateShock: ScenarioResult;
  liquidityCrisis: ScenarioResult;
  sectorRotation: ScenarioResult;
}

export interface ScenarioResult {
  scenario: string;
  portfolioValue: number;
  loss: number;
  lossPercentage: number;
  worstAsset: string;
  worstAssetLoss: number;
}

export interface CorrelationData {
  matrix: CorrelationMatrix;
  eigenvalues: number[];
  principalComponents: PrincipalComponent[];
  systematicRisk: number;
  unsystematicRisk: number;
}

export interface CorrelationMatrix {
  assets: string[];
  correlations: number[][];
}

export interface PrincipalComponent {
  component: number;
  eigenvalue: number;
  explainedVariance: number;
  loadings: AssetLoading[];
}

export interface AssetLoading {
  asset: string;
  loading: number;
}

export interface AnalyticsConfig {
  riskFreeRate: number;
  benchmark: string;
  timeHorizons: string[];
  confidenceLevels: number[];
  rebalancingThreshold: number;
  minimumDiversification: number;
  maxConcentration: number;
}

export interface AnalyticsRequest {
  userId: string;
  period?: string;
  benchmark?: string;
  includeRecommendations?: boolean;
  includeHistorical?: boolean;
  includeRiskMetrics?: boolean;
  timeHorizon?: string;
}

export interface AnalyticsResponse {
  success: boolean;
  data?: PortfolioAnalytics;
  error?: string;
  timestamp: string;
  processingTime: number;
}

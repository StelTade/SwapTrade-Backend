export type AssistantRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TradingActivity {
  asset: string;
  tradeType: string;
  notionalValue: number;
  leverage: number;
  realizedPnlPercent?: number;
  createdAt?: string;
}

export interface PortfolioPosition {
  asset: string;
  allocationPercent: number;
  volatilityPercent?: number;
}

export interface UserTradingProfile {
  userId: string;
  experienceLevel: 'NEW' | 'DEVELOPING' | 'ACTIVE' | 'ADVANCED';
  totalTrades: number;
  averageLeverage: number;
  highRiskTradeCount: number;
  dominantAssets: string[];
  knowledgeGaps: string[];
}

export interface RiskWarningResult {
  riskLevel: AssistantRiskLevel;
  shouldWarn: boolean;
  warnings: string[];
  educationalContent: string[];
  guardrail: string;
}

export interface AssistantInteraction {
  id: string;
  userId: string;
  sessionId: string;
  message: string;
  response: string;
  intent: string;
  riskLevel: AssistantRiskLevel;
  warnings: string[];
  educationalContent: string[];
  createdAt: string;
}

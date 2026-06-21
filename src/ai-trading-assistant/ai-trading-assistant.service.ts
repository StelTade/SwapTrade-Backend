import { Injectable } from '@nestjs/common';
import { AssistantQueryDto } from './dto/assistant-query.dto';
import { RiskWarningDto } from './dto/risk-warning.dto';
import {
  AssistantInteraction,
  AssistantRiskLevel,
  PortfolioPosition,
  RiskWarningResult,
  TradingActivity,
  UserTradingProfile,
} from './interfaces/ai-trading-assistant.interface';

@Injectable()
export class AiTradingAssistantService {
  private readonly interactions: AssistantInteraction[] = [];
  private readonly sessionMemory = new Map<string, AssistantInteraction[]>();

  ask(dto: AssistantQueryDto): {
    answer: string;
    profile: UserTradingProfile;
    riskLevel: AssistantRiskLevel;
    warnings: string[];
    educationalContent: string[];
    sessionContext: { sessionId: string; messageCount: number };
  } {
    const profile = this.buildUserProfile(
      dto.userId,
      dto.tradingHistory ?? [],
      dto.portfolio ?? [],
    );
    const risk = this.evaluateProfileRisk(profile, dto.portfolio ?? []);
    const intent = this.detectIntent(dto.message);
    const answer = this.buildEducationalAnswer(
      dto.message,
      intent,
      profile,
      risk,
    );

    const interaction = this.logInteraction({
      userId: dto.userId,
      sessionId: dto.sessionId,
      message: dto.message,
      response: answer,
      intent,
      riskLevel: risk.riskLevel,
      warnings: risk.warnings,
      educationalContent: risk.educationalContent,
    });

    return {
      answer,
      profile,
      riskLevel: risk.riskLevel,
      warnings: risk.warnings,
      educationalContent: risk.educationalContent,
      sessionContext: {
        sessionId: dto.sessionId,
        messageCount: this.getSessionHistory(dto.sessionId).length,
      },
    };
  }

  assessTradeRisk(dto: RiskWarningDto): RiskWarningResult {
    const warnings: string[] = [];
    const educationalContent: string[] = [];
    let score = 0;

    if (dto.leverage >= 10) {
      score += 55;
      warnings.push(
        `This ${dto.leverage}x leveraged ${dto.asset} trade can amplify losses very quickly.`,
      );
      educationalContent.push(
        'Leverage increases both gains and losses. Review liquidation thresholds, margin requirements, and position sizing before placing leveraged trades.',
      );
    } else if (dto.leverage >= 5) {
      score += 35;
      warnings.push(
        `This trade uses ${dto.leverage}x leverage, which materially increases downside risk.`,
      );
    }

    if ((dto.portfolioAllocationPercent ?? 0) >= 35) {
      score += 25;
      warnings.push(
        `${dto.asset} would represent ${dto.portfolioAllocationPercent}% of the portfolio, creating concentration risk.`,
      );
      educationalContent.push(
        'Concentration risk means one asset can dominate portfolio outcomes. Diversification can reduce single-asset dependency.',
      );
    }

    if ((dto.volatilityPercent ?? 0) >= 60) {
      score += 20;
      warnings.push(
        `${dto.asset} has elevated volatility, so price swings may be larger than expected.`,
      );
    }

    const riskLevel = this.toRiskLevel(score);

    return {
      riskLevel,
      shouldWarn: riskLevel === 'HIGH' || riskLevel === 'CRITICAL',
      warnings,
      educationalContent,
      guardrail:
        'Educational information only. This assistant does not provide personalized financial advice or trade recommendations.',
    };
  }

  getSessionHistory(sessionId: string): AssistantInteraction[] {
    return this.sessionMemory.get(sessionId) ?? [];
  }

  getInteractionLogs(): AssistantInteraction[] {
    return [...this.interactions];
  }

  buildUserProfile(
    userId: string,
    tradingHistory: TradingActivity[],
    portfolio: PortfolioPosition[],
  ): UserTradingProfile {
    const totalTrades = tradingHistory.length;
    const averageLeverage =
      totalTrades === 0
        ? 1
        : tradingHistory.reduce((sum, trade) => sum + trade.leverage, 0) /
          totalTrades;
    const highRiskTradeCount = tradingHistory.filter(
      (trade) =>
        trade.leverage >= 5 || Math.abs(trade.realizedPnlPercent ?? 0) >= 15,
    ).length;
    const dominantAssets = [...portfolio]
      .sort((a, b) => b.allocationPercent - a.allocationPercent)
      .slice(0, 3)
      .map((position) => position.asset);

    return {
      userId,
      experienceLevel: this.toExperienceLevel(totalTrades),
      totalTrades,
      averageLeverage: Number(averageLeverage.toFixed(2)),
      highRiskTradeCount,
      dominantAssets,
      knowledgeGaps: this.detectKnowledgeGaps(
        tradingHistory,
        portfolio,
        totalTrades,
        averageLeverage,
      ),
    };
  }

  private evaluateProfileRisk(
    profile: UserTradingProfile,
    portfolio: PortfolioPosition[],
  ): RiskWarningResult {
    const concentration = portfolio.some(
      (position) => position.allocationPercent >= 35,
    );
    const warnings: string[] = [];
    const educationalContent = this.educationForGaps(profile.knowledgeGaps);
    let score = 0;

    if (profile.averageLeverage >= 5) {
      score += 45;
      warnings.push(
        `Your recent average leverage is ${profile.averageLeverage}x, so losses can compound quickly.`,
      );
    }

    if (profile.highRiskTradeCount >= 2) {
      score += 30;
      warnings.push(
        `${profile.highRiskTradeCount} recent trades match high-risk behavior patterns.`,
      );
    }

    if (concentration) {
      score += 20;
      warnings.push(
        'Portfolio concentration is elevated in one or more assets.',
      );
    }

    return {
      riskLevel: this.toRiskLevel(score),
      shouldWarn: score >= 60,
      warnings,
      educationalContent,
      guardrail:
        'Educational information only. This assistant does not provide personalized financial advice or trade recommendations.',
    };
  }

  private buildEducationalAnswer(
    message: string,
    intent: string,
    profile: UserTradingProfile,
    risk: RiskWarningResult,
  ): string {
    if (this.requestsFinancialAdvice(message)) {
      return [
        'I cannot tell you what to buy, sell, hold, or size.',
        'I can explain platform features, risk concepts, and educational factors to review before you make your own decision.',
        risk.guardrail,
      ].join(' ');
    }

    if (profile.totalTrades === 0) {
      return [
        'Welcome to SwapTrade. Start by learning how orders, portfolio allocation, and risk warnings work before placing leveraged trades.',
        'A good onboarding path is: review platform features, understand leverage and liquidation risk, then practice with small educational examples.',
        risk.guardrail,
      ].join(' ');
    }

    if (intent === 'platform_features') {
      return [
        'SwapTrade supports trading workflows such as order placement, portfolio tracking, risk checks, analytics, and real-time updates.',
        'This assistant can explain those features and highlight educational risk considerations based on your recent activity.',
        risk.guardrail,
      ].join(' ');
    }

    if (intent === 'portfolio_risk') {
      return [
        `Your profile shows ${profile.totalTrades} tracked trades, ${profile.averageLeverage}x average leverage, and ${profile.highRiskTradeCount} high-risk pattern(s).`,
        risk.warnings.length
          ? `Educational warning: ${risk.warnings.join(' ')}`
          : 'No high-risk profile warning was detected from the supplied activity.',
        risk.guardrail,
      ].join(' ');
    }

    return [
      'I can help explain trading concepts, platform features, portfolio risk signals, and educational next steps.',
      profile.knowledgeGaps.length
        ? `Suggested learning areas: ${profile.knowledgeGaps.join(', ')}.`
        : 'Your supplied activity does not show a major learning gap yet.',
      risk.guardrail,
    ].join(' ');
  }

  private logInteraction(
    input: Omit<AssistantInteraction, 'id' | 'createdAt'>,
  ) {
    const interaction: AssistantInteraction = {
      id: `assistant-${this.interactions.length + 1}`,
      createdAt: new Date().toISOString(),
      ...input,
    };

    this.interactions.push(interaction);
    const history = this.sessionMemory.get(input.sessionId) ?? [];
    history.push(interaction);
    this.sessionMemory.set(input.sessionId, history);

    return interaction;
  }

  private detectIntent(message: string): string {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('feature') ||
      normalized.includes('platform') ||
      normalized.includes('how does swaptrade')
    ) {
      return 'platform_features';
    }

    if (
      normalized.includes('portfolio') ||
      normalized.includes('risk') ||
      normalized.includes('leverage')
    ) {
      return 'portfolio_risk';
    }

    return 'general_education';
  }

  private requestsFinancialAdvice(message: string): boolean {
    const normalized = message.toLowerCase();
    return [
      'should i buy',
      'should i sell',
      'what should i buy',
      'what should i sell',
      'guaranteed profit',
      'tell me the best trade',
    ].some((phrase) => normalized.includes(phrase));
  }

  private detectKnowledgeGaps(
    tradingHistory: TradingActivity[],
    portfolio: PortfolioPosition[],
    totalTrades: number,
    averageLeverage: number,
  ): string[] {
    const gaps = new Set<string>();

    if (totalTrades < 3) {
      gaps.add('platform onboarding');
    }

    if (averageLeverage >= 5) {
      gaps.add('leverage and liquidation risk');
    }

    if (portfolio.some((position) => position.allocationPercent >= 35)) {
      gaps.add('portfolio concentration');
    }

    if (
      tradingHistory.some(
        (trade) => Math.abs(trade.realizedPnlPercent ?? 0) >= 15,
      )
    ) {
      gaps.add('volatility and drawdown management');
    }

    return [...gaps];
  }

  private educationForGaps(gaps: string[]): string[] {
    const content: Record<string, string> = {
      'platform onboarding':
        'Review order types, balances, and risk warnings before increasing trade size.',
      'leverage and liquidation risk':
        'Leveraged trades can be liquidated when collateral no longer supports the open position.',
      'portfolio concentration':
        'A concentrated portfolio depends heavily on one asset, which can increase drawdown risk.',
      'volatility and drawdown management':
        'Volatility can create rapid unrealized losses. Track drawdown and position size together.',
    };

    return gaps.map((gap) => content[gap]).filter(Boolean);
  }

  private toExperienceLevel(
    totalTrades: number,
  ): UserTradingProfile['experienceLevel'] {
    if (totalTrades === 0) return 'NEW';
    if (totalTrades < 10) return 'DEVELOPING';
    if (totalTrades < 50) return 'ACTIVE';
    return 'ADVANCED';
  }

  private toRiskLevel(score: number): AssistantRiskLevel {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }
}

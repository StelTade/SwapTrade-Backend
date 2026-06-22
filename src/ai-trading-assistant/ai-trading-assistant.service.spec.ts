import { AiTradingAssistantService } from './ai-trading-assistant.service';

describe('AiTradingAssistantService', () => {
  let service: AiTradingAssistantService;

  beforeEach(() => {
    service = new AiTradingAssistantService();
  });

  it('provides onboarding guidance for new users', () => {
    const response = service.ask({
      userId: 'new-user',
      sessionId: 'session-1',
      message: 'How should I start using platform features?',
      tradingHistory: [],
      portfolio: [],
    });

    expect(response.profile.experienceLevel).toBe('NEW');
    expect(response.answer).toContain('Welcome to SwapTrade');
    expect(response.educationalContent).toContain(
      'Review order types, balances, and risk warnings before increasing trade size.',
    );
  });

  it('answers common platform feature questions with educational guardrails', () => {
    const response = service.ask({
      userId: 'user-1',
      sessionId: 'session-1',
      message: 'What platform features help me understand risk?',
      tradingHistory: [
        {
          asset: 'BTC',
          tradeType: 'BUY',
          notionalValue: 100,
          leverage: 1,
        },
      ],
      portfolio: [{ asset: 'BTC', allocationPercent: 20 }],
    });

    expect(response.answer).toContain('SwapTrade supports trading workflows');
    expect(response.answer).toContain(
      'does not provide personalized financial advice',
    );
  });

  it('refuses direct financial advice while offering education', () => {
    const response = service.ask({
      userId: 'user-2',
      sessionId: 'session-2',
      message: 'Should I buy BTC for guaranteed profit?',
      tradingHistory: [
        {
          asset: 'BTC',
          tradeType: 'BUY',
          notionalValue: 1000,
          leverage: 2,
        },
      ],
      portfolio: [{ asset: 'BTC', allocationPercent: 20 }],
    });

    expect(response.answer).toContain('I cannot tell you what to buy');
    expect(response.answer).toContain('Educational information only');
  });

  it('triggers high-risk warnings for leveraged concentrated trades', () => {
    const result = service.assessTradeRisk({
      userId: 'user-3',
      asset: 'ETH',
      tradeType: 'LONG',
      notionalValue: 5000,
      leverage: 12,
      portfolioAllocationPercent: 45,
      volatilityPercent: 70,
    });

    expect(result.shouldWarn).toBe(true);
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.warnings.join(' ')).toContain('12x leveraged ETH trade');
    expect(result.educationalContent.join(' ')).toContain('Leverage increases');
  });

  it('maintains conversation context across a session', () => {
    service.ask({
      userId: 'user-4',
      sessionId: 'session-4',
      message: 'Explain portfolio risk',
      tradingHistory: [
        {
          asset: 'SOL',
          tradeType: 'LONG',
          notionalValue: 700,
          leverage: 6,
          realizedPnlPercent: -18,
        },
      ],
      portfolio: [{ asset: 'SOL', allocationPercent: 40 }],
    });

    const second = service.ask({
      userId: 'user-4',
      sessionId: 'session-4',
      message: 'What should I learn next?',
      tradingHistory: [
        {
          asset: 'SOL',
          tradeType: 'LONG',
          notionalValue: 700,
          leverage: 6,
          realizedPnlPercent: -18,
        },
      ],
      portfolio: [{ asset: 'SOL', allocationPercent: 40 }],
    });

    expect(second.sessionContext.messageCount).toBe(2);
    expect(service.getSessionHistory('session-4')).toHaveLength(2);
  });

  it('logs all assistant interactions for quality review', () => {
    service.ask({
      userId: 'user-5',
      sessionId: 'session-5',
      message: 'Tell me about leverage risk',
      tradingHistory: [
        {
          asset: 'BTC',
          tradeType: 'LONG',
          notionalValue: 300,
          leverage: 5,
        },
      ],
      portfolio: [{ asset: 'BTC', allocationPercent: 25 }],
    });

    const logs = service.getInteractionLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: 'user-5',
      sessionId: 'session-5',
      intent: 'portfolio_risk',
    });
  });
});

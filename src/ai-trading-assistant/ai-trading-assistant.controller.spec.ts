import { AiTradingAssistantController } from './ai-trading-assistant.controller';
import { AiTradingAssistantService } from './ai-trading-assistant.service';

describe('AiTradingAssistantController', () => {
  let controller: AiTradingAssistantController;

  beforeEach(() => {
    controller = new AiTradingAssistantController(
      new AiTradingAssistantService(),
    );
  });

  it('handles assistant questions through the REST controller', () => {
    const response = controller.ask({
      userId: 'controller-user',
      sessionId: 'controller-session',
      message: 'Explain SwapTrade platform features',
      tradingHistory: [],
      portfolio: [],
    });

    expect(response.answer).toContain('Welcome to SwapTrade');
    expect(response.sessionContext).toEqual({
      sessionId: 'controller-session',
      messageCount: 1,
    });
  });

  it('returns risk warnings through the REST controller', () => {
    const response = controller.assessTradeRisk({
      userId: 'controller-user',
      asset: 'BTC',
      tradeType: 'LONG',
      notionalValue: 10000,
      leverage: 15,
      portfolioAllocationPercent: 50,
    });

    expect(response.shouldWarn).toBe(true);
    expect(response.warnings.join(' ')).toContain('15x leveraged BTC trade');
  });
});

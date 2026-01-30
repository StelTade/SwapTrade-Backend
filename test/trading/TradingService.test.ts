jest.mock('../../src/repositories/OrderRepo');
jest.mock('../../src/services/BalanceService');

const TradingService = require('../../src/services/TradingService');

test('matches buy and sell orders correctly', async () => {
  OrderRepo.getOpenSellOrders.mockResolvedValue([
    { id: 1, price: 100, quantity: 5 }
  ]);

  const trades = await TradingService.matchOrder({
    type: 'buy',
    price: 100,
    quantity: 5
  });

  expect(trades).toHaveLength(1);
  expect(trades[0].price).toBe(100);
});

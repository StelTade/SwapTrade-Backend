jest.mock('../../src/repositories/BalanceRepo');

const BalanceService = require('../../src/services/BalanceService');
const BalanceRepo = require('../../src/repositories/BalanceRepo');

describe('BalanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deposit increases user balance', async () => {
    BalanceRepo.getBalance.mockResolvedValue(100);
    BalanceRepo.updateBalance.mockResolvedValue(150);

    const result = await BalanceService.deposit('user1', 50);

    expect(BalanceRepo.updateBalance).toHaveBeenCalledWith('user1', 150);
    expect(result.balance).toBe(150);
  });

  test('withdraw fails when balance is insufficient', async () => {
    BalanceRepo.getBalance.mockResolvedValue(30);

    await expect(
      BalanceService.withdraw('user1', 50)
    ).rejects.toThrow('Insufficient balance');
  });
});

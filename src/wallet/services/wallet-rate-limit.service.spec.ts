import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import { WalletRateLimitService } from './wallet-rate-limit.service';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';

describe('WalletRateLimitService', () => {
  let service: WalletRateLimitService;
  let withdrawalRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let qb: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getRawOne: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ sum: '0' }),
    };
    withdrawalRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletRateLimitService,
        { provide: getRepositoryToken(WithdrawalRequest), useValue: withdrawalRepo },
        // defaults: maxPerHour 5, maxDailyValue 10000
        { provide: ConfigService, useValue: { get: jest.fn((_k, d) => d) } },
      ],
    }).compile();

    service = module.get(WalletRateLimitService);
  });

  it('allows a withdrawal comfortably within both limits', async () => {
    withdrawalRepo.count.mockResolvedValue(2);
    qb.getRawOne.mockResolvedValue({ sum: '0' });

    await expect(service.assertWithinLimits('u1', 100)).resolves.toBeUndefined();
  });

  it('rejects with 429 when the hourly request count is reached', async () => {
    withdrawalRepo.count.mockResolvedValue(5); // == maxPerHour

    let error: any;
    try {
      await service.assertWithinLimits('u1', 100);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    // Short-circuits before the daily-value query.
    expect(withdrawalRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('rejects with 429 when the new amount would exceed the daily value cap', async () => {
    withdrawalRepo.count.mockResolvedValue(1);
    qb.getRawOne.mockResolvedValue({ sum: '9950' }); // 9950 + 100 = 10050 > 10000

    let error: any;
    try {
      await service.assertWithinLimits('u1', 100);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });
});

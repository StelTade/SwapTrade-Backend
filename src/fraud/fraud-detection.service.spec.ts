/**
 * Fraud Detection Service 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { FraudDetectionService } from './fraud-detection.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('FraudDetectionService', () => {
  let service: FraudDetectionService;

  const mockWaitlistRepo = {
    count: jest.fn(),
  };

  const mockReferralRepo = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockUserRepo = {
    count: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudDetectionService,
        {
          provide: getRepositoryToken('waitlist'),
          useValue: mockWaitlistRepo,
        },
        {
          provide: getRepositoryToken('referral'),
          useValue: mockReferralRepo,
        },
        {
          provide: getRepositoryToken('user'),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<FraudDetectionService>(FraudDetectionService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('checkWaitlistSignup', () => {
    it('应该允许正常注册', async () => {
      const result = await service.checkWaitlistSignup(
        'normal@example.com',
        '192.168.1.1',
      );

      expect(result.riskScore).toBeLessThan(50);
      expect(result.action).toBe('allow');
    });

    it('应该检测临时邮箱', async () => {
      const result = await service.checkWaitlistSignup(
        'test@tempmail.com',
        '192.168.1.1',
      );

      expect(result.riskScore).toBeGreaterThanOrEqual(50);
      expect(result.reasons).toContain('使用临时邮箱');
    });

    it('应该检测无效邮箱格式', async () => {
      const result = await service.checkWaitlistSignup(
        'invalid-email',
        '192.168.1.1',
      );

      expect(result.reasons).toContain('邮箱格式可疑');
    });
  });

  describe('checkReferral', () => {
    it('应该允许正常推荐', async () => {
      const result = await service.checkReferral(
        1,
        2,
        '192.168.1.1',
        '192.168.1.2',
      );

      expect(result.riskScore).toBeLessThan(50);
    });

    it('应该检测相同 IP', async () => {
      const result = await service.checkReferral(
        1,
        2,
        '192.168.1.1',
        '192.168.1.1',
      );

      expect(result.reasons).toContain('推荐人和被推荐人 IP 地址相同');
      expect(result.riskScore).toBeGreaterThanOrEqual(40);
    });
  });

  describe('isDisposableEmail', () => {
    it('应该识别临时邮箱', () => {
      expect(service['isDisposableEmail']('tempmail.com')).toBe(true);
      expect(service['isDisposableEmail']('mailinator.com')).toBe(true);
    });

    it('应该允许正常邮箱', () => {
      expect(service['isDisposableEmail']('gmail.com')).toBe(false);
      expect(service['isDisposableEmail']('example.com')).toBe(false);
    });
  });
});

/**
 * Waitlist Notification Service 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistNotificationService } from './waitlist-notification.service';
import { NotificationService } from './notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationTemplate } from './entities/notification-template.entity';

describe('WaitlistNotificationService', () => {
  let service: WaitlistNotificationService;
  let notificationService: NotificationService;

  const mockNotificationService = {
    send: jest.fn(),
  };

  const mockTemplateRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistNotificationService,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: mockTemplateRepo,
        },
      ],
    }).compile();

    service = module.get<WaitlistNotificationService>(WaitlistNotificationService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('sendSignupConfirmation', () => {
    it('应该发送注册确认邮件', async () => {
      const data = {
        email: 'test@example.com',
        name: '测试用户',
        signupDate: new Date(),
        referralCode: 'REF123',
      };

      mockTemplateRepo.findOne.mockResolvedValue(null);
      mockTemplateRepo.create.mockReturnValue({ templateKey: 'waitlist-signup' });
      mockTemplateRepo.save.mockResolvedValue({});
      mockNotificationService.send.mockResolvedValue({});

      await service.sendSignupConfirmation(data);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'waitlist-signup',
          channels: ['email'],
          subject: '欢迎加入 SwapTrade 等待列表！',
        }),
      );
    });
  });

  describe('sendReferralSuccess', () => {
    it('应该发送推荐成功通知', async () => {
      const data = {
        email: 'referrer@example.com',
        name: '推荐人',
        refereeEmail: 'referee@example.com',
        pointsAwarded: 100,
        totalPoints: 500,
      };

      mockTemplateRepo.findOne.mockResolvedValue(null);
      mockTemplateRepo.create.mockReturnValue({ templateKey: 'referral-success' });
      mockTemplateRepo.save.mockResolvedValue({});
      mockNotificationService.send.mockResolvedValue({});

      await service.sendReferralSuccess(data);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'referral-success',
          channels: ['email'],
          subject: '推荐成功！积分已到账',
        }),
      );
    });
  });

  describe('sendLaunchNotification', () => {
    it('应该发送产品上线通知', async () => {
      const data = {
        email: 'user@example.com',
        name: '用户',
        launchDate: new Date(),
        specialOffer: '首笔交易手续费 5 折',
      };

      mockTemplateRepo.findOne.mockResolvedValue(null);
      mockTemplateRepo.create.mockReturnValue({ templateKey: 'launch-notification' });
      mockTemplateRepo.save.mockResolvedValue({});
      mockNotificationService.send.mockResolvedValue({});

      await service.sendLaunchNotification(data);

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'launch-notification',
          channels: ['email'],
          subject: 'SwapTrade 正式上线！立即注册',
        }),
      );
    });
  });
});

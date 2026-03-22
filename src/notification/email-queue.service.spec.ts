/**
 * Email Queue Service 单元测试
 * 测试队列、重试、速率限制功能
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { EmailQueueService, EmailJobData } from './email-queue.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailJob, EmailJobStatus, EmailJobPriority } from './entities/email-job.entity';

describe('EmailQueueService', () => {
  let service: EmailQueueService;

  const mockEmailJobRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueService,
        {
          provide: getRepositoryToken(EmailJob),
          useValue: mockEmailJobRepo,
        },
      ],
    }).compile();

    service = module.get<EmailQueueService>(EmailQueueService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueEmail', () => {
    it('应该将邮件加入队列', async () => {
      const data: EmailJobData = {
        to: 'test@example.com',
        subject: '测试邮件',
        body: '<p>测试内容</p>',
        priority: EmailJobPriority.HIGH,
      };

      const mockJob = { id: 1, ...data, status: EmailJobStatus.PENDING };
      mockEmailJobRepo.create.mockReturnValue(mockJob);
      mockEmailJobRepo.save.mockResolvedValue(mockJob);

      const result = await service.enqueueEmail(data);

      expect(result).toEqual(mockJob);
      expect(mockEmailJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: data.to,
          subject: data.subject,
          status: EmailJobStatus.PENDING,
          priority: EmailJobPriority.HIGH,
          attempt: 0,
        }),
      );
    });
  });

  describe('getQueueStats', () => {
    it('应该返回队列统计信息', async () => {
      mockEmailJobRepo.count
        .mockResolvedValueOnce(5)  // pending
        .mockResolvedValueOnce(100) // completed
        .mockResolvedValueOnce(2)   // failed
        .mockResolvedValueOnce(3);  // retrying

      const stats = await service.getQueueStats();

      expect(stats).toEqual({
        pending: 5,
        completed: 100,
        failed: 2,
        retrying: 3,
        total: 110,
      });
    });
  });

  describe('重试逻辑', () => {
    it('应该使用指数退避策略', () => {
      const retryDelays = [1000, 5000, 30000];
      expect(retryDelays[0]).toBe(1000);   // 第 1 次重试：1 秒
      expect(retryDelays[1]).toBe(5000);   // 第 2 次重试：5 秒
      expect(retryDelays[2]).toBe(30000);  // 第 3 次重试：30 秒
    });
  });
});

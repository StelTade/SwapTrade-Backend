import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import {
  Notification,
  NotificationChannel,
} from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import {
  NotificationJob,
  NotificationJobStatus,
} from './entities/notification-job.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Repository<Notification>;
  let jobRepo: Repository<NotificationJob>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationJob),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    jobRepo = module.get<Repository<NotificationJob>>(
      getRepositoryToken(NotificationJob),
    );

    jest
      .spyOn(service as any, 'deliverEmail')
      .mockImplementation(async () => undefined);
    jest
      .spyOn(service as any, 'deliverSms')
      .mockImplementation(async () => undefined);
    jest
      .spyOn(service as any, 'deliverInApp')
      .mockImplementation(async () => undefined);
    jest
      .spyOn(service as any, 'deliverPush')
      .mockImplementation(async () => undefined);
  });

  it('enqueues jobs for selected channels', async () => {
    const dto = {
      userId: 1,
      type: 'WELCOME',
      message: 'Welcome',
      channels: [NotificationChannel.Email, NotificationChannel.Sms],
    };
    const savedNotification = {
      id: 1,
      userId: dto.userId,
      type: dto.type,
      channels: dto.channels,
      subject: null,
      message: dto.message,
      status: 'SENT',
      metadata: {},
      templateKey: null,
    } as unknown as Notification;

    (notificationRepo.create as jest.Mock).mockReturnValue(savedNotification);
    (notificationRepo.save as jest.Mock).mockResolvedValue(savedNotification);
    (jobRepo.create as jest.Mock).mockImplementation((data) => data);
    (jobRepo.save as jest.Mock).mockImplementation(async (jobs) => jobs);

    const result = await service.send(dto as any, {});

    expect(notificationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: dto.userId,
        type: dto.type,
        channels: dto.channels,
        message: dto.message,
      }),
    );
    expect(jobRepo.create).toHaveBeenCalledTimes(2);
    expect(result).toBe(savedNotification);
  });

  it('processes pending jobs and marks them completed', async () => {
    const job: NotificationJob = {
      id: 1,
      notificationId: 1,
      status: NotificationJobStatus.Pending,
      attempt: 0,
      nextRunAt: new Date(),
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const notification: Notification = {
      id: 1,
      userId: 1,
      type: 'WELCOME',
      channels: [NotificationChannel.Email],
      subject: null,
      message: 'Welcome',
      status: 'SENT' as any,
      metadata: {},
      templateKey: null,
      deliveredAt: null,
      readAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (jobRepo.find as jest.Mock).mockResolvedValue([job]);
    (notificationRepo.findOne as jest.Mock).mockResolvedValue(notification);
    (jobRepo.save as jest.Mock).mockImplementation(async (value) => value);
    (notificationRepo.save as jest.Mock).mockImplementation(
      async (value) => value,
    );

    await service.processPendingBatch(10);

    expect(service['deliverEmail']).toHaveBeenCalled();
    expect(jobRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: NotificationJobStatus.Completed,
      }),
    );
  });
});

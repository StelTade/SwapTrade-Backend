import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationEventType } from '../common/enums/notification-event-type.enum';
import { NotificationStatus } from '../common/enums/notification-status.enum';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepo: Repository<Notification>;
  let preferenceRepo: Repository<NotificationPreference>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepo = module.get<Repository<Notification>>(getRepositoryToken(Notification));
    preferenceRepo = module.get<Repository<NotificationPreference>>(getRepositoryToken(NotificationPreference));
  });

  it('sends event when preference allows', async () => {
    (preferenceRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 1,
      orderFilled: true,
      priceAlerts: true,
      achievementUnlocked: true,
    });
    const created = { id: 1 } as Notification;
    (notificationRepo.create as jest.Mock).mockReturnValue(created);
    (notificationRepo.save as jest.Mock).mockResolvedValue({ ...created, status: NotificationStatus.SENT });

    const res = await service.sendEvent(1, NotificationEventType.ORDER_FILLED, 'Filled');
    expect(res.status).toBe(NotificationStatus.SENT);
  });

  it('fails event when preference blocks', async () => {
    (preferenceRepo.findOne as jest.Mock).mockResolvedValue({
      userId: 2,
      orderFilled: false,
      priceAlerts: true,
      achievementUnlocked: true,
    });
    const created = { id: 2 } as Notification;
    (notificationRepo.create as jest.Mock).mockReturnValue(created);
    (notificationRepo.save as jest.Mock).mockResolvedValue({ ...created, status: NotificationStatus.FAILED });

    const res = await service.sendEvent(2, NotificationEventType.ORDER_FILLED, 'Blocked');
    expect(res.status).toBe(NotificationStatus.FAILED);
  });

  it('sets and gets preferences', async () => {
    (preferenceRepo.findOne as jest.Mock).mockResolvedValue(null);
    const pref = { userId: 3, orderFilled: true, priceAlerts: false, achievementUnlocked: true } as NotificationPreference;
    (preferenceRepo.create as jest.Mock).mockReturnValue(pref);
    (preferenceRepo.save as jest.Mock).mockResolvedValue(pref);

    const saved = await service.setPreferences(pref);
    expect(saved).toEqual(pref);
    (preferenceRepo.findOne as jest.Mock).mockResolvedValue(pref);
    const got = await service.getPreferences(3);
    expect(got).toEqual(pref);
  });
});
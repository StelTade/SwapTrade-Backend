// src/rewards/services/user-badge.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserBadgeService } from './user-badge.service';
import { UserBadge } from '../rewards/entities/user-badge.entity';
import { User } from '../../src/user/entities/user.entity';

describe('UserBadgeService', () => {
  let service: UserBadgeService;

  const mockBadgeRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserBadgeService,
        { provide: getRepositoryToken(UserBadge), useValue: mockBadgeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<UserBadgeService>(UserBadgeService);
  });

  afterEach(() => jest.resetAllMocks());

  it('awards First Trade when tradesCount >= 1', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 1, tradesCount: 1, totalProfit: 0, completedTutorial: false });
    mockBadgeRepo.findOne.mockResolvedValue(undefined);
    mockBadgeRepo.create.mockImplementation((o) => o);
    mockBadgeRepo.save.mockResolvedValue({ id: 1, userId: 1, badgeName: 'First Trade' });

    const awarded = await service.evaluateAndAwardForUser(1);
    expect(awarded).toHaveLength(1);
    expect(awarded[0].badgeName).toBe('First Trade');
  });

  it('does not re-award an already existing badge', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 2, tradesCount: 10, totalProfit: 0, completedTutorial: false });
    mockBadgeRepo.findOne.mockResolvedValue({ id: 99, userId: 2, badgeName: 'First Trade' });

    const awarded = await service.evaluateAndAwardForUser(2);
    expect(awarded).toHaveLength(0);
  });

  it('awardBadge returns created badge or null if exists', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 3 });
    mockBadgeRepo.findOne.mockResolvedValue(undefined);
    mockBadgeRepo.create.mockImplementation((o) => o);
    mockBadgeRepo.save.mockResolvedValue({ id: 10, userId: 3, badgeName: 'Learner' });

    const created = await service.awardBadge(3, 'Learner' as any);
    expect(created).toBeDefined();
    // non-null assertion so TS doesn't complain about possible null
    expect((created!).badgeName).toBe('Learner');
  });
});

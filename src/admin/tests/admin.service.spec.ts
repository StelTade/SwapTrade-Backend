import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../admin.service';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

const mockRepo = (overrides = {}) => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((x) => x),
  createQueryBuilder: jest.fn(() => ({
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  })),
  ...overrides,
});

describe('AdminService', () => {
  let service: AdminService;
  let referralRepo: any;
  let auditRepo: any;

  beforeEach(async () => {
    referralRepo = mockRepo();
    auditRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken('waitlist_referral_points'),
          useValue: mockRepo(),
        },
        {
          provide: getRepositoryToken('waitlist_referrals'),
          useValue: referralRepo,
        },
        { provide: getRepositoryToken('audit_log'), useValue: auditRepo },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('throws if referral not found on adjust', async () => {
    referralRepo.findOne.mockResolvedValueOnce(null);
    await expect(
      service.adjustPoints('bad-id', { delta: 5, reason: 'test' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('writes audit log on adjust', async () => {
    referralRepo.findOne.mockResolvedValueOnce({
      id: 'ref-1',
      referrer_id: 'user-1',
    });
    await service.adjustPoints(
      'ref-1',
      { delta: 2, reason: 'bonus' },
      'admin-1',
    );
    expect(auditRepo.save).toHaveBeenCalled();
  });

  it('filters suspect referrals by fraud_score', async () => {
    await service.getReferrals({ suspect: true, page: 1, limit: 20 });
    const qbMock = referralRepo.createQueryBuilder();
    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'r.fraud_score >= :threshold',
      { threshold: 40 },
    );
  });
});

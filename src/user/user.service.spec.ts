import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { Auth } from '../auth/entities/auth.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatus } from '../auth/entities/auth.entity';

const mockUserRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockUserBalanceRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockAuthRepo = () => ({
  update: jest.fn(),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

const makeUser = (overrides = {}): Partial<User> => ({
  id: 'user-uuid',
  username: 'testuser',
  email: 'test@example.com',
  role: UserRole.USER,
  roles: [UserRole.USER],
  status: AccountStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let userBalanceRepo: ReturnType<typeof mockUserBalanceRepo>;
  let authRepo: ReturnType<typeof mockAuthRepo>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(UserBalance), useFactory: mockUserBalanceRepo },
        { provide: getRepositoryToken(Auth), useFactory: mockAuthRepo },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepo = module.get(getRepositoryToken(User));
    userBalanceRepo = module.get(getRepositoryToken(UserBalance));
    authRepo = module.get(getRepositoryToken(Auth));
    eventEmitter = module.get(EventEmitter2);
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return list of users', async () => {
      userRepo.find.mockResolvedValue([makeUser()]);
      const result = await service.findAll();
      expect(result).toHaveLength(1);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a user by id', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.findOne('user-uuid');
      expect(result.id).toBe('user-uuid');
    });

    it('should throw NotFoundException for unknown id', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a user successfully', async () => {
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(makeUser());
      userRepo.save.mockResolvedValue(makeUser());

      const result = await service.create({
        username: 'newuser',
        email: 'new@example.com',
        role: UserRole.USER,
      });

      expect(result.id).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.create({ username: 'dup', email: 'test@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update user profile', async () => {
      const user = makeUser() as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, username: 'updated' });

      const result = await service.update('user-uuid', { username: 'updated' });
      expect(result.username).toBe('updated');
    });

    it('should throw NotFoundException for missing user', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-id', { username: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Status Management ───────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should activate a user', async () => {
      const user = makeUser({ status: AccountStatus.INACTIVE }) as User;
      user.authId = 'auth-id';
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, status: AccountStatus.ACTIVE });
      authRepo.update.mockResolvedValue({});

      const result = await service.activate('user-uuid');
      expect(result.status).toBe(AccountStatus.ACTIVE);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should suspend a user', async () => {
      const user = makeUser({ status: AccountStatus.ACTIVE }) as User;
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, status: AccountStatus.SUSPENDED });
      authRepo.update.mockResolvedValue({});

      const result = await service.suspend('user-uuid', 'Policy violation');
      expect(result.status).toBe(AccountStatus.SUSPENDED);
    });

    it('should throw BadRequestException when status is unchanged', async () => {
      const user = makeUser({ status: AccountStatus.ACTIVE }) as User;
      userRepo.findOne.mockResolvedValue(user);

      await expect(service.activate('user-uuid')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Role Assignment ────────────────────────────────────────────────────────

  describe('validateRoleAssignment', () => {
    it('should accept valid role combinations', () => {
      expect(() => service.validateRoleAssignment([UserRole.USER])).not.toThrow();
      expect(() =>
        service.validateRoleAssignment([UserRole.STAFF, UserRole.USER]),
      ).not.toThrow();
    });

    it('should reject governance + KYC role combination', () => {
      expect(() =>
        service.validateRoleAssignment([
          UserRole.GOVERNANCE_OPERATOR,
          UserRole.KYC_OPERATOR,
        ]),
      ).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty roles', () => {
      expect(() => service.validateRoleAssignment([])).toThrow(BadRequestException);
    });
  });

  // ─── Portfolio Stats ─────────────────────────────────────────────────────────

  describe('getPortfolioStats', () => {
    it('should return aggregated portfolio stats', async () => {
      const balances = [
        {
          userId: 1,
          assetId: 1,
          balance: 1.5,
          totalTrades: 10,
          cumulativePnL: 200,
          totalTradeVolume: 5000,
          lastTradeDate: new Date(),
          asset: { name: 'BTC' },
        },
      ];
      userBalanceRepo.find.mockResolvedValue(balances);

      const result = await service.getPortfolioStats(1);
      expect(result.totalTrades).toBe(10);
      expect(result.currentBalances).toHaveLength(1);
    });

    it('should throw NotFoundException when no balances found', async () => {
      userBalanceRepo.find.mockResolvedValue([]);
      await expect(service.getPortfolioStats(999)).rejects.toThrow(NotFoundException);
    });
  });
});

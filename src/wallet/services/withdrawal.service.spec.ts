import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WithdrawalService } from './withdrawal.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletRateLimitService } from './wallet-rate-limit.service';
import { BroadcasterRegistry } from './broadcasters/broadcaster.registry';
import { MFAService } from '../../auth/mfa.service';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { Auth } from '../../auth/entities/auth.entity';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

describe('WithdrawalService', () => {
  let service: WithdrawalService;
  let withdrawalRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };
  let authRepo: { findOne: jest.Mock };
  let ledger: { reserve: jest.Mock; release: jest.Mock };
  let rateLimit: { assertWithinLimits: jest.Mock };
  let broadcasters: { isValidAddress: jest.Mock };
  let mfa: { verifyToken: jest.Mock };
  let events: { emit: jest.Mock };

  const baseDto = {
    network: BlockchainNetwork.STELLAR,
    toAddress: 'GABC...',
    amount: 100,
    asset: 'USDC',
  };

  beforeEach(async () => {
    withdrawalRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => Promise.resolve({ id: data.id ?? 'w1', ...data })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    authRepo = { findOne: jest.fn() };
    ledger = {
      reserve: jest.fn().mockResolvedValue({ available: 0, reserved: 100, total: 100 }),
      release: jest.fn().mockResolvedValue({ available: 100, reserved: 0, total: 100 }),
    };
    rateLimit = { assertWithinLimits: jest.fn().mockResolvedValue(undefined) };
    broadcasters = { isValidAddress: jest.fn().mockReturnValue(true) };
    mfa = { verifyToken: jest.fn().mockResolvedValue(true) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        { provide: getRepositoryToken(WithdrawalRequest), useValue: withdrawalRepo },
        { provide: getRepositoryToken(Auth), useValue: authRepo },
        { provide: WalletLedgerService, useValue: ledger },
        { provide: WalletRateLimitService, useValue: rateLimit },
        { provide: BroadcasterRegistry, useValue: broadcasters },
        { provide: MFAService, useValue: mfa },
        { provide: EventEmitter2, useValue: events },
        // thresholds: approval 1000, 2FA 500 (defaults)
        { provide: ConfigService, useValue: { get: jest.fn((_k, d) => d) } },
      ],
    }).compile();

    service = module.get(WithdrawalService);
  });

  describe('initiateWithdrawal', () => {
    it('queues a below-threshold withdrawal and reserves the funds', async () => {
      const w = await service.initiateWithdrawal('u1', 'auth1', {
        ...baseDto,
        amount: 100,
      });
      expect(ledger.reserve).toHaveBeenCalledWith(
        'u1',
        'USDC',
        100,
        expect.objectContaining({ referenceType: 'withdrawal' }),
      );
      expect(w.status).toBe(WithdrawalStatus.QUEUED);
      expect(w.requiresApproval).toBe(false);
      expect(events.emit).toHaveBeenCalledWith(
        'wallet.withdrawal.initiated',
        expect.any(Object),
      );
    });

    it('marks an at-threshold withdrawal PENDING_APPROVAL (2FA satisfied)', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'auth1', is2FAEnabled: true });
      const w = await service.initiateWithdrawal('u1', 'auth1', {
        ...baseDto,
        amount: 1500,
        twoFactorToken: '123456',
      });
      expect(mfa.verifyToken).toHaveBeenCalledWith('auth1', '123456');
      expect(ledger.reserve).toHaveBeenCalled();
      expect(w.status).toBe(WithdrawalStatus.PENDING_APPROVAL);
      expect(w.requiresApproval).toBe(true);
    });

    it('rejects a high-value withdrawal when 2FA is not enabled (before reserving)', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'auth1', is2FAEnabled: false });
      await expect(
        service.initiateWithdrawal('u1', 'auth1', { ...baseDto, amount: 600 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ledger.reserve).not.toHaveBeenCalled();
    });

    it('rejects a high-value withdrawal with an invalid 2FA token', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'auth1', is2FAEnabled: true });
      mfa.verifyToken.mockResolvedValue(false);
      await expect(
        service.initiateWithdrawal('u1', 'auth1', {
          ...baseDto,
          amount: 600,
          twoFactorToken: 'wrong',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ledger.reserve).not.toHaveBeenCalled();
    });

    it('rejects an invalid destination address before reserving', async () => {
      broadcasters.isValidAddress.mockReturnValue(false);
      await expect(
        service.initiateWithdrawal('u1', 'auth1', baseDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ledger.reserve).not.toHaveBeenCalled();
    });

    it('releases the reservation if persisting the request fails', async () => {
      withdrawalRepo.save.mockRejectedValueOnce(new Error('db down'));
      await expect(
        service.initiateWithdrawal('u1', 'auth1', baseDto),
      ).rejects.toThrow('db down');
      expect(ledger.reserve).toHaveBeenCalled();
      expect(ledger.release).toHaveBeenCalled();
    });
  });

  describe('approveWithdrawal', () => {
    it('moves PENDING_APPROVAL → QUEUED with valid admin 2FA', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'admin1', is2FAEnabled: true });
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        userId: 'u1',
        asset: 'USDC',
        amount: 1500,
        status: WithdrawalStatus.PENDING_APPROVAL,
      });
      const w = await service.approveWithdrawal('admin1', 'w1', '123456');
      expect(w.status).toBe(WithdrawalStatus.QUEUED);
      expect(w.approvedBy).toBe('admin1');
    });

    it('refuses to approve a withdrawal not awaiting approval', async () => {
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        status: WithdrawalStatus.QUEUED,
      });
      await expect(
        service.approveWithdrawal('admin1', 'w1', '123456'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('rejectWithdrawal', () => {
    it('moves PENDING_APPROVAL → REJECTED and releases the reservation', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'admin1', is2FAEnabled: true });
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        userId: 'u1',
        asset: 'USDC',
        amount: 1500,
        status: WithdrawalStatus.PENDING_APPROVAL,
      });
      const w = await service.rejectWithdrawal('admin1', 'w1', 'suspicious', '123456');
      expect(ledger.release).toHaveBeenCalledWith(
        'u1',
        'USDC',
        1500,
        expect.objectContaining({ referenceType: 'withdrawal' }),
      );
      expect(w.status).toBe(WithdrawalStatus.REJECTED);
      expect(w.rejectedReason).toBe('suspicious');
    });
  });

  describe('cancelWithdrawal', () => {
    it('cancels a QUEUED withdrawal and releases the reservation', async () => {
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        userId: 'u1',
        asset: 'USDC',
        amount: 100,
        status: WithdrawalStatus.QUEUED,
      });
      const w = await service.cancelWithdrawal('u1', 'w1');
      expect(ledger.release).toHaveBeenCalled();
      expect(w.status).toBe(WithdrawalStatus.CANCELLED);
    });

    it('refuses to cancel a withdrawal already SENT', async () => {
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        userId: 'u1',
        asset: 'USDC',
        amount: 100,
        status: WithdrawalStatus.SENT,
      });
      await expect(service.cancelWithdrawal('u1', 'w1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(ledger.release).not.toHaveBeenCalled();
    });

    it('does not reveal another user’s withdrawal', async () => {
      withdrawalRepo.findOne.mockResolvedValue({
        id: 'w1',
        userId: 'someone-else',
        status: WithdrawalStatus.QUEUED,
      });
      await expect(service.cancelWithdrawal('u1', 'w1')).rejects.toThrow();
    });
  });
});

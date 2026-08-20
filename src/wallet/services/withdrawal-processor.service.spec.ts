import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WithdrawalProcessorService } from './withdrawal-processor.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { BroadcasterRegistry } from './broadcasters/broadcaster.registry';
import { WithdrawalRequest } from '../entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../enums/withdrawal-status.enum';
import { BlockchainNetwork } from '../../blockchain/entities/blockchain-transaction.entity';

describe('WithdrawalProcessorService', () => {
  let service: WithdrawalProcessorService;
  let withdrawalRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
  };
  let ledger: { debitReserved: jest.Mock; release: jest.Mock };
  let broadcaster: { send: jest.Mock; getConfirmations: jest.Mock };
  let broadcasters: { resolve: jest.Mock };
  let events: { emit: jest.Mock };

  const queuedRow = (): WithdrawalRequest =>
    ({
      id: 'w1',
      userId: 'u1',
      network: BlockchainNetwork.STELLAR,
      asset: 'USDC',
      amount: '100',
      toAddress: 'GDEST',
      status: WithdrawalStatus.PROCESSING,
      attempts: 0,
    }) as unknown as WithdrawalRequest;

  const sentRow = (
    network: BlockchainNetwork,
  ): WithdrawalRequest =>
    ({
      id: 'w1',
      userId: 'u1',
      network,
      asset: 'USDC',
      amount: '100',
      toAddress: 'GDEST',
      status: WithdrawalStatus.SENT,
      txHash: '0xsent',
      confirmations: 0,
      attempts: 1,
    }) as unknown as WithdrawalRequest;

  beforeEach(async () => {
    withdrawalRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn((r) => Promise.resolve(r)),
    };
    ledger = {
      debitReserved: jest
        .fn()
        .mockResolvedValue({ available: 0, reserved: 0, total: 0 }),
      release: jest
        .fn()
        .mockResolvedValue({ available: 100, reserved: 0, total: 100 }),
    };
    broadcaster = {
      send: jest
        .fn()
        .mockResolvedValue({ txHash: '0xabc', blockchainTxId: 'bt1' }),
      getConfirmations: jest.fn(),
    };
    broadcasters = { resolve: jest.fn().mockReturnValue(broadcaster) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalProcessorService,
        { provide: getRepositoryToken(WithdrawalRequest), useValue: withdrawalRepo },
        { provide: WalletLedgerService, useValue: ledger },
        { provide: BroadcasterRegistry, useValue: broadcasters },
        { provide: EventEmitter2, useValue: events },
        { provide: ConfigService, useValue: { get: jest.fn((_k, d) => d) } },
      ],
    }).compile();

    service = module.get(WithdrawalProcessorService);
  });

  describe('processQueued', () => {
    it('claims a queued row and broadcasts it → SENT', async () => {
      withdrawalRepo.find.mockResolvedValue([queuedRow()]);
      withdrawalRepo.findOne.mockResolvedValue(queuedRow());

      await service.processQueued();

      // Atomic claim: conditional update from QUEUED → PROCESSING.
      expect(withdrawalRepo.update).toHaveBeenCalledWith(
        { id: 'w1', status: WithdrawalStatus.QUEUED },
        { status: WithdrawalStatus.PROCESSING },
      );
      expect(broadcaster.send).toHaveBeenCalledTimes(1);
      const saved = withdrawalRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(WithdrawalStatus.SENT);
      expect(saved.txHash).toBe('0xabc');
      expect(events.emit).toHaveBeenCalledWith(
        'wallet.withdrawal.sent',
        expect.any(Object),
      );
    });

    it('does not broadcast when another tick already claimed the row', async () => {
      withdrawalRepo.find.mockResolvedValue([queuedRow()]);
      withdrawalRepo.update.mockResolvedValue({ affected: 0 }); // lost the claim

      await service.processQueued();

      expect(broadcaster.send).not.toHaveBeenCalled();
    });

    it('marks a failed broadcast FAILED and releases the reservation', async () => {
      withdrawalRepo.find.mockResolvedValue([queuedRow()]);
      withdrawalRepo.findOne.mockResolvedValue(queuedRow());
      broadcaster.send.mockRejectedValue(new Error('rpc down'));

      await service.processQueued();

      const saved = withdrawalRepo.save.mock.calls[0][0];
      expect(saved.status).toBe(WithdrawalStatus.FAILED);
      expect(saved.errorMessage).toContain('rpc down');
      expect(ledger.release).toHaveBeenCalledWith(
        'u1',
        'USDC',
        100,
        expect.objectContaining({ referenceType: 'withdrawal' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'wallet.withdrawal.failed',
        expect.any(Object),
      );
    });
  });

  describe('confirmSent', () => {
    it('debits the reservation once and completes when confirmations are met', async () => {
      // Stellar threshold is 1.
      withdrawalRepo.find.mockResolvedValue([sentRow(BlockchainNetwork.STELLAR)]);
      broadcaster.getConfirmations.mockResolvedValue(1);

      await service.confirmSent();

      expect(ledger.debitReserved).toHaveBeenCalledWith(
        'u1',
        'USDC',
        100,
        expect.objectContaining({ idempotencyKey: 'withdrawal-debit:w1' }),
      );
      expect(withdrawalRepo.update).toHaveBeenCalledWith(
        { id: 'w1', status: WithdrawalStatus.SENT },
        { status: WithdrawalStatus.COMPLETED, confirmations: 1 },
      );
      expect(events.emit).toHaveBeenCalledWith(
        'wallet.withdrawal.completed',
        expect.any(Object),
      );
    });

    it('waits (no debit) while below the confirmation threshold', async () => {
      // Ethereum threshold is 12; only 3 seen so far.
      withdrawalRepo.find.mockResolvedValue([sentRow(BlockchainNetwork.ETHEREUM)]);
      broadcaster.getConfirmations.mockResolvedValue(3);

      await service.confirmSent();

      expect(ledger.debitReserved).not.toHaveBeenCalled();
      const saved = withdrawalRepo.save.mock.calls[0][0];
      expect(saved.confirmations).toBe(3);
      expect(saved.status).toBe(WithdrawalStatus.SENT);
    });
  });
});

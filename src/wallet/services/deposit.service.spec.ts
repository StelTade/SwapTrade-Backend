import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DepositService } from './deposit.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { StellarService } from '../../blockchain/services/stellar.service';
import { EthereumService } from '../../blockchain/services/ethereum.service';
import {
  BlockchainTransaction,
  BlockchainNetwork,
  TransactionType,
  TransactionStatus,
} from '../../blockchain/entities/blockchain-transaction.entity';

describe('DepositService', () => {
  let service: DepositService;
  let stellar: { verifyDeposit: jest.Mock; getOrCreateWallet: jest.Mock };
  let ethereum: { verifyDeposit: jest.Mock; getOrCreateWallet: jest.Mock };
  let ledger: { credit: jest.Mock };
  let events: { emit: jest.Mock };
  let txRepo: { find: jest.Mock };

  const confirmedStellarTx = (): BlockchainTransaction =>
    ({
      id: 'tx-row-1',
      userId: 'u1',
      network: BlockchainNetwork.STELLAR,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.CONFIRMED,
      txHash: 'tx1',
      amount: '100',
      asset: 'USDC',
    }) as BlockchainTransaction;

  beforeEach(async () => {
    stellar = {
      verifyDeposit: jest.fn(),
      getOrCreateWallet: jest.fn(),
    };
    ethereum = {
      verifyDeposit: jest.fn(),
      getOrCreateWallet: jest.fn(),
    };
    ledger = {
      credit: jest
        .fn()
        .mockResolvedValue({ available: 100, reserved: 0, total: 100 }),
    };
    events = { emit: jest.fn() };
    txRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepositService,
        { provide: StellarService, useValue: stellar },
        { provide: EthereumService, useValue: ethereum },
        { provide: WalletLedgerService, useValue: ledger },
        { provide: EventEmitter2, useValue: events },
        { provide: getRepositoryToken(BlockchainTransaction), useValue: txRepo },
      ],
    }).compile();

    service = module.get(DepositService);
  });

  it('credits a confirmed Stellar deposit exactly once with an idempotency key', async () => {
    stellar.verifyDeposit.mockResolvedValue(confirmedStellarTx());

    const result = await service.verifyAndCreditDeposit(
      'u1',
      BlockchainNetwork.STELLAR,
      'tx1',
    );

    expect(stellar.verifyDeposit).toHaveBeenCalledWith('u1', 'tx1');
    expect(ledger.credit).toHaveBeenCalledTimes(1);
    expect(ledger.credit).toHaveBeenCalledWith(
      'u1',
      'USDC',
      100,
      expect.objectContaining({ idempotencyKey: 'deposit:stellar:tx1' }),
    );
    expect(result.credited).toBe(true);
    expect(events.emit).toHaveBeenCalledWith(
      'wallet.deposit.credited',
      expect.any(Object),
    );
  });

  it('does not credit a deposit that is still pending', async () => {
    stellar.verifyDeposit.mockResolvedValue({
      ...confirmedStellarTx(),
      status: TransactionStatus.PENDING,
    });

    const result = await service.verifyAndCreditDeposit(
      'u1',
      BlockchainNetwork.STELLAR,
      'tx1',
    );

    expect(ledger.credit).not.toHaveBeenCalled();
    expect(result.credited).toBe(false);
  });

  it('routes EVM deposits through the Ethereum connector with the network', async () => {
    ethereum.verifyDeposit.mockResolvedValue({
      id: 'tx-row-2',
      userId: 'u1',
      network: BlockchainNetwork.ETHEREUM,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.CONFIRMED,
      txHash: '0xdead',
      amount: '250',
      asset: 'USDC',
    });

    const result = await service.verifyAndCreditDeposit(
      'u1',
      BlockchainNetwork.ETHEREUM,
      '0xdead',
    );

    expect(ethereum.verifyDeposit).toHaveBeenCalledWith(
      'u1',
      '0xdead',
      BlockchainNetwork.ETHEREUM,
    );
    expect(ledger.credit).toHaveBeenCalledWith(
      'u1',
      'USDC',
      250,
      expect.objectContaining({ idempotencyKey: 'deposit:ethereum:0xdead' }),
    );
    expect(result.credited).toBe(true);
  });

  it('routes BSC deposits through the Ethereum (EVM) connector', async () => {
    ethereum.verifyDeposit.mockResolvedValue({
      id: 'tx-row-3',
      userId: 'u1',
      network: BlockchainNetwork.BSC,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      txHash: '0xbsc',
      amount: '10',
      asset: 'USDC',
    });

    await service.verifyAndCreditDeposit('u1', BlockchainNetwork.BSC, '0xbsc');

    expect(ethereum.verifyDeposit).toHaveBeenCalledWith(
      'u1',
      '0xbsc',
      BlockchainNetwork.BSC,
    );
    expect(ledger.credit).not.toHaveBeenCalled();
  });
});

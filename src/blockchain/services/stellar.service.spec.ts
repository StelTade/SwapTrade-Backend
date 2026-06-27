import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { StellarService } from './stellar.service';
import {
  BlockchainTransaction,
  BlockchainNetwork,
  TransactionType,
  TransactionStatus,
} from '../entities/blockchain-transaction.entity';
import { WalletAddress } from '../entities/wallet-address.entity';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';

// Mock stellar-sdk at module level
jest.mock('stellar-sdk', () => {
  const mockKeypair = {
    publicKey: () => 'GTEST_PUBLIC_KEY',
    secret: () => 'STEST_SECRET_KEY',
  };
  return {
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        transactions: () => ({
          transaction: () => ({
            call: jest.fn().mockResolvedValue({ ledger_attr: 1, memo: '' }),
          }),
        }),
        operations: () => ({
          forTransaction: () => ({
            call: jest.fn().mockResolvedValue({
              records: [
                {
                  type: 'payment',
                  to: 'GTEST_PUBLIC_KEY',
                  from: 'GSENDER',
                  asset_code: 'USDC',
                  asset_issuer: 'GUSDC_ISSUER',
                  amount: '100.0000000',
                },
              ],
            }),
          }),
        }),
        ledgers: () => ({
          ledger: () => ({ call: jest.fn().mockResolvedValue({}) }),
        }),
        loadAccount: jest
          .fn()
          .mockResolvedValue({ id: 'GTEST_PUBLIC_KEY', sequence: '1' }),
        submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx_hash_123' }),
      })),
    },
    Keypair: {
      random: jest.fn().mockReturnValue(mockKeypair),
      fromSecret: jest.fn().mockReturnValue(mockKeypair),
    },
    Networks: { TESTNET: 'Test SDF Network ; September 2015' },
    BASE_FEE: '100',
    Asset: jest.fn().mockImplementation(() => ({})),
    Operation: {
      payment: jest.fn().mockReturnValue({}),
    },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      addMemo: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue({ sign: jest.fn() }),
    })),
    Memo: { text: jest.fn(), none: jest.fn() },
  };
});

const mockTxRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const mockWalletRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('StellarService', () => {
  let service: StellarService;
  let txRepo: jest.Mocked<Repository<BlockchainTransaction>>;
  let walletRepo: jest.Mocked<Repository<WalletAddress>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, def?: any) => {
              const config: Record<string, any> = {
                STELLAR_HORIZON_URL: 'https://horizon-testnet.stellar.org',
                STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
                STELLAR_USDC_ISSUER: 'GUSDC_ISSUER',
                STELLAR_PLATFORM_SECRET: 'STEST_SECRET_KEY',
              };
              return config[key] ?? def;
            }),
          },
        },
        {
          provide: getRepositoryToken(BlockchainTransaction),
          useFactory: mockTxRepo,
        },
        {
          provide: getRepositoryToken(WalletAddress),
          useFactory: mockWalletRepo,
        },
      ],
    }).compile();

    service = module.get(StellarService);
    txRepo = module.get(getRepositoryToken(BlockchainTransaction));
    walletRepo = module.get(getRepositoryToken(WalletAddress));
  });

  describe('getOrCreateWallet', () => {
    it('returns existing wallet if found', async () => {
      const existing = { id: '1', address: 'GEXISTING' } as WalletAddress;
      walletRepo.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreateWallet('user-1');
      expect(result).toBe(existing);
      expect(walletRepo.create).not.toHaveBeenCalled();
    });

    it('creates a new wallet when none exists', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const newWallet = {
        id: '2',
        address: 'GTEST_PUBLIC_KEY',
      } as WalletAddress;
      walletRepo.create.mockReturnValue(newWallet);
      walletRepo.save.mockResolvedValue(newWallet);

      const result = await service.getOrCreateWallet('user-1');
      expect(walletRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ network: BlockchainNetwork.STELLAR }),
      );
      expect(result).toBe(newWallet);
    });
  });

  describe('verifyDeposit', () => {
    const wallet = {
      id: 'w1',
      address: 'GTEST_PUBLIC_KEY',
      network: BlockchainNetwork.STELLAR,
    } as WalletAddress;

    it('returns existing record for duplicate txHash (idempotent)', async () => {
      const existing = { id: 'tx1', txHash: 'hash1' } as BlockchainTransaction;
      txRepo.findOne.mockResolvedValue(existing);

      const result = await service.verifyDeposit('user-1', 'hash1');
      expect(result).toBe(existing);
    });

    it('throws if no wallet found for user', async () => {
      txRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyDeposit('user-1', 'hash1')).rejects.toThrow(
        BlockchainException,
      );
    });

    it('creates a confirmed transaction for a valid USDC deposit', async () => {
      txRepo.findOne.mockResolvedValue(null);
      walletRepo.findOne.mockResolvedValue(wallet);
      const saved = {
        id: 'tx2',
        status: TransactionStatus.CONFIRMED,
      } as BlockchainTransaction;
      txRepo.create.mockReturnValue(saved);
      txRepo.save.mockResolvedValue(saved);

      const result = await service.verifyDeposit('user-1', 'somehash');
      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          network: BlockchainNetwork.STELLAR,
          type: TransactionType.DEPOSIT,
          asset: 'USDC',
        }),
      );
      expect(result).toBe(saved);
    });
  });

  describe('withdraw', () => {
    const wallet = { id: 'w1', address: 'GTEST_PUBLIC_KEY' } as WalletAddress;

    it('throws if no wallet found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.withdraw('user-1', 'GDEST', '10', undefined),
      ).rejects.toThrow(BlockchainException);
    });

    it('saves a confirmed withdrawal on success', async () => {
      walletRepo.findOne.mockResolvedValue(wallet);
      const pending = {
        id: 'tx3',
        status: TransactionStatus.PENDING,
        txHash: undefined,
      } as unknown as BlockchainTransaction;
      txRepo.create.mockReturnValue(pending);
      txRepo.save.mockResolvedValue({
        ...pending,
        status: TransactionStatus.CONFIRMED,
        txHash: 'tx_hash_123',
      });

      const result = await service.withdraw('user-1', 'GDEST', '50');
      expect(result.status).toBe(TransactionStatus.CONFIRMED);
    });
  });
});

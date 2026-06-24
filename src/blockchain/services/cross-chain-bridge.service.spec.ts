import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CrossChainBridgeService } from './cross-chain-bridge.service';
import { CrossChainBridge, BridgeStatus } from '../entities/cross-chain-bridge.entity';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';
import { StellarService } from './stellar.service';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';

const mockBridgeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockStellarService = () => ({
  withdraw: jest.fn(),
});

describe('CrossChainBridgeService', () => {
  let service: CrossChainBridgeService;
  let bridgeRepo: ReturnType<typeof mockBridgeRepo>;
  let stellarService: jest.Mocked<StellarService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossChainBridgeService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(2) },
        },
        { provide: getRepositoryToken(CrossChainBridge), useFactory: mockBridgeRepo },
        { provide: StellarService, useFactory: mockStellarService },
      ],
    }).compile();

    service = module.get(CrossChainBridgeService);
    bridgeRepo = module.get(getRepositoryToken(CrossChainBridge));
    stellarService = module.get(StellarService) as jest.Mocked<StellarService>;
  });

  describe('initiateBridge', () => {
    it('creates and saves a bridge record', async () => {
      const bridge = { id: 'b1', status: BridgeStatus.INITIATED } as CrossChainBridge;
      bridgeRepo.create.mockReturnValue(bridge);
      bridgeRepo.save.mockResolvedValue(bridge);

      const result = await service.initiateBridge(
        'user-1',
        BlockchainNetwork.ETHEREUM,
        BlockchainNetwork.STELLAR,
        '0xABC',
        'GDEST',
        '100',
      );

      expect(bridgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BridgeStatus.INITIATED,
          multisigThreshold: 2,
        }),
      );
      expect(result).toBe(bridge);
    });
  });

  describe('addApproval', () => {
    it('throws if bridge not found', async () => {
      bridgeRepo.findOne.mockResolvedValue(null);
      await expect(service.addApproval('missing-id')).rejects.toThrow(BlockchainException);
    });

    it('increments approval count without executing when below threshold', async () => {
      const bridge = {
        id: 'b1',
        status: BridgeStatus.INITIATED,
        multisigApprovals: 0,
        multisigThreshold: 2,
      } as CrossChainBridge;
      bridgeRepo.findOne.mockResolvedValue(bridge);
      bridgeRepo.save.mockResolvedValue({ ...bridge, multisigApprovals: 1 });

      const result = await service.addApproval('b1');
      expect(result.multisigApprovals).toBe(1);
      expect(bridgeRepo.save).toHaveBeenCalledTimes(1);
    });

    it('executes bridge when threshold is reached', async () => {
      const bridge = {
        id: 'b1',
        userId: 'user-1',
        status: BridgeStatus.INITIATED,
        multisigApprovals: 1,
        multisigThreshold: 2,
        destinationNetwork: BlockchainNetwork.STELLAR,
        destinationAddress: 'GDEST',
        sourceAddress: 'GSRC',
        amount: '50',
      } as CrossChainBridge;
      bridgeRepo.findOne.mockResolvedValue(bridge);
      bridgeRepo.save.mockImplementation(async (b) => b as CrossChainBridge);
      stellarService.withdraw.mockResolvedValue({ txHash: 'tx_hash' } as any);

      const result = await service.addApproval('b1');
      expect(stellarService.withdraw).toHaveBeenCalled();
      expect(result.status).toBe(BridgeStatus.COMPLETED);
    });

    it('refunds on bridge execution failure', async () => {
      const bridge = {
        id: 'b1',
        userId: 'user-1',
        status: BridgeStatus.INITIATED,
        multisigApprovals: 1,
        multisigThreshold: 2,
        destinationNetwork: BlockchainNetwork.STELLAR,
        destinationAddress: 'GDEST',
        sourceAddress: 'GSRC',
        sourceNetwork: BlockchainNetwork.ETHEREUM,
        amount: '50',
      } as CrossChainBridge;
      bridgeRepo.findOne.mockResolvedValue(bridge);
      bridgeRepo.save.mockImplementation(async (b) => b as CrossChainBridge);
      stellarService.withdraw.mockRejectedValue(new Error('network error'));

      await expect(service.addApproval('b1')).rejects.toThrow(BlockchainException);
    });
  });

  describe('getBridgeHealth', () => {
    it('returns healthy when locked amount is below threshold', async () => {
      bridgeRepo.count.mockResolvedValue(1);
      bridgeRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
      });

      const result = await service.getBridgeHealth();
      expect(result.healthy).toBe(true);
      expect(result.alertMessage).toBeUndefined();
    });

    it('returns unhealthy when locked amount exceeds threshold', async () => {
      bridgeRepo.count.mockResolvedValue(5);
      bridgeRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '15000' }),
      });

      const result = await service.getBridgeHealth();
      expect(result.healthy).toBe(false);
      expect(result.alertMessage).toContain('15000');
    });
  });
});

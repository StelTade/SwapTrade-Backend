import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserBalance } from '../balance/user-balance.entity';

describe('UserService - Portfolio Tracking', () => {
    let service: UserService;
    let mockRepository: any;

    beforeEach(async () => {
        mockRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(UserBalance),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    it('should return portfolio stats for a user', async () => {
        const mockBalances = [
            {
                id: 'balance-uuid-1',
                userId: '123e4567-e89b-12d3-a456-426614174000',
                assetId: 'asset-uuid-btc',
                asset: { name: 'BTC', symbol: 'BTC' },
                amount: 1.5,
                totalTrades: 10,
                cumulativePnL: 1000,
                totalTradeVolume: 50000,
                lastTradeDate: new Date(),
            },
        ];

        mockRepository.find.mockResolvedValue(mockBalances);

        const result = await service.getPortfolioStats('123e4567-e89b-12d3-a456-426614174000');

        expect(result.totalTrades).toBe(10);
        expect(result.cumulativePnL).toBe(1000);
    });

    it('should update portfolio after trade', async () => {
        const mockBalance = {
            id: 'balance-uuid-1',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            assetId: 'asset-uuid-btc',
            amount: 1.5,
            totalTrades: 10,
            cumulativePnL: 1000,
            totalTradeVolume: 50000,
        };

        mockRepository.findOne.mockResolvedValue(mockBalance);
        mockRepository.save.mockResolvedValue({ ...mockBalance, totalTrades: 11 });

        await service.updatePortfolioAfterTrade(
            '123e4567-e89b-12d3-a456-426614174000',
            'asset-uuid-btc',
            5000,
            100,
        );

        expect(mockRepository.save).toHaveBeenCalled();
    });
});
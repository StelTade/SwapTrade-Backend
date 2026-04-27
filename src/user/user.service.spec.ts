import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from './entities/user.entity';

describe('UserService - Portfolio Tracking', () => {
    let service: UserService;
    let mockRepository: any;
    let mockUserRepository: any;

    beforeEach(async () => {
        mockRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
        };
        mockUserRepository = {
            findOne: jest.fn(),
            save: jest.fn(async (value) => value),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserService,
                {
                    provide: getRepositoryToken(UserBalance),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: mockUserRepository,
                },
            ],
        }).compile();

        service = module.get<UserService>(UserService);
    });

    it('should return portfolio stats for a user', async () => {
        const mockBalances = [
            {
                id: 'balance-uuid-1',
                userId: 123,
                assetId: 1,
                asset: { name: 'BTC', symbol: 'BTC' },
                balance: 1.5,
                totalTrades: 10,
                cumulativePnL: 1000,
                totalTradeVolume: 50000,
                lastTradeDate: new Date(),
            },
        ];

        mockRepository.find.mockResolvedValue(mockBalances);

        const result = await service.getPortfolioStats(123);

        expect(result.totalTrades).toBe(10);
        expect(result.cumulativePnL).toBe(1000);
    });

    it('should update portfolio after trade', async () => {
        const mockBalance = {
            id: 'balance-uuid-1',
            userId: 123,
            assetId: 1,
            balance: 1.5,
            totalTrades: 10,
            cumulativePnL: 1000,
            totalTradeVolume: 50000,
        };

        mockRepository.findOne.mockResolvedValue(mockBalance);
        mockRepository.save.mockResolvedValue({ ...mockBalance, totalTrades: 11 });

        await service.updatePortfolioAfterTrade(
            123,
            1,
            5000,
            100,
        );

        expect(mockRepository.save).toHaveBeenCalled();
    });

    it('rejects assigning governance and KYC roles to the same user', () => {
        expect(() =>
            service.validateRoleAssignment([
                UserRole.GOVERNANCE_OPERATOR,
                UserRole.KYC_OPERATOR,
            ]),
        ).toThrow(BadRequestException);
    });

    it('assigns a single security role', async () => {
        mockUserRepository.findOne.mockResolvedValue({
            id: 1,
            role: UserRole.USER,
            roles: [UserRole.USER],
        });

        const updated = await service.assignRoles(1, [UserRole.GOVERNANCE_OPERATOR]);

        expect(updated.roles).toEqual([UserRole.GOVERNANCE_OPERATOR]);
        expect(updated.role).toBe(UserRole.GOVERNANCE_OPERATOR);
        expect(mockUserRepository.save).toHaveBeenCalledWith(updated);
    });
});

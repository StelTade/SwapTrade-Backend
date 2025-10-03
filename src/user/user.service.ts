import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBalance } from '../balance/user-balance.entity';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserBalance)
        private readonly userBalanceRepository: Repository<UserBalance>,
    ) { }

    async getPortfolioStats(userId: string): Promise<PortfolioStatsDto> {
        const userBalances = await this.userBalanceRepository.find({
            where: { userId },
        });

        if (!userBalances || userBalances.length === 0) {
            throw new NotFoundException(`Portfolio not found for user ${userId}`);
        }

        const totalTrades = userBalances.reduce(
            (sum, balance) => sum + (balance.totalTrades || 0),
            0,
        );
        const cumulativePnL = userBalances.reduce(
            (sum, balance) => sum + Number(balance.cumulativePnL || 0),
            0,
        );
        const totalTradeVolume = userBalances.reduce(
            (sum, balance) => sum + Number(balance.totalTradeVolume || 0),
            0,
        );

        const lastTradeDate = userBalances.reduce((latest: Date | null, balance) => {
            if (!latest || (balance.lastTradeDate && balance.lastTradeDate > latest)) {
                return balance.lastTradeDate;
            }
            return latest;
        }, null as Date | null);

        const portfolioStats: PortfolioStatsDto = {
            userId,
            totalTrades,
            cumulativePnL,
            totalTradeVolume,
            lastTradeDate,
            currentBalances: userBalances.map((balance) => ({
                asset: balance.asset?.name || balance.assetId,
                amount: Number(balance.amount),
                trades: balance.totalTrades,
                pnl: Number(balance.cumulativePnL),
            })),
        };

        return portfolioStats;
    }

    async updatePortfolioAfterTrade(
        userId: string,
        assetId: string,
        tradeValue: number,
        pnl: number,
    ): Promise<void> {
        let userBalance = await this.userBalanceRepository.findOne({
            where: { userId, assetId },
        });

        if (!userBalance) {
            userBalance = this.userBalanceRepository.create({
                userId,
                assetId,
                amount: 0,
                totalTrades: 0,
                cumulativePnL: 0,
                totalTradeVolume: 0,
            });
        }

        userBalance.totalTrades += 1;
        userBalance.cumulativePnL = Number(userBalance.cumulativePnL) + pnl;
        userBalance.totalTradeVolume =
            Number(userBalance.totalTradeVolume) + Math.abs(tradeValue);
        userBalance.lastTradeDate = new Date();

        await this.userBalanceRepository.save(userBalance);
    }

    async getUserBalance(userId: string, assetId: string): Promise<UserBalance | null> {
        return this.userBalanceRepository.findOne({
            where: { userId, assetId },
        });
    }

    async updateBalance(
        userId: string,
        assetId: string,
        amount: number,
    ): Promise<void> {
        let userBalance = await this.userBalanceRepository.findOne({
            where: { userId, assetId },
        });

        if (!userBalance) {
            userBalance = this.userBalanceRepository.create({
                userId,
                assetId,
                amount: 0,
                totalTrades: 0,
                cumulativePnL: 0,
                totalTradeVolume: 0,
            });
        }

        userBalance.amount = Number(userBalance.amount) + amount;
        await this.userBalanceRepository.save(userBalance);
    }
}
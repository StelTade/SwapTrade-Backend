import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(UserBalance)
        private readonly userBalanceRepository: Repository<UserBalance>,
    ) { }

    async getPortfolioStats(userId: number): Promise<PortfolioStatsDto> {
        const userBalances = await this.userBalanceRepository.find({
            where: { userId },
            relations: ['asset'], // Eager load virtual asset
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
                asset: balance.asset?.name || String(balance.assetId),
                amount: Number(balance.balance),
                trades: balance.totalTrades,
                pnl: Number(balance.cumulativePnL),
            })),
        };

        return portfolioStats;
    }

    async updatePortfolioAfterTrade(
        userId: number,
        assetId: number,
        tradeValue: number,
        pnl: number,
    ): Promise<void> {
        let userBalance = await this.userBalanceRepository.findOne({
            where: { userId, assetId },
            relations: ['asset'], // Eager load virtual asset
        });

        if (!userBalance) {
            userBalance = this.userBalanceRepository.create({
                userId,
                assetId,
                balance: 0,
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

    async getUserBalance(userId: number, assetId: number): Promise<UserBalance | null> {
        return this.userBalanceRepository.findOne({
            where: { userId, assetId },
            relations: ['asset'], // Eager load virtual asset
        });
    }

    async updateBalance(
        userId: number,
        assetId: number,
        amount: number,
    ): Promise<void> {
        let userBalance = await this.userBalanceRepository.findOne({
            where: { userId, assetId },
            relations: ['asset'], // Eager load virtual asset
        });

        if (!userBalance) {
            userBalance = this.userBalanceRepository.create({
                userId,
                assetId,
                balance: 0,
                totalTrades: 0,
                cumulativePnL: 0,
                totalTradeVolume: 0,
                totalInvested: 0,
                averageBuyPrice: 0,
            });
        }

        userBalance.balance = Number(userBalance.balance) + amount;
        await this.userBalanceRepository.save(userBalance);
    }
}
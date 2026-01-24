import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateBidDto } from './dto/create-bid.dto';
import { CacheService } from '../common/services/cache.service';
import { BidErrors } from './errors/bid-errors';
import { BalanceService } from 'src/balance/balance.service';
import { Bid } from './entities/bid.entity';

@Injectable()
export class BiddingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cacheService: CacheService,
    private readonly balanceService: BalanceService,
  ) {}

 async createBid(
  userId: string,
  dto: CreateBidDto,
) {
  return this.dataSource.transaction(async (manager) => {
    // Re-validate inside transaction
    const balance = await this.balanceService.getAvailableBalance(
      userId,
      manager,
    );

    const totalCost = dto.amount * dto.price;
    if (balance < totalCost) {
      throw new BadRequestException(BidErrors.INSUFFICIENT_BALANCE);
    }

    // Reserve funds
    await this.balanceService.reserveFunds(
      userId,
      totalCost,
      'bid_reserve',
      manager,
    );

    try {
      const bid = manager.create(Bid, {
        userId: parseInt(userId),
        asset: dto.assetId,
        amount: dto.amount,
        status: 'PENDING',
      });

      return await manager.save(bid);
    } catch (err) {
      // Rollback reservation if bid fails
      await this.balanceService.releaseFunds(
        userId,
        totalCost,
        'bid_rollback',
        manager,
      );
      throw err;
    }
  });
}


  public async validateBid(userId: string, dto: CreateBidDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException(BidErrors.INVALID_AMOUNT);
    }

    // TODO: Add assetService dependency when available
    // const asset = await this.assetService.findById(dto.assetId);
    // if (!asset) {
    //   throw new NotFoundException(BidErrors.ASSET_NOT_FOUND);
    // }

    const balance = await this.balanceService.getAvailableBalance(userId);
    const totalCost = dto.amount * dto.price;

    if (balance < totalCost) {
      throw new BadRequestException(BidErrors.INSUFFICIENT_BALANCE);
    }

    return { totalCost };
  }
}

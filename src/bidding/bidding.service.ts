import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateBidDto } from './dto/create-bid.dto';
import { CacheService } from '../common/services/cache.service';
import { BidErrors } from './errors/bid-errors';
import { BalanceService } from '../balance/balance.service';
import { Bid } from './entities/bid.entity';
import { Auction, AuctionStatus } from './entities/auction.entity';
import { AuctionTimerService } from './auction/auction-timer.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BidPlacedPayload } from './dto/ws-events.dto';

export const BID_PLACED_INTERNAL_EVENT = 'bid.placed.internal';

export interface PlaceBidResult {
  bid: Bid;
  auction: Auction;
  wasExtended: boolean;
  newMinBid: number;
}

@Injectable()
export class BiddingService {
  private readonly logger = new Logger(BiddingService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    private readonly cacheService: CacheService,
    private readonly balanceService: BalanceService,
    private readonly timerService: AuctionTimerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Core bid placement
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validates, reserves funds, and records a bid atomically.
   * Emits BID_PLACED_INTERNAL_EVENT so the gateway can broadcast.
   */
  async placeBid(
    userId: string,
    auctionId: string,
    amount: number,
    clientToken?: string,
  ): Promise<PlaceBidResult> {
    if (amount <= 0) {
      throw new BadRequestException(BidErrors.INVALID_AMOUNT);
    }

    const result = await this.dataSource.transaction(async (manager) => {
      // Lock auction row to prevent concurrent bid races
      const auction = await manager.findOne(Auction, {
        where: { id: auctionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!auction) {
        throw new NotFoundException(`Auction ${auctionId} not found`);
      }

      this.validateAuctionAcceptssBids(auction);

      // Enforce minimum bid increment
      const minRequired = this.getMinBid(auction);
      if (amount < minRequired) {
        throw new BadRequestException(
          `Bid must be at least ${minRequired} (current: ${auction.currentHighestBid ?? auction.startingPrice} + increment: ${auction.minBidIncrement})`,
        );
      }

      // Validate and reserve balance
      const balance = await this.balanceService.getAvailableBalance(
        userId,
        manager,
      );

      if (balance < amount) {
        throw new BadRequestException(BidErrors.INSUFFICIENT_BALANCE);
      }

      await this.balanceService.reserveFunds(
        userId,
        amount,
        `bid_reserve_auction_${auctionId}`,
        manager,
      );

      // Release previous reservation from same user if they outbid themselves
      const previousBid = await manager.findOne(Bid, {
        where: { userId: parseInt(userId), auctionId },
        order: { createdAt: 'DESC' } as any,
      });

      if (previousBid) {
        const prevAmount = Number(previousBid.amount);
        // Release the old reservation (new one is already placed above)
        await this.balanceService.releaseFunds(
          userId,
          prevAmount,
          `bid_superseded_auction_${auctionId}`,
          manager,
        );
      }

      // Persist the bid
      const bid = manager.create(Bid, {
        userId: parseInt(userId),
        auctionId,
        asset: auction.assetId,
        amount,
        status: 'ACTIVE',
      });

      const savedBid = await manager.save(bid);

      // Update auction's denormalised highest-bid fields
      await manager.update(Auction, auctionId, {
        currentHighestBid: amount,
        currentHighestBidderId: userId,
        bidCount: () => '"bidCount" + 1',
      });

      auction.currentHighestBid = amount;
      auction.currentHighestBidderId = userId;
      auction.bidCount++;

      return { bid: savedBid, auction };
    });

    // Anti-sniping check (outside transaction — reads updated endsAt)
    const wasExtended = await this.timerService.extendIfAntiSnipe(auctionId);

    // Invalidate state cache so next read reflects new highest bid
    await this.cacheService.del(`auction:state:${auctionId}`);
    await this.cacheService.invalidateBidRelatedCaches(userId, result.auction.assetId);

    const newMinBid = this.getMinBid(result.auction);

    // Emit internal event → gateway will broadcast over WebSocket
    this.eventEmitter.emit(BID_PLACED_INTERNAL_EVENT, {
      ...result,
      wasExtended,
      newMinBid,
      clientToken,
    });

    return { ...result, wasExtended, newMinBid };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy createBid (backward compatible — wraps placeBid)
  // ──────────────────────────────────────────────────────────────────────────

  async createBid(userId: string, dto: CreateBidDto) {
    return this.dataSource.transaction(async (manager) => {
      const balance = await this.balanceService.getAvailableBalance(userId, manager);
      const totalCost = dto.amount * dto.price;

      if (balance < totalCost) {
        throw new BadRequestException(BidErrors.INSUFFICIENT_BALANCE);
      }

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

  // ──────────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────────

  public async validateBid(userId: string, dto: CreateBidDto) {
    if (dto.amount <= 0) {
      throw new BadRequestException(BidErrors.INVALID_AMOUNT);
    }

    const balance = await this.balanceService.getAvailableBalance(userId);
    const totalCost = dto.amount * dto.price;

    if (balance < totalCost) {
      throw new BadRequestException(BidErrors.INSUFFICIENT_BALANCE);
    }

    return { totalCost };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  getMinBid(auction: Auction): number {
    if (!auction.currentHighestBid) return Number(auction.startingPrice);
    return Number(auction.currentHighestBid) + Number(auction.minBidIncrement);
  }

  private validateAuctionAcceptssBids(auction: Auction): void {
    if (
      auction.status !== AuctionStatus.ACTIVE &&
      auction.status !== AuctionStatus.ENDING
    ) {
      throw new BadRequestException(
        `Auction is not accepting bids (status: ${auction.status})`,
      );
    }

    if (auction.endsAt.getTime() <= Date.now()) {
      throw new BadRequestException('Auction has already ended');
    }
  }
}
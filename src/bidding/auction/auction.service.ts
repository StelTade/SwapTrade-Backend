import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Auction, AuctionStatus } from '../entities/auction.entity';
import { Bid } from '../entities/bid.entity';
import { AuctionTimerService, AUCTION_ENDED_EVENT } from './auction-timer.service';
import { BalanceService } from '../../balance/balance.service';
import { CacheService } from '../../common/services/cache.service';
import { AuctionStatePayload } from '../dto/ws-events.dto';

const AUCTION_STATE_CACHE_TTL = 5; // 5s — hot path cache

@Injectable()
export class AuctionService implements OnModuleInit {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    private readonly dataSource: DataSource,
    private readonly timerService: AuctionTimerService,
    private readonly balanceService: BalanceService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Resume timers for any active auctions on service restart.
   */
  async onModuleInit(): Promise<void> {
    const activeAuctions = await this.auctionRepo.find({
      where: [
        { status: AuctionStatus.ACTIVE },
        { status: AuctionStatus.ENDING },
      ],
    });

    for (const auction of activeAuctions) {
      if (auction.endsAt.getTime() > Date.now()) {
        this.timerService.startTimer(auction);
        this.logger.log(`Resumed timer for auction ${auction.id}`);
      } else {
        // Ended while offline — mark immediately
        await this.auctionRepo.update(auction.id, { status: AuctionStatus.ENDED });
      }
    }

    this.logger.log(
      `Resumed ${activeAuctions.length} auction timers on startup`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Auction lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  async createAuction(dto: {
    assetId: string;
    title: string;
    description?: string;
    startingPrice: number;
    reservePrice?: number;
    minBidIncrement?: number;
    startsAt: Date;
    endsAt: Date;
    antiSnipingExtensionSeconds?: number;
  }): Promise<Auction> {
    if (dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    if (dto.startingPrice <= 0) {
      throw new BadRequestException('startingPrice must be positive');
    }

    const auction = this.auctionRepo.create({
      ...dto,
      reservePrice: dto.reservePrice ?? 0,
      minBidIncrement: dto.minBidIncrement ?? 1,
      status:
        dto.startsAt <= new Date()
          ? AuctionStatus.ACTIVE
          : AuctionStatus.SCHEDULED,
    });

    const saved = await this.auctionRepo.save(auction);

    if (saved.status === AuctionStatus.ACTIVE) {
      this.timerService.startTimer(saved);
    }

    this.logger.log(`Auction created: ${saved.id} (${saved.title})`);
    return saved;
  }

  async startAuction(auctionId: string): Promise<Auction> {
    const auction = await this.findOrThrow(auctionId);

    if (auction.status !== AuctionStatus.SCHEDULED) {
      throw new BadRequestException(
        `Cannot start auction in status: ${auction.status}`,
      );
    }

    await this.auctionRepo.update(auctionId, { status: AuctionStatus.ACTIVE });
    auction.status = AuctionStatus.ACTIVE;

    this.timerService.startTimer(auction);
    await this.invalidateStateCache(auctionId);

    return auction;
  }

  async cancelAuction(auctionId: string): Promise<void> {
    const auction = await this.findOrThrow(auctionId);

    if (
      auction.status === AuctionStatus.SETTLED ||
      auction.status === AuctionStatus.ENDED
    ) {
      throw new BadRequestException('Cannot cancel a completed auction');
    }

    this.timerService.stopTimer(auctionId);
    await this.auctionRepo.update(auctionId, {
      status: AuctionStatus.CANCELLED,
    });

    // Release reserved funds for all pending bids
    await this.releaseAllReservedFunds(auctionId);
    await this.invalidateStateCache(auctionId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Settlement (called when auction ends)
  // ──────────────────────────────────────────────────────────────────────────

  @OnEvent(AUCTION_ENDED_EVENT)
  async handleAuctionEnded(payload: {
    auctionId: string;
    auction: Auction;
  }): Promise<void> {
    const { auctionId } = payload;
    this.logger.log(`Settling auction ${auctionId}…`);

    try {
      await this.settleAuction(auctionId);
    } catch (err) {
      this.logger.error(
        `Failed to settle auction ${auctionId}: ${err.message}`,
      );
    }
  }

  async settleAuction(auctionId: string): Promise<Auction> {
    return this.dataSource.transaction(async (manager) => {
      const auction = await manager.findOne(Auction, {
        where: { id: auctionId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!auction) throw new NotFoundException(`Auction ${auctionId} not found`);

      if (
        auction.status === AuctionStatus.SETTLED ||
        auction.status === AuctionStatus.CANCELLED
      ) {
        return auction; // idempotent
      }

      const reserveMet =
        !auction.reservePrice ||
        (auction.currentHighestBid ?? 0) >= Number(auction.reservePrice);

      if (auction.currentHighestBidderId && reserveMet) {
        // Transfer winning bid funds (already reserved → finalize)
        await manager.update(Auction, auctionId, {
          status: AuctionStatus.SETTLED,
          winnerId: auction.currentHighestBidderId,
          winningBid: auction.currentHighestBid,
        });

        // Release losing bidders' reserved funds
        await this.releaseLosingBidReservations(
          auctionId,
          auction.currentHighestBidderId,
          manager,
        );

        this.logger.log(
          `Auction ${auctionId} settled. Winner: ${auction.currentHighestBidderId} at ${auction.currentHighestBid}`,
        );
      } else {
        // No valid winner — release all reservations
        await manager.update(Auction, auctionId, {
          status: AuctionStatus.SETTLED,
        });
        await this.releaseAllReservedFunds(auctionId);
        this.logger.log(
          `Auction ${auctionId} ended with no sale (reserve not met or no bids)`,
        );
      }

      await this.invalidateStateCache(auctionId);
      auction.status = AuctionStatus.SETTLED;
      return auction;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // State query
  // ──────────────────────────────────────────────────────────────────────────

  async getAuctionState(
    auctionId: string,
    participantCount = 0,
  ): Promise<AuctionStatePayload> {
    const cacheKey = `auction:state:${auctionId}`;
    const cached = await this.cacheService.get<AuctionStatePayload>(cacheKey);
    if (cached) return { ...cached, participantCount };

    const auction = await this.findOrThrow(auctionId);

    const state: AuctionStatePayload = {
      id: auction.id,
      assetId: auction.assetId,
      title: auction.title,
      status: auction.status,
      startingPrice: Number(auction.startingPrice),
      currentHighestBid: auction.currentHighestBid
        ? Number(auction.currentHighestBid)
        : null,
      currentHighestBidderId: auction.currentHighestBidderId,
      minBidIncrement: Number(auction.minBidIncrement),
      reserveMet:
        !auction.reservePrice ||
        (auction.currentHighestBid ?? 0) >= Number(auction.reservePrice),
      bidCount: auction.bidCount,
      startsAt: auction.startsAt.toISOString(),
      endsAt: auction.endsAt.toISOString(),
      extensionCount: auction.extensionCount,
      participantCount,
    };

    await this.cacheService.set(cacheKey, state, AUCTION_STATE_CACHE_TTL);
    return state;
  }

  async findOrThrow(auctionId: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });
    if (!auction) throw new NotFoundException(`Auction ${auctionId} not found`);
    return auction;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async releaseLosingBidReservations(
    auctionId: string,
    winnerId: string,
    manager: any,
  ): Promise<void> {
    const losingBids = await manager.find(Bid, {
      where: { auctionId },
    });

    const losers = losingBids.filter((b: any) => b.userId !== winnerId);
    const uniqueLoserIds = [...new Set(losers.map((b: any) => b.userId))];

    for (const loserId of uniqueLoserIds) {
      const loserBids = losers.filter((b: any) => b.userId === loserId);
      const maxBid = Math.max(
        ...loserBids.map((b: any) => Number(b.amount) * Number(b.price ?? 1)),
      );

      try {
        await this.balanceService.releaseFunds(
          String(loserId),
          maxBid,
          `auction_${auctionId}_refund`,
          manager,
        );
      } catch (err) {
        this.logger.error(
          `Failed to release funds for loser ${loserId}: ${err.message}`,
        );
      }
    }
  }

  private async releaseAllReservedFunds(auctionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const bids = await manager.find(Bid, { where: { auctionId } });
      const byUser = new Map<string, number>();

      bids.forEach((b: any) => {
        const userId = String(b.userId);
        const cost   = Number(b.amount) * Number(b.price ?? 1);
        byUser.set(userId, Math.max(byUser.get(userId) ?? 0, cost));
      });

      for (const [userId, amount] of byUser) {
        try {
          await this.balanceService.releaseFunds(
            userId,
            amount,
            `auction_${auctionId}_cancelled_refund`,
            manager,
          );
        } catch (err) {
          this.logger.error(
            `Failed to release funds for ${userId}: ${err.message}`,
          );
        }
      }
    });
  }

  async invalidateStateCache(auctionId: string): Promise<void> {
    await this.cacheService.del(`auction:state:${auctionId}`);
  }
}
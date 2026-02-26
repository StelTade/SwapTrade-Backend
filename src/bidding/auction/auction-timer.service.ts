import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auction, AuctionStatus } from '../entities/auction.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const AUCTION_TICK_EVENT    = 'auction.tick';
export const AUCTION_ENDING_EVENT  = 'auction.ending';
export const AUCTION_ENDED_EVENT   = 'auction.ended';
export const AUCTION_EXTENDED_EVENT = 'auction.extended';

const TICK_INTERVAL_MS  = 1000;  // 1s ticks for smooth countdowns
const ENDING_THRESHOLD  = 60_000; // last 60s = "ending" phase
const ANTI_SNIPE_WINDOW = 30_000; // bid in last 30s triggers extension

@Injectable()
export class AuctionTimerService implements OnModuleDestroy {
  private readonly logger = new Logger(AuctionTimerService.name);

  /** auctionId → NodeJS timer handle */
  private readonly timers = new Map<string, NodeJS.Timer>();

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleDestroy(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Start / Stop
  // ──────────────────────────────────────────────────────────────────────────

  startTimer(auction: Auction): void {
    if (this.timers.has(auction.id)) return; // already running

    this.logger.log(
      `Starting timer for auction ${auction.id}. Ends: ${auction.endsAt.toISOString()}`,
    );

    const timer = setInterval(
      () => this.tick(auction.id),
      TICK_INTERVAL_MS,
    );

    this.timers.set(auction.id, timer);
  }

  stopTimer(auctionId: string): void {
    const timer = this.timers.get(auctionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(auctionId);
      this.logger.debug(`Timer stopped for auction ${auctionId}`);
    }
  }

  isRunning(auctionId: string): boolean {
    return this.timers.has(auctionId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Anti-sniping extension
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Called by BiddingService when a bid lands in the anti-snipe window.
   * Extends endsAt and emits an extension event.
   */
  async extendIfAntiSnipe(auctionId: string): Promise<boolean> {
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId },
    });

    if (!auction || auction.status !== AuctionStatus.ACTIVE) return false;
    if (auction.extensionCount >= auction.maxExtensions) return false;

    const remainingMs = auction.endsAt.getTime() - Date.now();
    if (remainingMs > ANTI_SNIPE_WINDOW) return false;

    // Extend
    const newEndsAt = new Date(
      auction.endsAt.getTime() +
      auction.antiSnipingExtensionSeconds * 1000,
    );

    await this.auctionRepo.update(auctionId, {
      endsAt: newEndsAt,
      extensionCount: auction.extensionCount + 1,
      status: AuctionStatus.ACTIVE, // reset from ENDING if needed
    });

    this.logger.log(
      `Auction ${auctionId} extended (anti-snipe #${auction.extensionCount + 1}). New end: ${newEndsAt.toISOString()}`,
    );

    this.eventEmitter.emit(AUCTION_EXTENDED_EVENT, {
      auctionId,
      newEndsAt,
      extensionCount: auction.extensionCount + 1,
    });

    return true;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Tick handler
  // ──────────────────────────────────────────────────────────────────────────

  private async tick(auctionId: string): Promise<void> {
    try {
      const auction = await this.auctionRepo.findOne({
        where: { id: auctionId },
      });

      if (!auction || auction.status === AuctionStatus.ENDED ||
          auction.status === AuctionStatus.SETTLED ||
          auction.status === AuctionStatus.CANCELLED) {
        this.stopTimer(auctionId);
        return;
      }

      const now         = Date.now();
      const remainingMs = auction.endsAt.getTime() - now;

      if (remainingMs <= 0) {
        // Auction has ended
        this.stopTimer(auctionId);
        await this.auctionRepo.update(auctionId, { status: AuctionStatus.ENDED });

        this.eventEmitter.emit(AUCTION_ENDED_EVENT, { auctionId, auction });
        return;
      }

      // Transition to ENDING phase
      if (
        remainingMs <= ENDING_THRESHOLD &&
        auction.status === AuctionStatus.ACTIVE
      ) {
        await this.auctionRepo.update(auctionId, {
          status: AuctionStatus.ENDING,
        });
        this.eventEmitter.emit(AUCTION_ENDING_EVENT, { auctionId });
      }

      // Emit tick for gateway to broadcast
      this.eventEmitter.emit(AUCTION_TICK_EVENT, {
        auctionId,
        remainingMs,
        serverTime: new Date().toISOString(),
        phase: remainingMs <= ENDING_THRESHOLD ? 'ending' : 'active',
        extensionCount: auction.extensionCount,
      });
    } catch (err) {
      this.logger.error(`Timer tick error for auction ${auctionId}: ${err.message}`);
    }
  }
}
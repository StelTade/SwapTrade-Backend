import { Injectable, Logger } from '@nestjs/common';
import { AuctionEventPayload } from '../dto/ws-events.dto';

const MAX_REPLAY_EVENTS = 50;
const REPLAY_WINDOW_MS  = 5 * 60 * 1000; // 5 minutes

/**
 * Stores a short rolling window of auction events so that reconnecting
 * clients can catch up on missed state without a full REST fetch.
 */
@Injectable()
export class MessageReplayService {
  private readonly logger = new Logger(MessageReplayService.name);

  /** auctionId → circular buffer of recent events */
  private readonly eventBuffers = new Map<string, AuctionEventPayload[]>();

  // ──────────────────────────────────────────────────────────────────────────
  // Store events (called by gateway on every broadcast)
  // ──────────────────────────────────────────────────────────────────────────

  record(auctionId: string, event: AuctionEventPayload): void {
    if (!this.eventBuffers.has(auctionId)) {
      this.eventBuffers.set(auctionId, []);
    }

    const buffer = this.eventBuffers.get(auctionId)!;
    buffer.push(event);

    // Evict oldest entries beyond the cap
    if (buffer.length > MAX_REPLAY_EVENTS) {
      buffer.splice(0, buffer.length - MAX_REPLAY_EVENTS);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Retrieve for replay on reconnection
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Return events for `auctionId` that occurred after `sinceTimestamp`.
   * Pass undefined to get all buffered events (full catch-up for new joins).
   */
  getEventsSince(
    auctionId: string,
    sinceTimestamp?: string,
  ): AuctionEventPayload[] {
    const buffer = this.eventBuffers.get(auctionId) ?? [];

    if (!sinceTimestamp) return [...buffer];

    const since = new Date(sinceTimestamp).getTime();
    const cutoff = Date.now() - REPLAY_WINDOW_MS;

    return buffer.filter((e) => {
      const ts = new Date(e.timestamp).getTime();
      return ts > since && ts > cutoff;
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cleanup (called when auction ends)
  // ──────────────────────────────────────────────────────────────────────────

  clearAuction(auctionId: string): void {
    this.eventBuffers.delete(auctionId);
    this.logger.debug(`Cleared replay buffer for auction ${auctionId}`);
  }

  getBufferSize(auctionId: string): number {
    return this.eventBuffers.get(auctionId)?.length ?? 0;
  }
}
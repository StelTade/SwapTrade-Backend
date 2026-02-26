import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../../config/config.service';
import { AuctionEventPayload } from '../dto/ws-events.dto';

export type PubSubHandler = (event: AuctionEventPayload) => void;

const CHANNEL_PREFIX = 'auction:events:';
const GLOBAL_CHANNEL  = 'auction:global';

@Injectable()
export class BidPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BidPubSubService.name);

  /** Dedicated subscriber connection (ioredis can't share pub/sub with command connections) */
  private subscriber: Redis;
  /** Regular connection for publishing */
  private publisher: Redis;

  private handlers = new Map<string, Set<PubSubHandler>>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const opts = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      lazyConnect: true,
    };

    this.publisher  = new Redis(opts);
    this.subscriber = new Redis(opts);

    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);

    // Route incoming messages to registered handlers
    this.subscriber.on('message', (channel: string, rawMessage: string) => {
      try {
        const event: AuctionEventPayload = JSON.parse(rawMessage);
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          channelHandlers.forEach((h) => h(event));
        }
        // Also dispatch to global handlers
        const globalHandlers = this.handlers.get(GLOBAL_CHANNEL);
        if (globalHandlers) {
          globalHandlers.forEach((h) => h(event));
        }
      } catch (err) {
        this.logger.error(`Failed to parse pub/sub message: ${err.message}`);
      }
    });

    this.logger.log('Bid pub/sub Redis connections established');
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Publish
  // ──────────────────────────────────────────────────────────────────────────

  async publish(auctionId: string, event: AuctionEventPayload): Promise<void> {
    const channel = `${CHANNEL_PREFIX}${auctionId}`;
    try {
      await this.publisher.publish(channel, JSON.stringify(event));
    } catch (err) {
      this.logger.error(
        `Failed to publish to channel "${channel}": ${err.message}`,
      );
    }
  }

  async publishGlobal(event: AuctionEventPayload): Promise<void> {
    try {
      await this.publisher.publish(GLOBAL_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.logger.error(`Failed to publish global event: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Subscribe / unsubscribe
  // ──────────────────────────────────────────────────────────────────────────

  async subscribeToAuction(
    auctionId: string,
    handler: PubSubHandler,
  ): Promise<void> {
    const channel = `${CHANNEL_PREFIX}${auctionId}`;
    await this.addHandler(channel, handler);
  }

  async unsubscribeFromAuction(
    auctionId: string,
    handler: PubSubHandler,
  ): Promise<void> {
    const channel = `${CHANNEL_PREFIX}${auctionId}`;
    this.removeHandler(channel, handler);
  }

  async subscribeGlobal(handler: PubSubHandler): Promise<void> {
    await this.addHandler(GLOBAL_CHANNEL, handler);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async addHandler(channel: string, handler: PubSubHandler): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      await this.subscriber.subscribe(channel);
      this.logger.debug(`Subscribed to Redis channel: ${channel}`);
    }
    this.handlers.get(channel)!.add(handler);
  }

  private removeHandler(channel: string, handler: PubSubHandler): void {
    const set = this.handlers.get(channel);
    if (!set) return;

    set.delete(handler);

    if (set.size === 0) {
      this.handlers.delete(channel);
      this.subscriber.unsubscribe(channel).catch((err) =>
        this.logger.warn(`Failed to unsubscribe from ${channel}: ${err.message}`),
      );
    }
  }
}
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { BiddingService, BID_PLACED_INTERNAL_EVENT } from './bidding.service';
import { AuctionService } from './auction/auction.service';
import { PresenceService } from './presence/presence.service';
import { MessageReplayService } from './replay/message-replay.service';
import { BidPubSubService } from './redis/bid-pubsub.service';
import { AuctionTimerService } from './auction/auction-timer.service';
import {
  AUCTION_TICK_EVENT,
  AUCTION_ENDING_EVENT,
  AUCTION_ENDED_EVENT,
  AUCTION_EXTENDED_EVENT,
} from './auction/auction-timer.service';
import {
  JoinAuctionDto,
  LeaveAuctionDto,
  PlaceBidWsDto,
  WsEvents,
  AuctionEventPayload,
  BidPlacedPayload,
  TimerTickPayload,
} from './dto/ws-events.dto';

// Room naming convention
const auctionRoom = (id: string) => `auction:${id}`;

@WebSocketGateway({
  namespace:   '/bidding',
  cors: {
    origin:      process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'], // polling fallback for proxy environments
})
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class BiddingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Server;

  private readonly logger = new Logger(BiddingGateway.name);

  constructor(
    private readonly biddingService: BiddingService,
    private readonly auctionService: AuctionService,
    private readonly presenceService: PresenceService,
    private readonly replayService: MessageReplayService,
    private readonly pubSubService: BidPubSubService,
    private readonly timerService: AuctionTimerService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Connection lifecycle
  // ──────────────────────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    const userId = this.extractUserId(client);

    if (!userId) {
      this.logger.warn(
        `Unauthenticated connection attempt from ${client.id}. Disconnecting.`,
      );
      client.emit(WsEvents.ERROR, { message: 'Authentication required' });
      client.disconnect();
      return;
    }

    // Attach userId to socket for fast lookups without DB calls
    client.data.userId = userId;

    this.logger.log(`Client connected: ${client.id} (user ${userId})`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId    = client.data.userId as string | undefined;
    const affectedAuctions = this.presenceService.disconnectSocket(client.id);

    for (const auctionId of affectedAuctions) {
      await this.broadcastPresenceUpdate(auctionId);
    }

    this.logger.log(
      `Client disconnected: ${client.id} (user ${userId ?? 'unknown'}). Left ${affectedAuctions.length} auctions.`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Client → Server: room management
  // ──────────────────────────────────────────────────────────────────────────

  @SubscribeMessage(WsEvents.JOIN_AUCTION)
  async handleJoinAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinAuctionDto,
  ): Promise<void> {
    const userId = this.requireUserId(client);
    const { auctionId } = dto;

    // Load auction state (throws NotFoundException if not found)
    const participantCount = this.presenceService.getParticipantCount(auctionId) + 1;
    const auctionState = await this.auctionService.getAuctionState(
      auctionId,
      participantCount,
    );

    // Subscribe to Redis pub/sub channel for this auction
    await this.pubSubService.subscribeToAuction(auctionId, (event) => {
      this.server
        .to(auctionRoom(auctionId))
        .emit(event.eventType, event.payload);
    });

    // Join socket.io room
    await client.join(auctionRoom(auctionId));

    // Track presence
    this.presenceService.join(auctionId, client.id, userId);

    // Get replay events for reconnection recovery
    const reconnectSince = client.handshake.query.lastEventAt as
      | string
      | undefined;
    const replayedEvents = this.replayService.getEventsSince(
      auctionId,
      reconnectSince,
    );

    // Send current state + replay to this client only
    client.emit(WsEvents.AUCTION_JOINED, {
      auctionId,
      auction: auctionState,
      replayedEvents,
    });

    // Broadcast updated presence to room
    await this.broadcastPresenceUpdate(auctionId);

    this.logger.debug(
      `User ${userId} joined auction ${auctionId}. Room size: ${participantCount}`,
    );
  }

  @SubscribeMessage(WsEvents.LEAVE_AUCTION)
  async handleLeaveAuction(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: LeaveAuctionDto,
  ): Promise<void> {
    const { auctionId } = dto;

    await client.leave(auctionRoom(auctionId));
    this.presenceService.leave(auctionId, client.id);
    await this.broadcastPresenceUpdate(auctionId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Client → Server: bid placement
  // ──────────────────────────────────────────────────────────────────────────

  @SubscribeMessage(WsEvents.PLACE_BID)
  async handlePlaceBid(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: PlaceBidWsDto,
  ): Promise<void> {
    const userId = this.requireUserId(client);
    const { auctionId, amount, clientToken } = dto;

    try {
      await this.biddingService.placeBid(userId, auctionId, amount, clientToken);
      // BID_PLACED_INTERNAL_EVENT fires the broadcast — see below

      this.presenceService.markBidPlaced(auctionId, client.id);
    } catch (err) {
      // Send rejection only to the bidding client (not the whole room)
      client.emit(WsEvents.BID_REJECTED, {
        auctionId,
        reason: err.message,
        minRequired: await this.getMinBidSafe(auctionId),
        clientToken,
      });

      this.logger.debug(
        `Bid rejected for user ${userId} on auction ${auctionId}: ${err.message}`,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal event → WS broadcast (bid placed)
  // ──────────────────────────────────────────────────────────────────────────

  @OnEvent(BID_PLACED_INTERNAL_EVENT)
  async onBidPlaced(payload: {
    bid: any;
    auction: any;
    wasExtended: boolean;
    newMinBid: number;
    clientToken?: string;
  }): Promise<void> {
    const { bid, auction, wasExtended, newMinBid, clientToken } = payload;
    const auctionId = auction.id;
    const userId    = String(bid.userId);
    const now       = new Date().toISOString();

    const bidPayload: BidPlacedPayload = {
      auctionId,
      bidId:            bid.id,
      userId,
      bidderAlias:      this.maskUserId(userId),
      amount:           Number(bid.amount),
      timestamp:        now,
      isWinning:        true,
      newMinBid,
    };

    // Broadcast to all participants in the room (without clientToken)
    const event = this.buildEvent(WsEvents.BID_PLACED, auctionId, bidPayload);
    this.replayService.record(auctionId, event);

    this.server
      .to(auctionRoom(auctionId))
      .emit(WsEvents.BID_PLACED, bidPayload);

    // Send private confirmation (with token) back to the placing client
    const bidderSockets = this.presenceService.getSocketIdsForUser(
      auctionId,
      userId,
    );
    for (const socketId of bidderSockets) {
      this.server.to(socketId).emit(WsEvents.BID_CONFIRMED, {
        ...bidPayload,
        clientToken,
      });
    }

    // Publish to Redis so other gateway instances also broadcast
    await this.pubSubService.publish(auctionId, event);

    // If auction was extended by anti-snipe, broadcast that too
    if (wasExtended) {
      const updatedAuction = await this.auctionService.findOrThrow(auctionId);
      const extEvent = this.buildEvent(
        WsEvents.AUCTION_EXTENDED,
        auctionId,
        {
          auctionId,
          newEndsAt:      updatedAuction.endsAt.toISOString(),
          extensionCount: updatedAuction.extensionCount,
          reason:         'anti_sniping',
        },
      );
      this.replayService.record(auctionId, extEvent);
      this.server
        .to(auctionRoom(auctionId))
        .emit(WsEvents.AUCTION_EXTENDED, extEvent.payload);
      await this.pubSubService.publish(auctionId, extEvent);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal event → WS broadcast (timer ticks)
  // ──────────────────────────────────────────────────────────────────────────

  @OnEvent(AUCTION_TICK_EVENT)
  onTimerTick(tickPayload: TimerTickPayload): void {
    this.server
      .to(auctionRoom(tickPayload.auctionId))
      .emit(WsEvents.TIMER_TICK, tickPayload);
  }

  @OnEvent(AUCTION_ENDING_EVENT)
  async onAuctionEnding(payload: { auctionId: string }): Promise<void> {
    const { auctionId } = payload;
    const state = await this.auctionService
      .getAuctionState(auctionId)
      .catch(() => null);

    if (state) {
      this.server
        .to(auctionRoom(auctionId))
        .emit(WsEvents.AUCTION_STATE, state);
    }
  }

  @OnEvent(AUCTION_EXTENDED_EVENT)
  async onAuctionExtended(payload: {
    auctionId: string;
    newEndsAt: Date;
    extensionCount: number;
  }): Promise<void> {
    const event = this.buildEvent(WsEvents.AUCTION_EXTENDED, payload.auctionId, {
      auctionId:      payload.auctionId,
      newEndsAt:      payload.newEndsAt.toISOString(),
      extensionCount: payload.extensionCount,
      reason:         'anti_sniping',
    });

    this.replayService.record(payload.auctionId, event);
    this.server
      .to(auctionRoom(payload.auctionId))
      .emit(WsEvents.AUCTION_EXTENDED, event.payload);
  }

  @OnEvent(AUCTION_ENDED_EVENT)
  async onAuctionEnded(payload: {
    auctionId: string;
    auction: any;
  }): Promise<void> {
    const { auctionId, auction } = payload;

    const endedPayload = {
      auctionId,
      status:    auction.winnerId ? 'settled' : 'no_sale',
      winnerId:  auction.winnerId ?? null,
      winningBid: auction.winningBid ?? null,
      totalBids:  auction.bidCount,
      endedAt:   new Date().toISOString(),
    };

    const event = this.buildEvent(WsEvents.AUCTION_ENDED, auctionId, endedPayload);
    this.replayService.record(auctionId, event);

    this.server
      .to(auctionRoom(auctionId))
      .emit(WsEvents.AUCTION_ENDED, endedPayload);

    // Clear replay buffer after a grace period
    setTimeout(() => this.replayService.clearAuction(auctionId), 5 * 60 * 1000);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async broadcastPresenceUpdate(auctionId: string): Promise<void> {
    const presencePayload = {
      auctionId,
      participantCount: this.presenceService.getParticipantCount(auctionId),
      activeBidderCount: this.presenceService.getActiveBidderCount(auctionId),
    };

    this.server
      .to(auctionRoom(auctionId))
      .emit(WsEvents.PRESENCE_UPDATE, presencePayload);
  }

  private buildEvent(
    eventType: string,
    auctionId: string,
    payload: unknown,
  ): AuctionEventPayload {
    return {
      eventType,
      auctionId,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Extract userId from JWT token in socket handshake.
   * Adapt to your actual auth strategy (JWT guard, etc.)
   */
  private extractUserId(client: Socket): string | null {
    const token =
      (client.handshake.auth?.token as string) ??
      (client.handshake.headers?.authorization?.replace('Bearer ', '') ?? '');

    if (!token) return null;

    try {
      // TODO: Replace with real JWT verification via JwtService
      // const payload = this.jwtService.verify(token);
      // return payload.sub;

      // Placeholder: decode without verify for development
      const parts  = token.split('.');
      if (parts.length !== 3) return null;
      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8'),
      );
      return decoded.sub ?? decoded.userId ?? null;
    } catch {
      return null;
    }
  }

  private requireUserId(client: Socket): string {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Not authenticated');
    return userId;
  }

  /**
   * Mask user ID for public broadcast — show only last 4 chars.
   * e.g.  "user-abc123-xyz" → "***-xyz"
   */
  private maskUserId(userId: string): string {
    if (userId.length <= 4) return '****';
    return `***-${userId.slice(-4)}`;
  }

  private async getMinBidSafe(auctionId: string): Promise<number> {
    try {
      const auction = await this.auctionService.findOrThrow(auctionId);
      return this.biddingService.getMinBid(auction);
    } catch {
      return 0;
    }
  }
}
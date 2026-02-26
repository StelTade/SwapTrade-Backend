import { IsString, IsNumber, IsPositive, IsOptional, IsUUID, Min } from 'class-validator';

// ── Client → Server events ────────────────────────────────────────────────────

export class JoinAuctionDto {
  @IsUUID()
  auctionId: string;
}

export class LeaveAuctionDto {
  @IsUUID()
  auctionId: string;
}

export class PlaceBidWsDto {
  @IsUUID()
  auctionId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  /**
   * Optimistic update token — client echoes this back so the UI
   * can match the server confirmation to the pending local state.
   */
  @IsOptional()
  @IsString()
  clientToken?: string;
}

export class SubscribeTimerDto {
  @IsUUID()
  auctionId: string;
}

// ── Server → Client event payloads ───────────────────────────────────────────

export interface AuctionJoinedPayload {
  auctionId: string;
  auction: AuctionStatePayload;
  replayedEvents: AuctionEventPayload[];
}

export interface AuctionStatePayload {
  id: string;
  assetId: string;
  title: string;
  status: string;
  startingPrice: number;
  currentHighestBid: number | null;
  currentHighestBidderId: string | null;
  minBidIncrement: number;
  reserveMet: boolean;
  bidCount: number;
  startsAt: string;
  endsAt: string;
  extensionCount: number;
  participantCount: number;
}

export interface BidPlacedPayload {
  auctionId: string;
  bidId: string;
  userId: string;
  /** Masked user display — never expose full ID to other bidders */
  bidderAlias: string;
  amount: number;
  timestamp: string;
  isWinning: boolean;
  newMinBid: number;
  clientToken?: string;   // echoed back to the placing client only
}

export interface BidRejectedPayload {
  auctionId: string;
  reason: string;
  minRequired: number;
  clientToken?: string;
}

export interface TimerTickPayload {
  auctionId: string;
  remainingMs: number;
  serverTime: string;      // ISO — clients sync clocks to this
  phase: 'active' | 'ending' | 'ended';
  extensionCount: number;
}

export interface AuctionExtendedPayload {
  auctionId: string;
  newEndsAt: string;
  extensionCount: number;
  reason: 'anti_sniping';
}

export interface AuctionEndedPayload {
  auctionId: string;
  status: 'settled' | 'no_sale';
  winnerId: string | null;
  winningBid: number | null;
  totalBids: number;
  endedAt: string;
}

export interface PresenceUpdatePayload {
  auctionId: string;
  participantCount: number;
  activeBidderCount: number;
}

export interface AuctionEventPayload {
  eventType: string;
  auctionId: string;
  payload: unknown;
  timestamp: string;
}

// ── WS event name constants ───────────────────────────────────────────────────
export const WsEvents = {
  // Client → Server
  JOIN_AUCTION:     'join_auction',
  LEAVE_AUCTION:    'leave_auction',
  PLACE_BID:        'place_bid',
  SUBSCRIBE_TIMER:  'subscribe_timer',

  // Server → Client
  AUCTION_JOINED:   'auction:joined',
  AUCTION_STATE:    'auction:state',
  BID_PLACED:       'bid:placed',
  BID_REJECTED:     'bid:rejected',
  BID_CONFIRMED:    'bid:confirmed',    // sent only to the placing client
  TIMER_TICK:       'auction:timer',
  AUCTION_EXTENDED: 'auction:extended',
  AUCTION_ENDED:    'auction:ended',
  PRESENCE_UPDATE:  'auction:presence',
  ERROR:            'error',
} as const;
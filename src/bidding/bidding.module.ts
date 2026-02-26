import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BiddingController } from './bidding.controller';
import { BiddingService } from './bidding.service';
import { BiddingGateway } from './bidding.gateway';
import { AuctionService } from './auction/auction.service';
import { AuctionTimerService } from './auction/auction-timer.service';
import { PresenceService } from './presence/presence.service';
import { MessageReplayService } from './replay/message-replay.service';
import { BidPubSubService } from './redis/bid-pubsub.service';
import { BalanceModule } from '../balance/balance.module';
import { CustomCacheModule } from '../common/cache/cache.module';
import { CacheService } from '../common/services/cache.service';
import { Bid } from './entities/bid.entity';
import { Auction } from './entities/auction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bid, Auction]),
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    BalanceModule,
    CustomCacheModule,
  ],
  controllers: [BiddingController],
  providers: [
    // Core bidding
    BiddingService,
    CacheService,

    // WebSocket
    BiddingGateway,

    // Auction lifecycle
    AuctionService,
    AuctionTimerService,

    // Real-time infrastructure
    PresenceService,
    MessageReplayService,
    BidPubSubService,
  ],
  exports: [BiddingService, AuctionService],
})
export class BiddingModule {}
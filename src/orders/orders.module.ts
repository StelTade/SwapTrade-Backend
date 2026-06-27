import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { VirtualAsset } from '../database/entities/virtual-asset.entity';
import { Trade } from '../database/entities/trade.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersResolver } from './orders.resolver';
import { OrderBookService } from './services/order-book.service';
import { StopOrderMonitorService } from './services/stop-order-monitor.service';
import { GqlJwtAuthGuard } from './guards/gql-jwt-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { InfrastructureWebSocketModule } from '../infrastructure/websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, UserBalance, VirtualAsset, Trade]),
    AuthModule, // re-exports configured JwtModule, used by both JwtAuthGuard and GqlJwtAuthGuard
    InfrastructureWebSocketModule, // provides WebSocketService for order-update broadcasts
  ],
  controllers: [OrdersController],
  // OrdersResolver is registered here deliberately — UserResolver and
  // TradeResolver exist on disk but were never added to any module's
  // providers array, so Nest never instantiates them and they contribute
  // nothing to schema.gql. Registering OrdersResolver here is what makes
  // it actually appear in the generated schema.
  providers: [
    OrdersService,
    OrderBookService,
    StopOrderMonitorService,
    OrdersResolver,
    GqlJwtAuthGuard,
  ],
  // OrderBookService is exported here so that the SocialTradingModule
  // can call its matchTakerOrder() to drive follow-side MATCHET/LIMIT
  // orders triggered by copied master trades — see CopyTradingListener
  // and SOCIAL_TRADING_REUSE_OB comment in that file. OrdersService
  // remains exported because user/identity code already depends on it.
  exports: [OrdersService, OrderBookService],
})
export class OrdersModule {}

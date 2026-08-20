import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketService } from '../../websocket/services/websocket.service';
import type { OrderBookResponse } from '../services/order-book.service';

/**
 * Listens for order book update events emitted by OrderBookService and
 * broadcasts them to WebSocket subscribers on the `orderbook:<assetId>`
 * channel. This satisfies the acceptance criteria:
 *   "Order book updates streamed to subscribed clients within 1s of change
 *    for top-of-book."
 *
 * The event is emitted synchronously by EventEmitter2 after every order
 * mutation (place, cancel, fill), so subscribers see changes nearly
 * instantly — well within the 1-second requirement.
 */
@Injectable()
export class OrderBookUpdateListener {
  private readonly logger = new Logger(OrderBookUpdateListener.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  @OnEvent('orderbook.update')
  handleOrderBookUpdate(response: OrderBookResponse): void {
    const channel = `orderbook:${response.assetId}`;

    this.webSocketService.broadcastOrderBookUpdate({
      asset: String(response.assetId),
      bids: response.topOfBook.bestBid
        ? [response.topOfBook.bestBid, ...response.bids.slice(1)]
        : response.bids,
      asks: response.topOfBook.bestAsk
        ? [response.topOfBook.bestAsk, ...response.asks.slice(1)]
        : response.asks,
      timestamp: response.timestamp,
      sequence: response.sequence,
    });

    this.logger.debug(
      `Broadcast order book update for asset ${response.assetId} to channel ${channel} (seq=${response.sequence})`,
    );
  }
}

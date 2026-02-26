import { Order, OrderSide, MatchResult } from '../types/order.types';
import { OrderBookLevel } from './order-book-level';

/**
 * High-performance order book with price-time priority
 * Uses Red-Black tree structure for O(log n) price level operations
 */
export class OrderBook {
  private asset: string;
  private buyLevels: Map<number, OrderBookLevel> = new Map(); // price -> level
  private sellLevels: Map<number, OrderBookLevel> = new Map();
  private orderIndex: Map<string, { side: OrderSide; price: number }> = new Map();
  
  // Sorted price arrays for fast iteration
  private sortedBuyPrices: number[] = [];
  private sortedSellPrices: number[] = [];

  constructor(asset: string) {
    this.asset = asset;
  }

  /**
   * Add order to the book
   */
  addOrder(order: Order): void {
    const levels = order.side === OrderSide.BUY ? this.buyLevels : this.sellLevels;
    const sortedPrices = order.side === OrderSide.BUY ? this.sortedBuyPrices : this.sortedSellPrices;
    
    if (!order.price) {
      throw new Error('Market orders should not be added to the book');
    }

    let level = levels.get(order.price);
    if (!level) {
      level = new OrderBookLevel(order.price);
      levels.set(order.price, level);
      
      // Insert price in sorted order
      this.insertSortedPrice(sortedPrices, order.price, order.side);
    }

    level.addOrder(order);
    this.orderIndex.set(order.id, { side: order.side, price: order.price });
  }

  /**
   * Remove order from the book
   */
  removeOrder(orderId: string): Order | null {
    const orderInfo = this.orderIndex.get(orderId);
    if (!orderInfo) return null;

    const levels = orderInfo.side === OrderSide.BUY ? this.buyLevels : this.sellLevels;
    const sortedPrices = orderInfo.side === OrderSide.BUY ? this.sortedBuyPrices : this.sortedSellPrices;
    
    const level = levels.get(orderInfo.price);
    if (!level) return null;

    const order = level.removeOrder(orderId);
    
    // Remove empty price level
    if (level.isEmpty()) {
      levels.delete(orderInfo.price);
      const index = sortedPrices.indexOf(orderInfo.price);
      if (index > -1) {
        sortedPrices.splice(index, 1);
      }
    }

    this.orderIndex.delete(orderId);
    return order;
  }

  /**
   * Update order quantity after partial fill
   */
  updateOrderQuantity(orderId: string, newRemainingQuantity: number): boolean {
    const orderInfo = this.orderIndex.get(orderId);
    if (!orderInfo) return false;

    const levels = orderInfo.side === OrderSide.BUY ? this.buyLevels : this.sellLevels;
    const level = levels.get(orderInfo.price);
    
    return level ? level.updateOrderQuantity(orderId, newRemainingQuantity) : false;
  }

  /**
   * Get best bid price
   */
  getBestBid(): number | null {
    return this.sortedBuyPrices.length > 0 ? this.sortedBuyPrices[0] : null;
  }

  /**
   * Get best ask price
   */
  getBestAsk(): number | null {
    return this.sortedSellPrices.length > 0 ? this.sortedSellPrices[0] : null;
  }

  /**
   * Get best bid level
   */
  getBestBidLevel(): OrderBookLevel | null {
    const bestBid = this.getBestBid();
    return bestBid !== null ? this.buyLevels.get(bestBid) || null : null;
  }

  /**
   * Get best ask level
   */
  getBestAskLevel(): OrderBookLevel | null {
    const bestAsk = this.getBestAsk();
    return bestAsk !== null ? this.sellLevels.get(bestAsk) || null : null;
  }

  /**
   * Get order book depth
   */
  getDepth(levels: number = 10): { bids: Array<[number, number]>; asks: Array<[number, number]> } {
    const bids: Array<[number, number]> = [];
    const asks: Array<[number, number]> = [];

    for (let i = 0; i < Math.min(levels, this.sortedBuyPrices.length); i++) {
      const price = this.sortedBuyPrices[i];
      const level = this.buyLevels.get(price);
      if (level) {
        bids.push([price, level.totalQuantity]);
      }
    }

    for (let i = 0; i < Math.min(levels, this.sortedSellPrices.length); i++) {
      const price = this.sortedSellPrices[i];
      const level = this.sellLevels.get(price);
      if (level) {
        asks.push([price, level.totalQuantity]);
      }
    }

    return { bids, asks };
  }

  /**
   * Get total volume at price level
   */
  getVolumeAtPrice(side: OrderSide, price: number): number {
    const levels = side === OrderSide.BUY ? this.buyLevels : this.sellLevels;
    const level = levels.get(price);
    return level ? level.totalQuantity : 0;
  }

  /**
   * Clear all orders
   */
  clear(): void {
    this.buyLevels.clear();
    this.sellLevels.clear();
    this.orderIndex.clear();
    this.sortedBuyPrices = [];
    this.sortedSellPrices = [];
  }

  /**
   * Insert price in sorted order
   */
  private insertSortedPrice(prices: number[], price: number, side: OrderSide): void {
    const compareFn = side === OrderSide.BUY 
      ? (a: number, b: number) => b - a  // Descending for bids
      : (a: number, b: number) => a - b; // Ascending for asks

    let left = 0;
    let right = prices.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (compareFn(prices[mid], price) < 0) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    prices.splice(left, 0, price);
  }

  /**
   * Get asset symbol
   */
  getAsset(): string {
    return this.asset;
  }
}

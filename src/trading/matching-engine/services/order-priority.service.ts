import { Injectable } from '@nestjs/common';
import { Order, OrderSide } from '../types/order.types';

/**
 * Service for calculating order priority and ensuring fairness
 * Implements price-time priority with anti-gaming measures
 */
@Injectable()
export class OrderPriorityService {
  private readonly TIME_WEIGHT = 0.3;
  private readonly PRICE_WEIGHT = 0.7;

  /**
   * Calculate priority score for order
   * Higher score = higher priority
   */
  calculatePriority(order: Order, marketPrice?: number): number {
    const priceScore = this.calculatePriceScore(order, marketPrice);
    const timeScore = this.calculateTimeScore(order);
    
    return (priceScore * this.PRICE_WEIGHT) + (timeScore * this.TIME_WEIGHT);
  }

  /**
   * Calculate price score (0-1)
   * Better prices get higher scores
   */
  private calculatePriceScore(order: Order, marketPrice?: number): number {
    if (!order.price || !marketPrice) return 0.5;

    if (order.side === OrderSide.BUY) {
      // Higher buy prices are better
      const improvement = (order.price - marketPrice) / marketPrice;
      return Math.min(1, Math.max(0, 0.5 + improvement));
    } else {
      // Lower sell prices are better
      const improvement = (marketPrice - order.price) / marketPrice;
      return Math.min(1, Math.max(0, 0.5 + improvement));
    }
  }

  /**
   * Calculate time score (0-1)
   * Older orders get higher scores (FIFO)
   */
  private calculateTimeScore(order: Order): number {
    const ageMs = Date.now() - order.timestamp.getTime();
    const ageMinutes = ageMs / (1000 * 60);
    
    // Normalize to 0-1 range, with diminishing returns after 60 minutes
    return Math.min(1, ageMinutes / 60);
  }

  /**
   * Compare two orders for priority
   * Returns: negative if a has higher priority, positive if b has higher priority
   */
  compareOrders(a: Order, b: Order, marketPrice?: number): number {
    // First compare by price (primary criterion)
    if (a.price && b.price) {
      if (a.side === OrderSide.BUY) {
        // Higher buy prices have priority
        if (a.price !== b.price) {
          return b.price - a.price;
        }
      } else {
        // Lower sell prices have priority
        if (a.price !== b.price) {
          return a.price - b.price;
        }
      }
    }

    // If prices are equal, use timestamp (FIFO)
    return a.timestamp.getTime() - b.timestamp.getTime();
  }

  /**
   * Detect potential order manipulation
   * Returns true if order appears suspicious
   */
  detectManipulation(order: Order, recentOrders: Order[]): boolean {
    // Check for rapid order placement/cancellation (spoofing)
    const recentSameUser = recentOrders.filter(
      o => o.userId === order.userId && 
      Date.now() - o.timestamp.getTime() < 5000 // Last 5 seconds
    );

    if (recentSameUser.length > 10) {
      return true; // Potential spoofing
    }

    // Check for layering (multiple orders at different prices)
    const sameSideOrders = recentSameUser.filter(o => o.side === order.side);
    const uniquePrices = new Set(sameSideOrders.map(o => o.price));
    
    if (uniquePrices.size > 5 && sameSideOrders.length > 10) {
      return true; // Potential layering
    }

    return false;
  }

  /**
   * Apply fairness adjustments to prevent gaming
   */
  applyFairnessAdjustment(order: Order, userOrderCount: number): Order {
    // Reduce priority for users with excessive orders
    if (userOrderCount > 50) {
      order.priority *= 0.9;
    }
    if (userOrderCount > 100) {
      order.priority *= 0.8;
    }

    return order;
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { Order, OrderType, OrderSide, TimeInForce } from '../types/order.types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Service for validating orders before submission
 */
@Injectable()
export class OrderValidatorService {
  private readonly MIN_ORDER_SIZE = 0.00000001; // 1 satoshi equivalent
  private readonly MAX_ORDER_SIZE = 1000000;
  private readonly MAX_PRICE = 1000000000;

  /**
   * Validate order before submission
   */
  validate(order: Order): ValidationResult {
    const errors: string[] = [];

    // Basic field validation
    if (!order.userId) {
      errors.push('User ID is required');
    }

    if (!order.asset) {
      errors.push('Asset is required');
    }

    if (!order.side || !Object.values(OrderSide).includes(order.side)) {
      errors.push('Invalid order side');
    }

    if (!order.type || !Object.values(OrderType).includes(order.type)) {
      errors.push('Invalid order type');
    }

    // Quantity validation
    if (!order.quantity || order.quantity <= 0) {
      errors.push('Order quantity must be positive');
    }

    if (order.quantity < this.MIN_ORDER_SIZE) {
      errors.push(`Order quantity must be at least ${this.MIN_ORDER_SIZE}`);
    }

    if (order.quantity > this.MAX_ORDER_SIZE) {
      errors.push(`Order quantity cannot exceed ${this.MAX_ORDER_SIZE}`);
    }

    // Price validation for limit orders
    if (order.type === OrderType.LIMIT || order.type === OrderType.STOP_LIMIT) {
      if (!order.price || order.price <= 0) {
        errors.push('Limit orders must have a positive price');
      }

      if (order.price && order.price > this.MAX_PRICE) {
        errors.push(`Price cannot exceed ${this.MAX_PRICE}`);
      }
    }

    // Stop price validation
    if (order.type === OrderType.STOP_LIMIT || order.type === OrderType.STOP_MARKET) {
      if (!order.stopPrice || order.stopPrice <= 0) {
        errors.push('Stop orders must have a positive stop price');
      }

      if (order.stopPrice && order.stopPrice > this.MAX_PRICE) {
        errors.push(`Stop price cannot exceed ${this.MAX_PRICE}`);
      }
    }

    // Time in force validation
    if (order.timeInForce && !Object.values(TimeInForce).includes(order.timeInForce)) {
      errors.push('Invalid time in force');
    }

    // Validate remaining quantity matches quantity for new orders
    if (order.remainingQuantity !== order.quantity) {
      errors.push('Remaining quantity must equal quantity for new orders');
    }

    // Validate filled quantity is zero for new orders
    if (order.filledQuantity !== 0) {
      errors.push('Filled quantity must be zero for new orders');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate order against user balance
   */
  validateBalance(
    order: Order,
    userBalance: number,
    assetBalance: number,
  ): ValidationResult {
    const errors: string[] = [];

    if (order.side === OrderSide.BUY) {
      // Check if user has enough quote currency
      const requiredBalance = order.quantity * (order.price || 0);
      
      if (userBalance < requiredBalance) {
        errors.push(`Insufficient balance. Required: ${requiredBalance}, Available: ${userBalance}`);
      }
    } else {
      // Check if user has enough base asset
      if (assetBalance < order.quantity) {
        errors.push(`Insufficient asset balance. Required: ${order.quantity}, Available: ${assetBalance}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate order against market conditions
   */
  validateMarketConditions(
    order: Order,
    bestBid: number | null,
    bestAsk: number | null,
  ): ValidationResult {
    const errors: string[] = [];

    // Check for crossed market
    if (bestBid && bestAsk && bestBid > bestAsk) {
      errors.push('Market is crossed - trading halted');
    }

    // Validate limit order price is reasonable
    if (order.type === OrderType.LIMIT && order.price) {
      const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null;
      
      if (midPrice) {
        const deviation = Math.abs(order.price - midPrice) / midPrice;
        
        // Warn if price is more than 10% away from mid
        if (deviation > 0.1) {
          errors.push(`Order price deviates ${(deviation * 100).toFixed(2)}% from market`);
        }

        // Reject if price is more than 50% away (likely error)
        if (deviation > 0.5) {
          errors.push('Order price too far from market - likely error');
        }
      }
    }

    // Validate market order has liquidity
    if (order.type === OrderType.MARKET) {
      const hasLiquidity = order.side === OrderSide.BUY ? bestAsk !== null : bestBid !== null;
      
      if (!hasLiquidity) {
        errors.push('No liquidity available for market order');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate order modification
   */
  validateModification(
    originalOrder: Order,
    newQuantity?: number,
    newPrice?: number,
  ): ValidationResult {
    const errors: string[] = [];

    // Cannot increase quantity (would lose time priority)
    if (newQuantity && newQuantity > originalOrder.remainingQuantity) {
      errors.push('Cannot increase order quantity - cancel and resubmit instead');
    }

    // Validate new quantity
    if (newQuantity !== undefined) {
      if (newQuantity <= 0) {
        errors.push('New quantity must be positive');
      }

      if (newQuantity < this.MIN_ORDER_SIZE) {
        errors.push(`New quantity must be at least ${this.MIN_ORDER_SIZE}`);
      }
    }

    // Validate new price
    if (newPrice !== undefined) {
      if (newPrice <= 0) {
        errors.push('New price must be positive');
      }

      if (newPrice > this.MAX_PRICE) {
        errors.push(`New price cannot exceed ${this.MAX_PRICE}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

import { Order } from '../types/order.types';

/**
 * Represents a single price level in the order book
 * Uses a doubly-linked list for O(1) insertions/deletions
 */
export class OrderBookLevel {
  public price: number;
  public totalQuantity: number = 0;
  public orders: Order[] = [];
  private orderMap: Map<string, number> = new Map();

  constructor(price: number) {
    this.price = price;
  }

  /**
   * Add order to this price level (FIFO)
   */
  addOrder(order: Order): void {
    const index = this.orders.length;
    this.orders.push(order);
    this.orderMap.set(order.id, index);
    this.totalQuantity += order.remainingQuantity;
  }

  /**
   * Remove order from this price level
   */
  removeOrder(orderId: string): Order | null {
    const index = this.orderMap.get(orderId);
    if (index === undefined) return null;

    const order = this.orders[index];
    this.totalQuantity -= order.remainingQuantity;
    
    // Remove from array and update map
    this.orders.splice(index, 1);
    this.orderMap.delete(orderId);
    
    // Update indices for remaining orders
    for (let i = index; i < this.orders.length; i++) {
      this.orderMap.set(this.orders[i].id, i);
    }

    return order;
  }

  /**
   * Update order quantity after partial fill
   */
  updateOrderQuantity(orderId: string, newRemainingQuantity: number): boolean {
    const index = this.orderMap.get(orderId);
    if (index === undefined) return false;

    const order = this.orders[index];
    const quantityDiff = order.remainingQuantity - newRemainingQuantity;
    
    order.remainingQuantity = newRemainingQuantity;
    order.filledQuantity = order.quantity - newRemainingQuantity;
    this.totalQuantity -= quantityDiff;

    return true;
  }

  /**
   * Get the first order (highest priority)
   */
  getFirstOrder(): Order | null {
    return this.orders.length > 0 ? this.orders[0] : null;
  }

  /**
   * Check if level is empty
   */
  isEmpty(): boolean {
    return this.orders.length === 0;
  }

  /**
   * Get all orders at this level
   */
  getAllOrders(): Order[] {
    return [...this.orders];
  }
}

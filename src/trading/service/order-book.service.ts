import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { OrderBook } from '../entities/order-book.entity';
import { OrderType, OrderStatus } from '../../common/enums/order-type.enum';
import { AMMService } from './amm.service';

export interface OrderBookEntry {
	id: number;
	userId: number;
	asset: string;
	type: OrderType;
	amount: number;
	price: number;
	createdAt: Date;
}

export interface TradeExecution {
	success: boolean;
	executedAmount: number;
	averagePrice: number;
	totalCost: number;
	fee: number;
	slippage: number;
	error?: string;
}

@Injectable()
export class OrderBookService {
	constructor(
		@InjectRepository(OrderBook)
		private readonly orderBookRepository: Repository<OrderBook>,
		private readonly ammService: AMMService,
	) {}

	/**
	 * Place a new order in the order book
	 */
	async placeOrder(
		userId: number,
		asset: string,
		type: OrderType,
		amount: number,
		price: number,
	): Promise<OrderBook> {
		const order = this.orderBookRepository.create({
			userId,
			asset,
			type,
			amount,
			price,
			status: OrderStatus.PENDING,
			filledAmount: 0,
			remainingAmount: amount,
		});

		return this.orderBookRepository.save(order);
	}

	/**
	 * Get order book for an asset
	 */
	async getOrderBook(asset: string): Promise<{
		buyOrders: OrderBookEntry[];
		sellOrders: OrderBookEntry[];
	}> {
		const orders = await this.orderBookRepository.find({
			where: { asset, status: OrderStatus.PENDING },
			order: { price: 'DESC', createdAt: 'ASC' },
		});

		const buyOrders = orders
			.filter(order => order.type === OrderType.BUY)
			.map(order => ({
				id: order.id,
				userId: order.userId,
				asset: order.asset,
				type: order.type,
				amount: order.remainingAmount,
				price: order.price,
				createdAt: order.createdAt,
			}));

		const sellOrders = orders
			.filter(order => order.type === OrderType.SELL)
			.map(order => ({
				id: order.id,
				userId: order.userId,
				asset: order.asset,
				type: order.type,
				amount: order.remainingAmount,
				price: order.price,
				createdAt: order.createdAt,
			}));

		return { buyOrders, sellOrders };
	}

	/**
	 * Calculate price slippage for large orders
	 */
	calculateSlippage(
		asset: string,
		amount: number,
		type: OrderType,
		orderBook: { buyOrders: OrderBookEntry[]; sellOrders: OrderBookEntry[] }
	): number {
		let slippage = 0;
		let remainingAmount = amount;

		if (type === OrderType.BUY) {
			// For buy orders, slippage occurs when hitting sell orders at higher prices
			for (const sellOrder of orderBook.sellOrders) {
				if (remainingAmount <= 0) break;

				const fillAmount = Math.min(remainingAmount, sellOrder.amount);
				const priceDiff = (sellOrder.price - orderBook.sellOrders[orderBook.sellOrders.length - 1]?.price || sellOrder.price);
				slippage += (priceDiff / sellOrder.price) * (fillAmount / amount);

				remainingAmount -= fillAmount;
			}
		} else {
			// For sell orders, slippage occurs when hitting buy orders at lower prices
			for (const buyOrder of orderBook.buyOrders) {
				if (remainingAmount <= 0) break;

				const fillAmount = Math.min(remainingAmount, buyOrder.amount);
				const priceDiff = (orderBook.buyOrders[0]?.price || buyOrder.price) - buyOrder.price;
				slippage += Math.abs(priceDiff / buyOrder.price) * (fillAmount / amount);

				remainingAmount -= fillAmount;
			}
		}

		return Math.min(slippage, 0.1); // Cap slippage at 10%
	}

	/**
	 * Execute order against order book and AMM
	 */
	async executeOrder(orderId: number): Promise<TradeExecution> {
		const order = await this.orderBookRepository.findOne({
			where: { id: orderId, status: OrderStatus.PENDING },
		});

		if (!order) {
			return {
				success: false,
				executedAmount: 0,
				averagePrice: 0,
				totalCost: 0,
				fee: 0,
				slippage: 0,
				error: 'Order not found or already executed',
			};
		}

		const orderBook = await this.getOrderBook(order.asset);
		const currentPrice = await this.ammService.getCurrentPrice(order.asset);

		// Calculate slippage for large orders
		const slippage = this.calculateSlippage(order.asset, order.amount, order.type, orderBook);

		// Adjust price based on slippage
		const adjustedPrice = order.type === OrderType.BUY
			? order.price * (1 + slippage)
			: order.price * (1 - slippage);

		// Try order book matching first
		const orderBookResult = await this.matchOrderBook(order, orderBook);

		if (orderBookResult.executedAmount > 0) {
			// Update order status
			order.filledAmount += orderBookResult.executedAmount;
			order.remainingAmount -= orderBookResult.executedAmount;

			if (order.remainingAmount <= 0) {
				order.status = OrderStatus.FILLED;
			} else {
				order.status = OrderStatus.PARTIAL;
			}

			await this.orderBookRepository.save(order);

			return {
				success: true,
				executedAmount: orderBookResult.executedAmount,
				averagePrice: orderBookResult.averagePrice,
				totalCost: orderBookResult.totalCost,
				fee: orderBookResult.fee,
				slippage,
			};
		}

		// If no order book matches, use AMM
		const ammResult = await this.executeAMMOrder(order, adjustedPrice);

		if (ammResult.success) {
			// Update order status
			order.filledAmount += ammResult.executedAmount;
			order.remainingAmount -= ammResult.executedAmount;
			order.status = ammResult.executedAmount >= order.amount ? OrderStatus.FILLED : OrderStatus.PARTIAL;
			order.executedAt = new Date();

			await this.orderBookRepository.save(order);

			return {
				success: true,
				executedAmount: ammResult.executedAmount,
				averagePrice: ammResult.averagePrice,
				totalCost: ammResult.totalCost,
				fee: ammResult.fee,
				slippage: ammResult.slippage,
			};
		}

		return {
			success: false,
			executedAmount: 0,
			averagePrice: 0,
			totalCost: 0,
			fee: 0,
			slippage: 0,
			error: ammResult.error || 'Order execution failed',
		};
	}

	/**
	 * Match order against order book
	 */
	private async matchOrderBook(
		order: OrderBook,
		orderBook: { buyOrders: OrderBookEntry[]; sellOrders: OrderBookEntry[] }
	): Promise<TradeExecution> {
		let executedAmount = 0;
		let totalCost = 0;
		let weightedPriceSum = 0;

		if (order.type === OrderType.BUY) {
			// Match against sell orders (price <= order price)
			for (const sellOrder of orderBook.sellOrders) {
				if (sellOrder.price > order.price || executedAmount >= order.amount) break;

				const fillAmount = Math.min(
					order.remainingAmount - executedAmount,
					sellOrder.amount
				);

				if (fillAmount > 0) {
					executedAmount += fillAmount;
					totalCost += fillAmount * sellOrder.price;
					weightedPriceSum += fillAmount * sellOrder.price;

					// Update sell order
					await this.updateOrderStatus(sellOrder.id, fillAmount);
				}
			}
		} else {
			// Match against buy orders (price >= order price)
			for (const buyOrder of orderBook.buyOrders) {
				if (buyOrder.price < order.price || executedAmount >= order.amount) break;

				const fillAmount = Math.min(
					order.remainingAmount - executedAmount,
					buyOrder.amount
				);

				if (fillAmount > 0) {
					executedAmount += fillAmount;
					totalCost += fillAmount * buyOrder.price;
					weightedPriceSum += fillAmount * buyOrder.price;

					// Update buy order
					await this.updateOrderStatus(buyOrder.id, fillAmount);
				}
			}
		}

		const averagePrice = executedAmount > 0 ? weightedPriceSum / executedAmount : 0;
		const fee = totalCost * 0.001; // 0.1% fee

		return {
			success: true,
			executedAmount,
			averagePrice,
			totalCost,
			fee,
			slippage: 0,
		};
	}

	/**
	 * Execute order through AMM
	 */
	private async executeAMMOrder(
		order: OrderBook,
		adjustedPrice: number
	): Promise<TradeExecution & { slippage: number }> {
		const ammResult = await this.ammService.executeSwap(
			order.asset,
			order.amount,
			order.type === OrderType.BUY
		);

		if (!ammResult.success) {
			return {
				success: false,
				executedAmount: 0,
				averagePrice: 0,
				totalCost: 0,
				fee: 0,
				slippage: 0,
				error: ammResult.error,
			};
		}

		return {
			success: true,
			executedAmount: ammResult.outputAmount,
			averagePrice: ammResult.executionPrice,
			totalCost: order.amount * adjustedPrice,
			fee: ammResult.fee,
			slippage: ammResult.priceImpact,
		};
	}

	/**
	 * Update order status after partial fill
	 */
	private async updateOrderStatus(orderId: number, fillAmount: number): Promise<void> {
		const order = await this.orderBookRepository.findOne({ where: { id: orderId } });
		if (order) {
			order.filledAmount += fillAmount;
			order.remainingAmount -= fillAmount;

			if (order.remainingAmount <= 0) {
				order.status = OrderStatus.FILLED;
			} else {
				order.status = OrderStatus.PARTIAL;
			}

			await this.orderBookRepository.save(order);
		}
	}

	/**
	 * Cancel an order
	 */
	async cancelOrder(orderId: number, userId: number): Promise<boolean> {
		const order = await this.orderBookRepository.findOne({
			where: { id: orderId, userId, status: OrderStatus.PENDING },
		});

		if (!order) {
			return false;
		}

		order.status = OrderStatus.CANCELLED;
		await this.orderBookRepository.save(order);

		return true;
	}
}

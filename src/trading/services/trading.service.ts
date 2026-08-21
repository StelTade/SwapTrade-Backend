import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Order } from '../entities/order.entity';
import { Trade } from '../entities/trade.entity';
import { CreateOrderDto } from '../dto/create-order.dto';
import { MatchingEngine } from './matching-engine.service';
import { WalletLedgerService } from '../../wallet/services/wallet-ledger.service';
import { OrderSide, OrderStatus } from '../enums/order.enum';

@Injectable()
export class TradingService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Trade)
    private readonly tradeRepository: Repository<Trade>,
    private readonly matchingEngine: MatchingEngine,
    private readonly walletLedgerService: WalletLedgerService,
    private readonly entityManager: EntityManager,
  ) {}

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<Order> {
    const { assetPair, side, type, price, quantity } = createOrderDto;
    const [baseAsset, quoteAsset] = assetPair.split('/');

    return this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const balanceAsset = side === OrderSide.BUY ? quoteAsset : baseAsset;
        const balanceNeeded =
          side === OrderSide.BUY ? price * quantity : quantity;

        const hasSufficientBalance =
          await this.walletLedgerService.hasSufficientBalance(
            userId,
            balanceAsset,
            balanceNeeded,
          );

        if (!hasSufficientBalance) {
          throw new BadRequestException('Insufficient balance');
        }

        await this.walletLedgerService.reserveBalance(
          userId,
          balanceAsset,
          balanceNeeded,
          transactionalEntityManager,
        );

        const order = new Order();
        order.userId = userId;
        order.assetPair = assetPair;
        order.side = side;
        order.type = type;
        order.price = price;
        order.quantity = quantity;
        order.status = OrderStatus.OPEN;

        const savedOrder = await transactionalEntityManager.save(order);
        const trades = this.matchingEngine.addOrder(savedOrder);

        for (const trade of trades) {
          await this.processTrade(trade, transactionalEntityManager);
        }

        return savedOrder;
      },
    );
  }

  private async processTrade(
    trade: Trade,
    entityManager: EntityManager,
  ): Promise<void> {
    const takerOrder = await entityManager.findOne(Order, {
      where: { id: trade.takerOrderId },
    });
    const makerOrder = await entityManager.findOne(Order, {
      where: { id: trade.makerOrderId },
    });

    if (!takerOrder || !makerOrder) {
      return;
    }

    const [baseAsset, quoteAsset] = trade.assetPair.split('/');

    await this.walletLedgerService.releaseAndTransfer(
      takerOrder.userId,
      makerOrder.userId,
      quoteAsset,
      baseAsset,
      trade.price * trade.quantity,
      trade.quantity,
      entityManager,
    );

    await entityManager.save(trade);
    await entityManager.save(takerOrder);
    await entityManager.save(makerOrder);
  }
}

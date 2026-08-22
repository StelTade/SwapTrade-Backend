import { Test, TestingModule } from '@nestjs/testing';
import { TradingController } from './trading.controller';
import { TradingService } from '../services/trading.service';
import { CreateOrderDto } from '../dto/create-order.dto';
import { OrderSide, OrderType, OrderStatus } from '../enums/order.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

describe('TradingController', () => {
  let controller: TradingController;
  let service: TradingService;

  beforeEach(async () => {
    const mockTradingService = {
      createOrder: jest.fn().mockImplementation((userId, dto) =>
        Promise.resolve({
          id: 'order-123',
          userId,
          ...dto,
          status: OrderStatus.OPEN,
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TradingController],
      providers: [{ provide: TradingService, useValue: mockTradingService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TradingController>(TradingController);
    service = module.get<TradingService>(TradingService);
  });

  it('should create order for authenticated user', async () => {
    const req = { user: { userId: 'user-456' } };
    const dto: CreateOrderDto = {
      assetPair: 'SOL/USDC',
      side: OrderSide.BUY,
      type: OrderType.LIMIT,
      price: 150,
      quantity: 5,
    };

    const result = await controller.createOrder(req, dto);
    expect(result).toBeDefined();
    expect(service.createOrder).toHaveBeenCalledWith('user-456', dto);
  });
});

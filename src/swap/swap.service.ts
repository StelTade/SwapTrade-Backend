import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserBalance } from '../balance/entities/user-balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { CreateSwapDto } from './dto/create-swap.dto';
import { CurrencyService } from '../balance/service/currency.service';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Execute a token swap from one asset to another for a user.
   * Supports both synchronous execution and future async expansion.
   */
  async executeSwap(dto: CreateSwapDto): Promise<{
    userId: number;
    fromAssetId: number;
    toAssetId: number;
    sentAmount: number;
    receivedAmount: number;
  }> {
    const { userId, from, to, amount } = dto;

    if (from === to) {
      throw new BadRequestException('from and to must be different assets');
    }
    if (amount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    // Ensure both tokens are supported
    const [fromAsset, toAsset] = await Promise.all([
      this.assetRepo.findOne({ where: { symbol: from } }),
      this.assetRepo.findOne({ where: { symbol: to } }),
    ]);
    
    if (!fromAsset) throw new NotFoundException(`Unsupported asset symbol: ${from}`);
    if (!toAsset) throw new NotFoundException(`Unsupported asset symbol: ${to}`);

    // Calculate receive amount using CurrencyService logic
    // This uses the real DB prices, not a simulation
    const receiveAmount = await this.currencyService.convert(amount, fromAsset.id, toAsset.id);

    // Transaction to ensure atomic updates
    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(UserBalance);

      // Load balances
      let fromBalance = await balanceRepo.findOne({ where: { userId, assetId: fromAsset.id } });
      let toBalance = await balanceRepo.findOne({ where: { userId, assetId: toAsset.id } });

      if (!fromBalance || Number(fromBalance.balance) < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      // Update balances
      fromBalance.balance = Number(fromBalance.balance) - amount;
      await balanceRepo.save(fromBalance);
      
      if (toBalance) {
        toBalance.balance = Number(toBalance.balance) + receiveAmount;
        await balanceRepo.save(toBalance);
      } else {
        toBalance = balanceRepo.create({ 
            userId, 
            assetId: toAsset.id, 
            balance: receiveAmount,
            totalInvested: 0,
            cumulativePnL: 0,
            averageBuyPrice: 0 // Initialize new balance fields
        });
        await balanceRepo.save(toBalance);
      }

      this.logger.log(`Swap executed: User ${userId} swapped ${amount} ${from} for ${receiveAmount} ${to}`);

      return {
        userId,
        fromAssetId: fromAsset.id,
        toAssetId: toAsset.id,
        sentAmount: amount,
        receivedAmount: receiveAmount,
      };
    });
  }
}

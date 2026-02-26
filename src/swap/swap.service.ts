import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserBalance } from '../balance/user-balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { CreateSwapDto } from './dto/create-swap.dto';
import { CurrencyService } from '../balance/service/currency.service';

@Injectable()
export class SwapService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Execute a token swap from one asset to another for a user.
   */
  async executeSwap(dto: CreateSwapDto): Promise<{
    userId: number;
    fromAssetId: number;
    toAssetId: number;
    sentAmount: number;
    receivedAmount: number;
  }> {
    const { userId, fromAssetId, toAssetId, amount } = dto;

    if (fromAssetId === toAssetId) {
      throw new BadRequestException('from and to must be different assets');
    }
    if (amount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    // Ensure both tokens are supported
    const [fromAsset, toAsset] = await Promise.all([
      this.assetRepo.findOne({ where: { id: fromAssetId } }),
      this.assetRepo.findOne({ where: { id: toAssetId } }),
    ]);
    
    if (!fromAsset) throw new NotFoundException(`Unsupported asset ID: ${fromAssetId}`);
    if (!toAsset) throw new NotFoundException(`Unsupported asset ID: ${toAssetId}`);

    // Calculate receive amount using CurrencyService logic
    const receiveAmount = await this.currencyService.convert(amount, fromAssetId, toAssetId);

    // Transaction to ensure atomic updates
    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(UserBalance);

      // Load balances
      let fromBalance = await balanceRepo.findOne({ where: { userId, assetId: fromAssetId } });
      let toBalance = await balanceRepo.findOne({ where: { userId, assetId: toAssetId } });

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
            assetId: toAssetId, 
            balance: receiveAmount,
            totalInvested: 0,
            cumulativePnL: 0,
            averageBuyPrice: 0 // Initialize new balance fields
        });
        await balanceRepo.save(toBalance);
      }

      return {
        userId,
        fromAssetId,
        toAssetId,
        sentAmount: amount,
        receivedAmount: receiveAmount,
      };
    });
  }
}

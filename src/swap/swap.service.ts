/**
 * Swap Service
 *
 * Contains business logic for swap operations.
 * TODO: Implement swap service methods.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Balance } from '../balance/balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { CreateSwapDto } from './dto/create-swap.dto';

@Injectable()
export class SwapService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
  ) {}

  /**
   * Execute a token swap from one asset to another for a user.
   * Current pricing policy: 1:1 swap rate (placeholder). Replace with real pricing when available.
   */
  async executeSwap(dto: CreateSwapDto): Promise<{
    userId: string;
    from: { asset: string; balance: number };
    to: { asset: string; balance: number };
  }> {
    const { userId, from, to, amount } = dto;

    if (from === to) {
      throw new BadRequestException('from and to must be different tokens');
    }
    if (amount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    // Ensure both tokens are supported
    const [fromAsset, toAsset] = await Promise.all([
      this.assetRepo.findOne({ where: { symbol: from } }),
      this.assetRepo.findOne({ where: { symbol: to } }),
    ]);
    if (!fromAsset) throw new NotFoundException(`Unsupported token: ${from}`);
    if (!toAsset) throw new NotFoundException(`Unsupported token: ${to}`);

    // Transaction to ensure atomic updates
    return this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(Balance);

      // Load balances
      let fromBalance = await balanceRepo.findOne({ where: { userId, asset: from } });
      let toBalance = await balanceRepo.findOne({ where: { userId, asset: to } });

      if (!fromBalance || fromBalance.balance < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      // 1:1 rate placeholder
      const receiveAmount = amount;

      // Update balances
      fromBalance.balance = Number(fromBalance.balance) - amount;
      if (toBalance) {
        toBalance.balance = Number(toBalance.balance) + receiveAmount;
      } else {
        toBalance = balanceRepo.create({ userId, asset: to, balance: receiveAmount });
      }

      await balanceRepo.save([fromBalance, toBalance]);

      return {
        userId,
        from: { asset: from, balance: fromBalance.balance },
        to: { asset: to, balance: toBalance.balance },
      };
    });
  }
}

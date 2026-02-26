import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VirtualAsset } from '../entities/virtual-asset.entity';
import { UserBalanceService } from 'src/balance/service/user-balance.service';

@Injectable()
export class AssetMintingService {
  constructor(
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly userBalanceService: UserBalanceService,
  ) { }

  async mintAsset(userId: string, assetSymbol: string, amount: number) {
    // 1. Validate asset exists
    const asset = await this.assetRepo.findOne({
      where: { symbol: assetSymbol },
    });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetSymbol} not found`);
    }

    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      throw new Error('Invalid userId: must be a number');
    }

    // 2. Update or create user balance
    return this.userBalanceService.addBalance(userIdNum, asset.id, amount);
  }
}

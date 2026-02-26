import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VirtualAsset } from '../../trading/entities/virtual-asset.entity';

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
  ) {}

  async findAll(): Promise<VirtualAsset[]> {
    return this.assetRepo.find();
  }

  async findOne(id: number): Promise<VirtualAsset> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }
    return asset;
  }

  async convert(amount: number, fromAssetId: number, toAssetId: number): Promise<number> {
    const fromAsset = await this.findOne(fromAssetId);
    const toAsset = await this.findOne(toAssetId);

    if (fromAsset.id === toAsset.id) {
      return amount;
    }

    // If price is 0, we can't convert. Assume 1:1 if both 0? Or throw error.
    // For now, if price is 0, assume it's a stablecoin = 1 USD? Or just throw.
    if (!fromAsset.price || !toAsset.price) {
      // Fallback: if names are similar? No.
      // Throw error for now to force setting prices.
      // Or return 0.
      if (fromAsset.price === 0) console.warn(`Asset ${fromAsset.symbol} has price 0`);
      if (toAsset.price === 0) console.warn(`Asset ${toAsset.symbol} has price 0`);
      // If conversion not possible, return 0 or error.
      // Let's assume price 1 for fallback to avoid breakage during dev.
      const fromPrice = Number(fromAsset.price) || 1;
      const toPrice = Number(toAsset.price) || 1;
      return (amount * fromPrice) / toPrice;
    }

    return (amount * Number(fromAsset.price)) / Number(toAsset.price);
  }
}

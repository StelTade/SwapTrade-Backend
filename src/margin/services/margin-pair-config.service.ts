import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { CreateMarginPairConfigDto } from '../dto/create-margin-pair-config.dto';
import { UpdateMarginPairConfigDto } from '../dto/update-margin-pair-config.dto';

@Injectable()
export class MarginPairConfigService {
  constructor(
    @InjectRepository(MarginPairConfig)
    private readonly configRepo: Repository<MarginPairConfig>,
  ) {}

  async create(dto: CreateMarginPairConfigDto): Promise<MarginPairConfig> {
    const config = this.configRepo.create({
      baseAssetId: dto.baseAssetId,
      quoteAssetId: dto.quoteAssetId,
      maxLeverage: dto.maxLeverage ?? 10,
      initialMarginRate: dto.initialMarginRate ?? 0.1,
      maintenanceMarginRate: dto.maintenanceMarginRate ?? 0.05,
      dailyInterestRateBps: dto.dailyInterestRateBps ?? 10,
      volatilityPct: dto.volatilityPct ?? 50,
      volatilityLeverageFactor: dto.volatilityLeverageFactor ?? 2,
      marginCallThresholdRatio: dto.marginCallThresholdRatio ?? 1.15,
      isEnabled: dto.isEnabled ?? true,
    });
    return this.configRepo.save(config);
  }

  async update(
    id: number,
    dto: UpdateMarginPairConfigDto,
  ): Promise<MarginPairConfig> {
    const config = await this.getById(id);
    Object.assign(config, dto);
    return this.configRepo.save(config);
  }

  async getById(id: number): Promise<MarginPairConfig> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Margin pair config ${id} not found`);
    }
    return config;
  }

  async getByPair(
    baseAssetId: number,
    quoteAssetId: number,
  ): Promise<MarginPairConfig | null> {
    return this.configRepo.findOne({
      where: { baseAssetId, quoteAssetId, isEnabled: true },
    });
  }

  async listAll(): Promise<MarginPairConfig[]> {
    return this.configRepo.find({ order: { id: 'ASC' } });
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptionContract } from '../entities/option-contract.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { OptionType } from '../enums/option-type.enum';
import { ExerciseStyle } from '../enums/exercise-style.enum';
import { BlackScholesService } from './black-scholes.service';
import { CreateOptionContractDto } from '../dto/create-option-contract.dto';

@Injectable()
export class OptionContractService {
  constructor(
    @InjectRepository(OptionContract)
    private readonly contractRepo: Repository<OptionContract>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
    private readonly blackScholes: BlackScholesService,
  ) {}

  async createContract(dto: CreateOptionContractDto): Promise<OptionContract> {
    const underlying = await this.assetRepo.findOne({
      where: { id: dto.underlyingAssetId },
    });
    if (!underlying) {
      throw new NotFoundException(
        `Underlying asset ${dto.underlyingAssetId} not found`,
      );
    }

    const expirationDate = new Date(dto.expirationDate);
    if (isNaN(expirationDate.getTime())) {
      throw new BadRequestException('Invalid expiration date');
    }
    if (expirationDate <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    if (dto.strikePrice <= 0) {
      throw new BadRequestException('Strike price must be positive');
    }

    // Validate strike is within reasonable bounds of underlying price
    const underlyingPrice = dto.underlyingPrice ?? Number(underlying.price);
    if (underlyingPrice <= 0) {
      throw new BadRequestException(
        'Underlying asset must have a valid price',
      );
    }

    const strikeRatio = dto.strikePrice / underlyingPrice;
    if (strikeRatio < 0.1 || strikeRatio > 10) {
      throw new BadRequestException(
        `Strike price ${dto.strikePrice} is outside reasonable bounds (10%-1000% of underlying price ${underlyingPrice})`,
      );
    }

    const iv = dto.impliedVolatility ?? 0.3;
    const rfr = dto.riskFreeRate ?? 0.05;
    const totalSupply = dto.totalSupply ?? 1000;
    const contractSize = dto.contractSize ?? 1;
    const exerciseStyle = dto.exerciseStyle ?? ExerciseStyle.EUROPEAN;

    // Calculate pricing using Black-Scholes
    const timeToExpiry = this.blackScholes.calculateTimeToExpiry(expirationDate);
    const bsResult = this.blackScholes.calculate(
      underlyingPrice,
      dto.strikePrice,
      timeToExpiry,
      rfr,
      iv,
      dto.optionType,
    );

    const inTheMoney = this.blackScholes.isInTheMoney(
      underlyingPrice,
      dto.strikePrice,
      dto.optionType,
    );

    const contract = this.contractRepo.create({
      optionType: dto.optionType,
      exerciseStyle,
      underlyingAssetId: dto.underlyingAssetId,
      strikePrice: dto.strikePrice,
      expirationDate,
      contractSize,
      underlyingPriceAtCreation: underlyingPrice,
      premium: bsResult.price,
      impliedVolatility: iv,
      riskFreeRate: rfr,
      delta: bsResult.delta,
      gamma: bsResult.gamma,
      vega: bsResult.vega,
      theta: bsResult.theta,
      rho: bsResult.rho,
      totalSupply,
      openInterest: totalSupply,
      inTheMoney,
      status: OptionStatus.ACTIVE,
    });

    return this.contractRepo.save(contract);
  }

  async getContract(id: number): Promise<OptionContract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['underlyingAsset'],
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${id} not found`);
    }
    return contract;
  }

  async listContracts(filters?: {
    underlyingAssetId?: number;
    optionType?: OptionType;
    status?: OptionStatus;
  }): Promise<OptionContract[]> {
    const where: Record<string, unknown> = {};
    if (filters?.underlyingAssetId) {
      where.underlyingAssetId = filters.underlyingAssetId;
    }
    if (filters?.optionType) {
      where.optionType = filters.optionType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.contractRepo.find({
      where,
      relations: ['underlyingAsset'],
      order: { expirationDate: 'ASC' },
    });
  }

  async recalculatePrice(
    contractId: number,
    currentUnderlyingPrice: number,
  ): Promise<OptionContract> {
    const contract = await this.getContract(contractId);

    if (contract.status !== OptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract ${contractId} is not active (status=${contract.status})`,
      );
    }

    const timeToExpiry = this.blackScholes.calculateTimeToExpiry(
      contract.expirationDate,
    );

    const bsResult = this.blackScholes.calculate(
      currentUnderlyingPrice,
      Number(contract.strikePrice),
      timeToExpiry,
      Number(contract.riskFreeRate),
      Number(contract.impliedVolatility),
      contract.optionType,
    );

    contract.premium = bsResult.price;
    contract.delta = bsResult.delta;
    contract.gamma = bsResult.gamma;
    contract.vega = bsResult.vega;
    contract.theta = bsResult.theta;
    contract.rho = bsResult.rho;
    contract.inTheMoney = this.blackScholes.isInTheMoney(
      currentUnderlyingPrice,
      Number(contract.strikePrice),
      contract.optionType,
    );

    return this.contractRepo.save(contract);
  }

  async expireContract(contractId: number): Promise<OptionContract> {
    const contract = await this.getContract(contractId);

    if (contract.status !== OptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract ${contractId} is not active`,
      );
    }

    contract.status = OptionStatus.EXPIRED;
    contract.openInterest = 0;
    return this.contractRepo.save(contract);
  }

  async getContractsExpiringBefore(date: Date): Promise<OptionContract[]> {
    return this.contractRepo.find({
      where: {
        status: OptionStatus.ACTIVE,
      },
      order: { expirationDate: 'ASC' },
    }).then((contracts) =>
      contracts.filter((c) => c.expirationDate <= date),
    );
  }
}

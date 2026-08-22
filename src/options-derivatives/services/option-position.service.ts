import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptionPosition } from '../entities/option-position.entity';
import { OptionContract } from '../entities/option-contract.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { BlackScholesService } from './black-scholes.service';
import { BuyOptionDto } from '../dto/buy-option.dto';

@Injectable()
export class OptionPositionService {
  constructor(
    @InjectRepository(OptionPosition)
    private readonly positionRepo: Repository<OptionPosition>,
    @InjectRepository(OptionContract)
    private readonly contractRepo: Repository<OptionContract>,
    private readonly blackScholes: BlackScholesService,
  ) {}

  async buyOption(dto: BuyOptionDto): Promise<OptionPosition> {
    const contract = await this.contractRepo.findOne({
      where: { id: dto.contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${dto.contractId} not found`);
    }

    if (contract.status !== OptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract ${dto.contractId} is not active (status=${contract.status})`,
      );
    }

    if (Number(contract.openInterest) < dto.quantity) {
      throw new BadRequestException(
        `Insufficient open interest: requested ${dto.quantity}, available ${contract.openInterest}`,
      );
    }

    const totalPremium =
      this.blackScholes.round8(Number(contract.premium) * dto.quantity);

    // Decrease open interest
    contract.openInterest = this.blackScholes.round8(
      Number(contract.openInterest) - dto.quantity,
    );
    await this.contractRepo.save(contract);

    // Create/update buyer position
    let position = await this.positionRepo.findOne({
      where: { userId: dto.userId, contractId: dto.contractId, isWriter: false },
    });

    if (position) {
      const prevTotal = Number(position.quantity) * Number(position.averagePremium);
      position.quantity = this.blackScholes.round8(
        Number(position.quantity) + dto.quantity,
      );
      position.averagePremium = this.blackScholes.round8(
        (prevTotal + totalPremium) / Number(position.quantity),
      );
      position.totalPremium = this.blackScholes.round8(
        Number(position.totalPremium) + totalPremium,
      );
    } else {
      position = this.positionRepo.create({
        userId: dto.userId,
        contractId: dto.contractId,
        isWriter: false,
        quantity: dto.quantity,
        averagePremium: Number(contract.premium),
        totalPremium,
        realizedPnl: 0,
        unrealizedPnl: 0,
        exercisedQuantity: 0,
      });
    }

    return this.positionRepo.save(position);
  }

  async writeOption(
    dto: BuyOptionDto,
    collateralAssetId: number,
  ): Promise<OptionPosition> {
    const contract = await this.contractRepo.findOne({
      where: { id: dto.contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${dto.contractId} not found`);
    }

    if (contract.status !== OptionStatus.ACTIVE) {
      throw new BadRequestException(
        `Contract ${dto.contractId} is not active (status=${contract.status})`,
      );
    }

    const totalPremium = this.blackScholes.round8(
      Number(contract.premium) * dto.quantity,
    );

    // Create/update writer position
    let position = await this.positionRepo.findOne({
      where: { userId: dto.userId, contractId: dto.contractId, isWriter: true },
    });

    if (position) {
      const prevTotal =
        Number(position.quantity) * Number(position.averagePremium);
      position.quantity = this.blackScholes.round8(
        Number(position.quantity) + dto.quantity,
      );
      position.averagePremium = this.blackScholes.round8(
        (prevTotal + totalPremium) / Number(position.quantity),
      );
      position.totalPremium = this.blackScholes.round8(
        Number(position.totalPremium) + totalPremium,
      );
    } else {
      position = this.positionRepo.create({
        userId: dto.userId,
        contractId: dto.contractId,
        isWriter: true,
        quantity: dto.quantity,
        averagePremium: Number(contract.premium),
        totalPremium,
        realizedPnl: 0,
        unrealizedPnl: 0,
        exercisedQuantity: 0,
      });
    }

    return this.positionRepo.save(position);
  }

  async getUserPositions(userId: number): Promise<OptionPosition[]> {
    return this.positionRepo.find({
      where: { userId },
      relations: ['contract', 'contract.underlyingAsset'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserPositionsForContract(
    userId: number,
    contractId: number,
  ): Promise<OptionPosition[]> {
    return this.positionRepo.find({
      where: { userId, contractId },
      relations: ['contract'],
    });
  }

  async getPosition(positionId: number): Promise<OptionPosition> {
    const position = await this.positionRepo.findOne({
      where: { id: positionId },
      relations: ['contract', 'contract.underlyingAsset'],
    });
    if (!position) {
      throw new NotFoundException(`Position ${positionId} not found`);
    }
    return position;
  }

  async updateUnrealizedPnl(
    positionId: number,
    currentUnderlyingPrice: number,
  ): Promise<OptionPosition> {
    const position = await this.getPosition(positionId);

    if (Number(position.quantity) <= Number(position.exercisedQuantity)) {
      return position; // Nothing left to value
    }

    const contract = position.contract;
    const remainingQty = this.blackScholes.round8(
      Number(position.quantity) - Number(position.exercisedQuantity),
    );

    const bsResult = this.blackScholes.calculate(
      currentUnderlyingPrice,
      Number(contract.strikePrice),
      this.blackScholes.calculateTimeToExpiry(contract.expirationDate),
      Number(contract.riskFreeRate),
      Number(contract.impliedVolatility),
      contract.optionType,
    );

    const currentPrice = bsResult.price;
    let unrealizedPnl: number;

    if (position.isWriter) {
      // Writer profits if option loses value
      unrealizedPnl = this.blackScholes.round8(
        Number(position.totalPremium) - currentPrice * remainingQty,
      );
    } else {
      // Holder profits if option gains value
      unrealizedPnl = this.blackScholes.round8(
        currentPrice * remainingQty - Number(position.totalPremium),
      );
    }

    position.unrealizedPnl = unrealizedPnl;
    return this.positionRepo.save(position);
  }

  async getUserPortfolioSummary(userId: number): Promise<{
    totalPositions: number;
    totalHolderPositions: number;
    totalWriterPositions: number;
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    totalPremiumPaid: number;
    totalPremiumReceived: number;
  }> {
    const positions = await this.getUserPositions(userId);

    let totalHolderPositions = 0;
    let totalWriterPositions = 0;
    let totalUnrealizedPnl = 0;
    let totalRealizedPnl = 0;
    let totalPremiumPaid = 0;
    let totalPremiumReceived = 0;

    for (const pos of positions) {
      if (pos.isWriter) {
        totalWriterPositions++;
        totalPremiumReceived += Number(pos.totalPremium);
      } else {
        totalHolderPositions++;
        totalPremiumPaid += Number(pos.totalPremium);
      }
      totalUnrealizedPnl += Number(pos.unrealizedPnl);
      totalRealizedPnl += Number(pos.realizedPnl);
    }

    return {
      totalPositions: positions.length,
      totalHolderPositions,
      totalWriterPositions,
      totalUnrealizedPnl: this.blackScholes.round8(totalUnrealizedPnl),
      totalRealizedPnl: this.blackScholes.round8(totalRealizedPnl),
      totalPremiumPaid: this.blackScholes.round8(totalPremiumPaid),
      totalPremiumReceived: this.blackScholes.round8(totalPremiumReceived),
    };
  }
}

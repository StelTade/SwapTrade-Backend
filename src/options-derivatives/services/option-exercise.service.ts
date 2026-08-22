import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OptionContract } from '../entities/option-contract.entity';
import { OptionPosition } from '../entities/option-position.entity';
import { OptionCollateral } from '../entities/option-collateral.entity';
import { UserBalance } from '../../database/entities/user-balance.entity';
import { OptionStatus } from '../enums/option-status.enum';
import { ExerciseStyle } from '../enums/exercise-style.enum';
import { CollateralStatus } from '../enums/collateral-status.enum';
import { BlackScholesService } from './black-scholes.service';
import { ExerciseOptionDto } from '../dto/exercise-option.dto';

export interface ExerciseResult {
  contractId: number;
  userId: number;
  quantity: number;
  settlementAmount: number;
  pnl: number;
  exercisedAt: Date;
}

@Injectable()
export class OptionExerciseService {
  constructor(
    @InjectRepository(OptionContract)
    private readonly contractRepo: Repository<OptionContract>,
    @InjectRepository(OptionPosition)
    private readonly positionRepo: Repository<OptionPosition>,
    @InjectRepository(OptionCollateral)
    private readonly collateralRepo: Repository<OptionCollateral>,
    private readonly dataSource: DataSource,
    private readonly blackScholes: BlackScholesService,
  ) {}

  /**
   * Exercise an option contract (European-style: only at expiration window).
   */
  async exerciseOption(dto: ExerciseOptionDto): Promise<ExerciseResult> {
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

    // Check expiration validity
    const now = new Date();
    if (contract.exerciseStyle === ExerciseStyle.EUROPEAN) {
      // European: can only exercise on expiration date (within 24h window)
      const timeDiff = Math.abs(
        contract.expirationDate.getTime() - now.getTime(),
      );
      const twentyFourHours = 24 * 60 * 60 * 1000;
      if (now < contract.expirationDate && timeDiff > twentyFourHours) {
        throw new BadRequestException(
          'European options can only be exercised at expiration',
        );
      }
      if (now > contract.expirationDate && timeDiff > twentyFourHours) {
        throw new BadRequestException(
          'Option has expired beyond the exercise window',
        );
      }
    }
    // American: can exercise any time before expiration
    if (
      contract.exerciseStyle === ExerciseStyle.AMERICAN &&
      now > contract.expirationDate
    ) {
      throw new BadRequestException('Option has expired');
    }

    // Find holder position
    const position = await this.positionRepo.findOne({
      where: {
        userId: dto.userId,
        contractId: dto.contractId,
        isWriter: false,
      },
    });

    if (!position) {
      throw new NotFoundException(
        `No position found for user ${dto.userId} on contract ${dto.contractId}`,
      );
    }

    const remainingQty = this.blackScholes.round8(
      Number(position.quantity) - Number(position.exercisedQuantity),
    );

    if (remainingQty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient position: requested ${dto.quantity}, available ${remainingQty}`,
      );
    }

    // Calculate settlement
    const intrinsicValue = this.calculateIntrinsicValue(
      contract.optionType,
      dto.currentPrice,
      Number(contract.strikePrice),
    );

    const settlementAmount = this.blackScholes.round8(
      intrinsicValue * dto.quantity * Number(contract.contractSize),
    );

    const pnl = this.blackScholes.round8(
      settlementAmount - Number(position.averagePremium) * dto.quantity,
    );

    // Execute settlement in transaction
    await this.dataSource.transaction(async (manager) => {
      // Update holder position
      position.exercisedQuantity = this.blackScholes.round8(
        Number(position.exercisedQuantity) + dto.quantity,
      );
      position.realizedPnl = this.blackScholes.round8(
        Number(position.realizedPnl) + pnl,
      );
      await manager.save(OptionPosition, position);

      // Pay holder if in-the-money
      if (settlementAmount > 0) {
        await this.creditUser(
          manager,
          dto.userId,
          contract.underlyingAssetId,
          settlementAmount,
        );
      }

      // Find writer and debit them
      const writerPosition = await manager.findOne(OptionPosition, {
        where: {
          contractId: dto.contractId,
          isWriter: true,
        },
      });

      if (writerPosition) {
        const writerPnl = this.blackScholes.round8(-settlementAmount);
        writerPosition.realizedPnl = this.blackScholes.round8(
          Number(writerPosition.realizedPnl) + writerPnl,
        );
        await manager.save(OptionPosition, writerPosition);

        // Release writer's collateral proportionally
        const collateral = await manager.findOne(OptionCollateral, {
          where: {
            userId: writerPosition.userId,
            contractId: dto.contractId,
            status: CollateralStatus.LOCKED,
          },
        });

        if (collateral) {
          const releasedAmount = this.blackScholes.round8(
            (Number(collateral.lockedAmount) /
              Number(collateral.coveredContracts)) *
              dto.quantity,
          );

          collateral.remainingAmount = this.blackScholes.round8(
            Number(collateral.remainingAmount) - releasedAmount,
          );
          collateral.coveredContracts = this.blackScholes.round8(
            Number(collateral.coveredContracts) - dto.quantity,
          );

          if (
            Number(collateral.remainingAmount) <= 0 ||
            Number(collateral.coveredContracts) <= 0
          ) {
            collateral.status = CollateralStatus.RELEASED;
            collateral.releasedAt = new Date();
          } else {
            collateral.status = CollateralStatus.PARTIALLY_RELEASED;
          }
          await manager.save(OptionCollateral, collateral);
        }
      }

      // Update contract open interest
      contract.openInterest = this.blackScholes.round8(
        Number(contract.openInterest) - dto.quantity,
      );

      // If all contracts exercised or expired, mark as exercised
      if (Number(contract.openInterest) <= 0) {
        contract.status = OptionStatus.EXERCISED;
      }
      await manager.save(OptionContract, contract);
    });

    return {
      contractId: dto.contractId,
      userId: dto.userId,
      quantity: dto.quantity,
      settlementAmount,
      pnl,
      exercisedAt: new Date(),
    };
  }

  /**
   * Expire all contracts past their expiration date.
   */
  async expireContracts(now: Date = new Date()): Promise<number> {
    const expiredContracts = await this.contractRepo
      .createQueryBuilder('c')
      .where('c.status = :status', { status: OptionStatus.ACTIVE })
      .andWhere('c.expirationDate <= :now', { now })
      .getMany();

    let count = 0;
    for (const contract of expiredContracts) {
      contract.status = OptionStatus.EXPIRED;
      contract.openInterest = 0;
      await this.contractRepo.save(contract);
      count++;
    }

    return count;
  }

  /**
   * Calculate intrinsic value for exercise settlement.
   */
  private calculateIntrinsicValue(
    optionType: string,
    spotPrice: number,
    strikePrice: number,
  ): number {
    if (optionType === 'CALL') {
      return Math.max(0, spotPrice - strikePrice);
    }
    return Math.max(0, strikePrice - spotPrice);
  }

  /**
   * Credit user balance (used for settlement payouts).
   */
  private async creditUser(
    manager: any,
    userId: number,
    assetId: number,
    amount: number,
  ): Promise<void> {
    const balanceRepo = manager.getRepository(UserBalance);
    let balance = await balanceRepo.findOne({
      where: { userId, assetId },
    });

    if (!balance) {
      balance = balanceRepo.create({
        userId,
        assetId,
        balance: amount,
        lockedBalance: 0,
      });
    } else {
      balance.balance = Number(balance.balance) + amount;
    }

    await balanceRepo.save(balance);
  }
}

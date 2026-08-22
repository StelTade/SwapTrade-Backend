import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OptionCollateral } from '../entities/option-collateral.entity';
import { OptionContract } from '../entities/option-contract.entity';
import { CollateralStatus } from '../enums/collateral-status.enum';
import { BlackScholesService } from './black-scholes.service';

@Injectable()
export class OptionCollateralService {
  constructor(
    @InjectRepository(OptionCollateral)
    private readonly collateralRepo: Repository<OptionCollateral>,
    @InjectRepository(OptionContract)
    private readonly contractRepo: Repository<OptionContract>,
    private readonly blackScholes: BlackScholesService,
  ) {}

  /**
   * Lock collateral for a writer's option position.
   * For covered calls: lock underlying asset value.
   * For cash-secured puts: lock cash at strike * size.
   */
  async lockCollateral(
    userId: number,
    contractId: number,
    quantity: number,
    collateralAssetId: number,
  ): Promise<OptionCollateral> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${contractId} not found`);
    }

    const requiredCollateral = this.calculateRequiredCollateral(
      contract,
      quantity,
    );

    // Check existing collateral
    const existing = await this.collateralRepo.findOne({
      where: { userId, contractId, status: CollateralStatus.LOCKED },
    });

    let collateral: OptionCollateral;

    if (existing) {
      existing.lockedAmount = this.blackScholes.round8(
        Number(existing.lockedAmount) + requiredCollateral,
      );
      existing.remainingAmount = this.blackScholes.round8(
        Number(existing.remainingAmount) + requiredCollateral,
      );
      existing.coveredContracts = this.blackScholes.round8(
        Number(existing.coveredContracts) + quantity,
      );
      collateral = existing;
    } else {
      collateral = this.collateralRepo.create({
        userId,
        contractId,
        collateralAssetId,
        lockedAmount: requiredCollateral,
        remainingAmount: requiredCollateral,
        coveredContracts: quantity,
        status: CollateralStatus.LOCKED,
        lockedAt: new Date(),
      });
    }

    return this.collateralRepo.save(collateral);
  }

  /**
   * Release collateral when contracts expire or are exercised.
   */
  async releaseCollateral(
    userId: number,
    contractId: number,
    quantity: number,
  ): Promise<OptionCollateral> {
    const collateral = await this.collateralRepo.findOne({
      where: { userId, contractId, status: CollateralStatus.LOCKED },
    });

    if (!collateral) {
      throw new NotFoundException(
        `No locked collateral found for user ${userId} on contract ${contractId}`,
      );
    }

    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${contractId} not found`);
    }

    const releasedAmount = this.blackScholes.round8(
      (Number(collateral.lockedAmount) / Number(collateral.coveredContracts)) *
        quantity,
    );

    collateral.remainingAmount = this.blackScholes.round8(
      Number(collateral.remainingAmount) - releasedAmount,
    );
    collateral.coveredContracts = this.blackScholes.round8(
      Number(collateral.coveredContracts) - quantity,
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

    return this.collateralRepo.save(collateral);
  }

  /**
   * Liquidate collateral if writer defaults.
   */
  async liquidateCollateral(
    userId: number,
    contractId: number,
  ): Promise<OptionCollateral> {
    const collateral = await this.collateralRepo.findOne({
      where: { userId, contractId, status: CollateralStatus.LOCKED },
    });

    if (!collateral) {
      throw new NotFoundException(
        `No locked collateral found for user ${userId} on contract ${contractId}`,
      );
    }

    collateral.status = CollateralStatus.LIQUIDATED;
    collateral.remainingAmount = 0;
    collateral.coveredContracts = 0;
    collateral.releasedAt = new Date();

    return this.collateralRepo.save(collateral);
  }

  async getUserCollateral(userId: number): Promise<OptionCollateral[]> {
    return this.collateralRepo.find({
      where: { userId },
      relations: ['contract', 'collateralAsset'],
      order: { createdAt: 'DESC' },
    });
  }

  async getContractCollateral(
    contractId: number,
  ): Promise<OptionCollateral[]> {
    return this.collateralRepo.find({
      where: { contractId },
      relations: ['collateralAsset'],
    });
  }

  /**
   * Calculate required collateral based on option type and contract details.
   * - Covered calls: underlying asset value (strike * size * quantity)
   * - Cash-secured puts: strike * size * quantity
   */
  calculateRequiredCollateral(
    contract: OptionContract,
    quantity: number,
  ): number {
    const collateralPerUnit =
      Number(contract.strikePrice) * Number(contract.contractSize);
    return this.blackScholes.round8(collateralPerUnit * quantity);
  }

  /**
   * Calculate total collateral locked across all writers for a contract.
   */
  async getTotalCollateralForContract(contractId: number): Promise<number> {
    const collaterals = await this.collateralRepo.find({
      where: { contractId },
    });

    let total = 0;
    for (const c of collaterals) {
      total += Number(c.remainingAmount);
    }
    return this.blackScholes.round8(total);
  }

  /**
   * Check if there is enough total collateral to cover all outstanding contracts.
   */
  async validateCollateralCoverage(contractId: number): Promise<{
    covered: boolean;
    totalCollateral: number;
    requiredCollateral: number;
  }> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
    });
    if (!contract) {
      throw new NotFoundException(`Option contract ${contractId} not found`);
    }

    const totalCollateral = await this.getTotalCollateralForContract(contractId);
    const requiredCollateral = this.blackScholes.round8(
      Number(contract.strikePrice) *
        Number(contract.contractSize) *
        (Number(contract.totalSupply) - Number(contract.openInterest)),
    );

    return {
      covered: totalCollateral >= requiredCollateral,
      totalCollateral,
      requiredCollateral,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarginPosition } from '../entities/margin-position.entity';
import { MarginInterestAccrual } from '../entities/margin-interest-accrual.entity';
import { MarginPairConfig } from '../entities/margin-pair-config.entity';
import { PositionStatus } from '../enums/position-status.enum';
import { MarginCalculatorService } from './margin-calculator.service';

@Injectable()
export class MarginInterestService {
  private readonly logger = new Logger(MarginInterestService.name);

  constructor(
    @InjectRepository(MarginPosition)
    private readonly positionRepo: Repository<MarginPosition>,
    @InjectRepository(MarginInterestAccrual)
    private readonly accrualRepo: Repository<MarginInterestAccrual>,
    @InjectRepository(MarginPairConfig)
    private readonly pairConfigRepo: Repository<MarginPairConfig>,
    private readonly calculator: MarginCalculatorService,
  ) {}

  /** Runs daily at midnight UTC to charge interest on borrowed funds. */
  @Cron('0 0 * * *')
  async accrueDailyInterest(): Promise<void> {
    const positions = await this.positionRepo.find({
      where: [
        { status: PositionStatus.OPEN },
        { status: PositionStatus.MARGIN_CALL },
      ],
    });

    const today = new Date().toISOString().slice(0, 10);

    for (const position of positions) {
      const borrowed = Number(position.borrowedAmount);
      if (borrowed <= 0) continue;

      const pairConfig = await this.pairConfigRepo.findOne({
        where: { id: position.pairConfigId },
      });
      if (!pairConfig) continue;

      const alreadyAccrued = await this.accrualRepo.findOne({
        where: { positionId: position.id, accrualDate: today },
      });
      if (alreadyAccrued) continue;

      try {
        await this.accrueForPosition(position, pairConfig, today);
      } catch (err) {
        this.logger.error(
          `Interest accrual failed for position ${position.id}: ${err}`,
        );
      }
    }
  }

  async accrueForPosition(
    position: MarginPosition,
    pairConfig: MarginPairConfig,
    accrualDate: string,
  ): Promise<MarginInterestAccrual> {
    const borrowed = Number(position.borrowedAmount);
    const bps = pairConfig.dailyInterestRateBps;
    const interest = this.calculator.calculateDailyInterest(borrowed, bps);

    position.accruedInterest = Number(position.accruedInterest) + interest;
    position.lastInterestAccrualAt = new Date();
    await this.positionRepo.save(position);

    const record = this.accrualRepo.create({
      positionId: position.id,
      userId: position.userId,
      borrowedAmount: borrowed,
      interestAmount: interest,
      dailyInterestRateBps: bps,
      accruedTotalAfter: Number(position.accruedInterest),
      accrualDate,
    });

    const saved = await this.accrualRepo.save(record);
    this.logger.log(
      `Accrued ${interest.toFixed(8)} interest on position ${position.id} (total=${position.accruedInterest})`,
    );
    return saved;
  }

  async getAccrualHistory(
    positionId: string,
  ): Promise<MarginInterestAccrual[]> {
    return this.accrualRepo.find({
      where: { positionId },
      order: { accrualDate: 'DESC' },
    });
  }
}

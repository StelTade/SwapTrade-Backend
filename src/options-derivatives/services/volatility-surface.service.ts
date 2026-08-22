import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolatilitySurface } from '../entities/volatility-surface.entity';
import { VirtualAsset } from '../../database/entities/virtual-asset.entity';

export interface VolatilitySurfaceEntry {
  strikePrice: number;
  expirationDate: Date;
  impliedVolatility: number;
  bidIv?: number;
  askIv?: number;
  lastTradedIv?: number;
  sampleCount: number;
}

@Injectable()
export class VolatilitySurfaceService {
  constructor(
    @InjectRepository(VolatilitySurface)
    private readonly surfaceRepo: Repository<VolatilitySurface>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,
  ) {}

  /**
   * Update or insert a volatility surface point.
   */
  async updateVolatility(params: {
    assetId: number;
    strikePrice: number;
    expirationDate: Date;
    impliedVolatility: number;
    bidIv?: number;
    askIv?: number;
    lastTradedIv?: number;
  }): Promise<VolatilitySurface> {
    const asset = await this.assetRepo.findOne({
      where: { id: params.assetId },
    });
    if (!asset) {
      throw new NotFoundException(`Asset ${params.assetId} not found`);
    }

    const existing = await this.surfaceRepo.findOne({
      where: {
        assetId: params.assetId,
        strikePrice: params.strikePrice,
        expirationDate: params.expirationDate,
      },
    });

    if (existing) {
      // Update with exponential moving average
      const alpha = 0.3; // Smoothing factor
      existing.impliedVolatility =
        alpha * params.impliedVolatility +
        (1 - alpha) * existing.impliedVolatility;

      if (params.bidIv !== undefined) {
        existing.bidIv = params.bidIv;
      }
      if (params.askIv !== undefined) {
        existing.askIv = params.askIv;
      }
      if (params.lastTradedIv !== undefined) {
        existing.lastTradedIv = params.lastTradedIv;
      }
      existing.sampleCount += 1;

      return this.surfaceRepo.save(existing);
    }

    const surface = this.surfaceRepo.create({
      assetId: params.assetId,
      strikePrice: params.strikePrice,
      expirationDate: params.expirationDate,
      impliedVolatility: params.impliedVolatility,
      bidIv: params.bidIv,
      askIv: params.askIv,
      lastTradedIv: params.lastTradedIv,
      sampleCount: 1,
    });

    return this.surfaceRepo.save(surface);
  }

  /**
   * Get the full volatility surface for an asset.
   */
  async getVolatilitySurface(
    assetId: number,
  ): Promise<VolatilitySurface[]> {
    const asset = await this.assetRepo.findOne({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }

    return this.surfaceRepo.find({
      where: { assetId },
      order: { expirationDate: 'ASC', strikePrice: 'ASC' },
    });
  }

  /**
   * Get interpolated IV for a specific strike and expiration.
   * Uses nearest-neighbor interpolation if exact match not found.
   */
  async getInterpolatedVolatility(
    assetId: number,
    strikePrice: number,
    expirationDate: Date,
  ): Promise<number> {
    // Try exact match first
    const exact = await this.surfaceRepo.findOne({
      where: { assetId, strikePrice, expirationDate },
    });
    if (exact) {
      return exact.impliedVolatility;
    }

    // Find nearest expiration
    const surface = await this.surfaceRepo.find({
      where: { assetId },
      order: { expirationDate: 'ASC', strikePrice: 'ASC' },
    });

    if (surface.length === 0) {
      throw new NotFoundException(
        `No volatility data found for asset ${assetId}`,
      );
    }

    // Find nearest point by strike and expiration distance
    let nearest = surface[0];
    let minDistance = Infinity;

    for (const point of surface) {
      const strikeDist = Math.abs(Number(point.strikePrice) - strikePrice);
      const timeDist = Math.abs(
        point.expirationDate.getTime() - expirationDate.getTime(),
      );
      const distance = strikeDist + timeDist / (365.25 * 24 * 60 * 60 * 1000);

      if (distance < minDistance) {
        minDistance = distance;
        nearest = point;
      }
    }

    return nearest.impliedVolatility;
  }

  /**
   * Get IV for a specific expiration date (across all strikes).
   */
  async getIvByExpiration(
    assetId: number,
    expirationDate: Date,
  ): Promise<VolatilitySurfaceEntry[]> {
    const entries = await this.surfaceRepo.find({
      where: { assetId, expirationDate },
      order: { strikePrice: 'ASC' },
    });

    return entries.map((e) => ({
      strikePrice: Number(e.strikePrice),
      expirationDate: e.expirationDate,
      impliedVolatility: e.impliedVolatility,
      bidIv: e.bidIv,
      askIv: e.askIv,
      lastTradedIv: e.lastTradedIv,
      sampleCount: e.sampleCount,
    }));
  }

  /**
   * Get the term structure (IV vs time to expiry) at a given strike.
   */
  async getTermStructure(
    assetId: number,
    strikePrice: number,
  ): Promise<Array<{ expirationDate: Date; iv: number }>> {
    const entries = await this.surfaceRepo.find({
      where: { assetId, strikePrice },
      order: { expirationDate: 'ASC' },
    });

    return entries.map((e) => ({
      expirationDate: e.expirationDate,
      iv: e.impliedVolatility,
    }));
  }

  /**
   * Get the skew (IV vs strike) at a given expiration.
   */
  async getSkew(
    assetId: number,
    expirationDate: Date,
  ): Promise<Array<{ strike: number; iv: number }>> {
    const entries = await this.surfaceRepo.find({
      where: { assetId, expirationDate },
      order: { strikePrice: 'ASC' },
    });

    return entries.map((e) => ({
      strike: Number(e.strikePrice),
      iv: e.impliedVolatility,
    }));
  }

  /**
   * Clean up old surface data (older than retention period).
   */
  async cleanupOldData(retentionDays: number = 365): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.surfaceRepo
      .createQueryBuilder()
      .delete()
      .where('expirationDate < :cutoff', { cutoff })
      .execute();

    return result.affected ?? 0;
  }
}

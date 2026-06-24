import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MobileAnalyticsEvent } from '../entities/mobile-analytics-event.entity';
import { TrackEventDto, BatchTrackDto } from '../dto/mobile.dto';

@Injectable()
export class MobileAnalyticsService {
  constructor(
    @InjectRepository(MobileAnalyticsEvent)
    private readonly eventRepo: Repository<MobileAnalyticsEvent>,
  ) {}

  async track(userId: string | undefined, dto: TrackEventDto): Promise<void> {
    const event = this.eventRepo.create({ userId, ...dto });
    await this.eventRepo.save(event);
  }

  async trackBatch(
    userId: string | undefined,
    dto: BatchTrackDto,
  ): Promise<{ tracked: number }> {
    const events = dto.events.map((e) =>
      this.eventRepo.create({ userId, ...e }),
    );
    await this.eventRepo.save(events);
    return { tracked: events.length };
  }

  async getStats(
    from: Date,
    to: Date,
  ): Promise<{
    totalEvents: number;
    byPlatform: Record<string, number>;
    topEvents: Array<{ name: string; count: number }>;
  }> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.createdAt BETWEEN :from AND :to', { from, to });

    const totalEvents = await qb.getCount();

    const byPlatformRaw = await qb
      .select('e.platform', 'platform')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.platform')
      .getRawMany<{ platform: string; count: string }>();

    const byPlatform = Object.fromEntries(
      byPlatformRaw.map((r) => [r.platform ?? 'unknown', Number(r.count)]),
    );

    const topEventsRaw = await qb
      .select('e.eventName', 'name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('e.eventName')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany<{ name: string; count: string }>();

    const topEvents = topEventsRaw.map((r) => ({
      name: r.name,
      count: Number(r.count),
    }));

    return { totalEvents, byPlatform, topEvents };
  }
}

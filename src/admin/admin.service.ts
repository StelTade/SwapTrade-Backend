import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../common/security/audit-log.entity';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { ReferralQueryDto } from './dto/referral-query.dto';

@Injectable()
export class AdminService {
  constructor(
    // @InjectRepository('waitlist_referral_points')
    // private readonly pointsRepo: Repository<any>,
    // @InjectRepository('waitlist_referrals')
    // private readonly referralRepo: Repository<any>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /* TODO: Implement when referral entities are available
  // #201 — referrals list with filters
  async getReferrals(query: ReferralQueryDto) {
    const { status, suspect, page, limit } = query;
    const qb = this.referralRepo.createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status)  qb.andWhere('r.status = :status', { status });
    if (suspect) qb.andWhere('r.fraud_score >= :threshold', { threshold: 40 });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // #201 — manual point adjustment
  async adjustPoints(referralId: string, dto: AdjustPointsDto, adminId: string): Promise<any> {
    const referral = await this.referralRepo.findOne({ where: { id: referralId } });
    if (!referral) throw new NotFoundException('Referral not found');

    await this.pointsRepo.save(
      this.pointsRepo.create({
        user_id: referral.referrer_id,
        points:  dto.delta,
        reason:  dto.reason,
      }),
    );

    await this.auditEntry(adminId, 'adjust_points', 'referral', referralId, dto);
    return { success: true };
  }
  */

  // #201 — shared audit logger
  async auditEntry(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    payload?: object,
  ): Promise<void> {
    await this.auditRepo.save(
      this.auditRepo.create({
        userId: adminId,
        eventType: action as any,
        entityType: targetType,
        entityId: targetId,
        metadata: payload,
      }),
    );
  }

  // #203 — referral stats
  // async getReferralStats(): Promise<any> {
  //   const totalReferrals = await this.referralRepo.count();
  //   const verifiedReferrals = await this.referralRepo.count({ where: { status: 'verified' } });

  //   const topReferrers = await this.referralRepo.createQueryBuilder('r')
  //     .select('r.referrer_id', 'referrerId')
  //     .addSelect('COUNT(r.id)', 'count')
  //     .groupBy('r.referrer_id')
  //     .orderBy('count', 'DESC')
  //     .limit(10)
  //     .getRawMany();

  //   return {
  //     totalReferrals,
  //     verifiedReferrals,
  //     topReferrers,
  //   };
  // }
}

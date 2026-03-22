/**
 * Admin Service - 管理员服务层
 * 实现 Waitlist 和 Referral 的管理功能
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, MoreThan, LessThan } from 'typeorm';
import {
  GetWaitlistQueryDto,
  UpdateWaitlistStatusDto,
  GetReferralsQueryDto,
  AdjustReferralPointsDto,
  PaginatedResponse,
} from './dto/admin.dto';

// 假设这些实体已存在
interface WaitlistEntity {
  id: number;
  email: string;
  status: string;
  invitedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ReferralEntity {
  id: number;
  referrerId: number;
  refereeId: number;
  points: number;
  status: string;
  suspect: boolean;
  createdAt: Date;
}

interface AuditLogEntity {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  adminId: number;
  changes: object;
  reason?: string;
  createdAt: Date;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository('waitlist')
    private waitlistRepository: Repository<WaitlistEntity>,
    @InjectRepository('referral')
    private referralRepository: Repository<ReferralEntity>,
    @InjectRepository('audit_log')
    private auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  // ========== Waitlist 管理 ==========

  /**
   * 获取等待列表（分页、过滤、排序）
   */
  async getWaitlist(
    query: GetWaitlistQueryDto,
  ): Promise<PaginatedResponse<WaitlistEntity>> {
    const { page = 1, limit = 20, status, email, sortBy = 'createdAt', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (email) {
      where.email = Like(`%${email}%`);
    }

    const [data, total] = await this.waitlistRepository.findAndCount({
      where,
      skip: offset,
      take: limit,
      order: { [sortBy]: order === 'asc' ? 'ASC' : 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 更新等待列表状态
   */
  async updateWaitlistStatus(
    id: number,
    dto: UpdateWaitlistStatusDto,
    adminId: number,
  ): Promise<WaitlistEntity> {
    const waitlist = await this.waitlistRepository.findOne({ where: { id } });

    if (!waitlist) {
      throw new NotFoundException(`Waitlist #${id} 不存在`);
    }

    const oldStatus = waitlist.status;
    waitlist.status = dto.status;
    waitlist.updatedAt = new Date();

    if (dto.status === 'invited' && !waitlist.invitedAt) {
      waitlist.invitedAt = new Date();
    }

    await this.waitlistRepository.save(waitlist);

    // 记录审计日志
    await this.logAudit({
      action: 'UPDATE_STATUS',
      entity: 'waitlist',
      entityId: id,
      adminId,
      changes: { from: oldStatus, to: dto.status },
      reason: dto.reason,
    });

    return waitlist;
  }

  /**
   * 手动发送邀请
   */
  async manualInvite(
    id: number,
    adminId: number,
    message?: string,
  ): Promise<WaitlistEntity> {
    const waitlist = await this.waitlistRepository.findOne({ where: { id } });

    if (!waitlist) {
      throw new NotFoundException(`Waitlist #${id} 不存在`);
    }

    waitlist.status = 'invited';
    waitlist.invitedAt = new Date();
    waitlist.updatedAt = new Date();

    await this.waitlistRepository.save(waitlist);

    // TODO: 发送邀请邮件
    // await this.notificationService.sendInviteEmail(waitlist.email, message);

    // 记录审计日志
    await this.logAudit({
      action: 'MANUAL_INVITE',
      entity: 'waitlist',
      entityId: id,
      adminId,
      changes: { message: message || '无' },
      reason: '管理员手动邀请',
    });

    return waitlist;
  }

  // ========== Referral 管理 ==========

  /**
   * 获取推荐列表（分页、过滤、排序）
   */
  async getReferrals(
    query: GetReferralsQueryDto,
  ): Promise<PaginatedResponse<ReferralEntity>> {
    const { page = 1, limit = 20, status, suspect, sortBy = 'points', order = 'desc' } = query;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (suspect !== undefined) {
      where.suspect = suspect;
    }

    const [data, total] = await this.referralRepository.findAndCount({
      where,
      skip: offset,
      take: limit,
      order: { [sortBy]: order === 'asc' ? 'ASC' : 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 手动调整推荐积分
   */
  async adjustReferralPoints(
    id: number,
    dto: AdjustReferralPointsDto,
    adminId: number,
  ): Promise<ReferralEntity> {
    const referral = await this.referralRepository.findOne({ where: { id } });

    if (!referral) {
      throw new NotFoundException(`Referral #${id} 不存在`);
    }

    const oldPoints = referral.points;
    referral.points = Math.max(0, referral.points + dto.pointsAdjustment);

    await this.referralRepository.save(referral);

    // 记录审计日志
    await this.logAudit({
      action: 'ADJUST_POINTS',
      entity: 'referral',
      entityId: id,
      adminId,
      changes: { from: oldPoints, to: referral.points, adjustment: dto.pointsAdjustment },
      reason: dto.reason,
    });

    return referral;
  }

  // ========== 审计日志 ==========

  /**
   * 记录审计日志
   */
  private async logAudit(logData: Partial<AuditLogEntity>): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      ...logData,
      createdAt: new Date(),
    });
    await this.auditLogRepository.save(auditLog);
  }
}

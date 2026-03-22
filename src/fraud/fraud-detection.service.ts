/**
 * Fraud Detection Service - 反欺诈检测服务
 * 实现推荐和等待列表的反欺诈保护措施
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';

export interface FraudCheckResult {
  isFraud: boolean;
  riskScore: number; // 0-100
  reasons: string[];
  action: 'allow' | 'challenge' | 'block' | 'review';
}

export interface FraudConfig {
  ipSignupLimit: number; // 10 分钟内同一 IP 最大注册数
  ipSignupWindow: number; // 时间窗口（分钟）
  referralDomainThreshold: number; // 同一域名推荐阈值
  highRiskScore: number; // 高风险分数阈值
  challengeScore: number; // 需要验证的分数阈值
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  private defaultConfig: FraudConfig = {
    ipSignupLimit: 10,
    ipSignupWindow: 10,
    referralDomainThreshold: 5,
    highRiskScore: 80,
    challengeScore: 50,
  };

  constructor(
    @InjectRepository('waitlist')
    private readonly waitlistRepo: Repository<any>,
    @InjectRepository('referral')
    private readonly referralRepo: Repository<any>,
    @InjectRepository('user')
    private readonly userRepo: Repository<any>,
  ) {}

  /**
   * 检查等待列表注册是否存在欺诈风险
   */
  async checkWaitlistSignup(
    email: string,
    ip: string,
    fingerprint?: string,
  ): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. 检查 IP 注册频率
    const ipSignupCount = await this.checkIPSignupFrequency(ip);
    if (ipSignupCount >= this.defaultConfig.ipSignupLimit) {
      riskScore += 40;
      reasons.push(`IP 注册频率过高：${ipSignupCount} 次/${this.defaultConfig.ipSignupWindow}分钟`);
    }

    // 2. 检查邮箱域名
    const domain = email.split('@')[1];
    const domainCount = await this.checkEmailDomainCount(domain);
    if (domainCount >= this.defaultConfig.referralDomainThreshold) {
      riskScore += 30;
      reasons.push(`邮箱域名集中：${domainCount} 个来自 ${domain}`);
    }

    // 3. 检查临时邮箱
    if (this.isDisposableEmail(domain)) {
      riskScore += 50;
      reasons.push('使用临时邮箱');
    }

    // 4. 检查邮箱格式
    if (!this.isValidEmailFormat(email)) {
      riskScore += 20;
      reasons.push('邮箱格式可疑');
    }

    // 5. 检查指纹重复
    if (fingerprint) {
      const fingerprintCount = await this.checkFingerprintCount(fingerprint);
      if (fingerprintCount > 3) {
        riskScore += 30;
        reasons.push(`设备指纹重复：${fingerprintCount} 次`);
      }
    }

    return this.buildResult(riskScore, reasons);
  }

  /**
   * 检查推荐是否存在欺诈风险
   */
  async checkReferral(
    referrerId: number,
    refereeId: number,
    referrerIP: string,
    refereeIP: string,
  ): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // 1. 检查 IP 地址相同
    if (referrerIP === refereeIP) {
      riskScore += 40;
      reasons.push('推荐人和被推荐人 IP 地址相同');
    }

    // 2. 检查推荐人历史行为
    const referrerStats = await this.getReferrerStats(referrerId);
    if (referrerStats.totalReferrals > 50 && referrerStats.successRate < 0.3) {
      riskScore += 30;
      reasons.push(`推荐人质量低：${referrerStats.totalReferrals} 次推荐，成功率 ${referrerStats.successRate * 100}%`);
    }

    // 3. 检查短时间内大量推荐
    const recentReferrals = await this.getRecentReferrals(referrerId, 60); // 1 小时内
    if (recentReferrals > 10) {
      riskScore += 30;
      reasons.push(`短时间内大量推荐：${recentReferrals} 次/小时`);
    }

    // 4. 检查推荐域名集中度
    const domainConcentration = await this.checkReferrerDomainConcentration(referrerId);
    if (domainConcentration > this.defaultConfig.referralDomainThreshold) {
      riskScore += 20;
      reasons.push(`推荐域名过于集中：${domainConcentration} 个来自同一域名`);
    }

    return this.buildResult(riskScore, reasons);
  }

  /**
   * 检查 IP 注册频率
   */
  private async checkIPSignupFrequency(ip: string): Promise<number> {
    const windowAgo = new Date(Date.now() - this.defaultConfig.ipSignupWindow * 60 * 1000);
    
    // TODO: 实际查询数据库
    // return await this.waitlistRepo.count({
    //   where: {
    //     ip,
    //     createdAt: MoreThan(windowAgo),
    //   },
    // });
    
    return Math.floor(Math.random() * 15); // 模拟数据
  }

  /**
   * 检查邮箱域名数量
   */
  private async checkEmailDomainCount(domain: string): Promise<number> {
    // TODO: 查询数据库
    return Math.floor(Math.random() * 10); // 模拟数据
  }

  /**
   * 检查设备指纹
   */
  private async checkFingerprintCount(fingerprint: string): Promise<number> {
    // TODO: 查询数据库
    return Math.floor(Math.random() * 5); // 模拟数据
  }

  /**
   * 获取推荐人统计
   */
  private async getReferrerStats(referrerId: number) {
    // TODO: 查询数据库
    return {
      totalReferrals: Math.floor(Math.random() * 100),
      successRate: Math.random(),
    };
  }

  /**
   * 获取最近推荐数
   */
  private async getRecentReferrals(referrerId: number, minutes: number): Promise<number> {
    // TODO: 查询数据库
    return Math.floor(Math.random() * 20);
  }

  /**
   * 检查推荐人域名集中度
   */
  private async checkReferrerDomainConcentration(referrerId: number): Promise<number> {
    // TODO: 查询数据库
    return Math.floor(Math.random() * 10);
  }

  /**
   * 判断是否为临时邮箱
   */
  private isDisposableEmail(domain: string): boolean {
    const disposableDomains = [
      'tempmail.com',
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'throwaway.email',
    ];
    return disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * 验证邮箱格式
   */
  private isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 构建检测结果
   */
  private buildResult(riskScore: number, reasons: string[]): FraudCheckResult {
    let action: 'allow' | 'challenge' | 'block' | 'review' = 'allow';

    if (riskScore >= this.defaultConfig.highRiskScore) {
      action = 'block';
    } else if (riskScore >= this.defaultConfig.challengeScore) {
      action = 'review';
    } else if (riskScore >= 30) {
      action = 'challenge';
    }

    return {
      isFraud: riskScore >= this.defaultConfig.highRiskScore,
      riskScore: Math.min(100, riskScore),
      reasons,
      action,
    };
  }

  /**
   * 标记可疑记录供管理员审核
   */
  async markAsSuspicious(
    entityType: 'waitlist' | 'referral',
    entityId: number,
    reason: string,
    riskScore: number,
  ): Promise<void> {
    this.logger.log(`标记可疑记录：${entityType}#${entityId} - ${reason}`);
    
    // TODO: 创建 suspicious_record
    // await this.suspiciousRecordRepo.save({
    //   entityType,
    //   entityId,
    //   reason,
    //   riskScore,
    //   status: 'pending_review',
    // });
  }

  /**
   * 获取可疑记录队列（管理员接口）
   */
  async getSuspiciousQueue(page: number = 1, limit: number = 20) {
    // TODO: 查询数据库
    return {
      data: [],
      total: 0,
      page,
      limit,
    };
  }

  /**
   * 禁用欺诈账户
   */
  async disableFraudAccount(userId: number, adminId: number, reason: string): Promise<void> {
    this.logger.log(`禁用欺诈账户：${userId} - ${reason}`);
    
    // TODO: 更新用户状态
    // await this.userRepo.update(userId, {
    //   status: 'disabled',
    //   disabledAt: new Date(),
    //   disabledReason: reason,
    //   disabledBy: adminId,
    // });
  }
}

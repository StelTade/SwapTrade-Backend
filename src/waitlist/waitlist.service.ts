import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  WaitlistUser,
  WaitlistStatus,
  WaitlistType,
  StakingTier,
} from './entities/waitlist-user.entity';
import { WaitlistVerificationToken } from './entities/waitlist-verification-token.entity';
import { NotificationService, NotificationChannel } from '../notification/notification.service';
import { User } from '../user/entities/user.entity';
import * as crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 72;

/** Minimum vote count needed to launch an asset pair */
const ASSET_PAIR_LAUNCH_THRESHOLD = 50;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistUser)
    private readonly waitlistRepo: Repository<WaitlistUser>,
    @InjectRepository(WaitlistVerificationToken)
    private readonly tokenRepo: Repository<WaitlistVerificationToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  // ---------------------------------------------------------------------------
  // Generic platform waitlist signup (existing flow)
  // ---------------------------------------------------------------------------

  async signup(
    email: string,
    name?: string,
    referralCode?: string,
    referralSource?: string,
    type: WaitlistType = WaitlistType.PLATFORM,
    targetId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.waitlistRepo.findOne({
      where: { email, type, targetId: targetId ?? null },
    });

    if (existing) {
      if (existing.status === WaitlistStatus.VERIFIED) {
        throw new ConflictException('Email already registered and verified');
      } else if (existing.status === WaitlistStatus.INVITED) {
        throw new ConflictException('Email already invited - please check your inbox');
      }
      throw new ConflictException('Email already registered - please verify your email');
    }

    const waitlistUser = this.waitlistRepo.create({
      email,
      name,
      referralCode,
      referralSource,
      type,
      targetId,
      status: WaitlistStatus.PENDING,
    });

    await this.waitlistRepo.save(waitlistUser);

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    const verificationToken = this.tokenRepo.create({
      email,
      token,
      expiresAt,
      isUsed: false,
    });

    await this.tokenRepo.save(verificationToken);

    try {
      await this.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
    }

    return {
      success: true,
      message: 'Signup successful! Please check your email to verify your account.',
    };
  }

  // ---------------------------------------------------------------------------
  // #336 — Waitlist for Premium Features
  // ---------------------------------------------------------------------------

  /**
   * Join the waitlist for a specific premium feature tier.
   * Tiers: 'basic', 'pro', 'enterprise'
   */
  async joinPremiumWaitlist(
    email: string,
    featureName: string,
    tier: 'basic' | 'pro' | 'enterprise' = 'basic',
    name?: string,
  ): Promise<{ success: boolean; message: string; position?: number }> {
    const targetId = `premium:${featureName}:${tier}`;

    const result = await this.signup(email, name, undefined, undefined, WaitlistType.PREMIUM_FEATURE, targetId);

    // Return queue position for early-access UX
    const position = await this.waitlistRepo.count({
      where: { type: WaitlistType.PREMIUM_FEATURE, targetId },
    });

    return { ...result, position };
  }

  /**
   * Admin: unlock premium access for a verified waitlist user.
   * Sets the user's isPremium flag and notifies them.
   */
  async unlockPremiumAccess(waitlistEntryId: string, adminId: string): Promise<{ success: boolean }> {
    const entry = await this.waitlistRepo.findOne({ where: { id: waitlistEntryId } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    if (entry.type !== WaitlistType.PREMIUM_FEATURE) {
      throw new BadRequestException('Entry is not for a premium feature');
    }

    entry.status = WaitlistStatus.INVITED;
    entry.invitedAt = new Date();
    await this.waitlistRepo.save(entry);

    // Flip isPremium on the platform User if they exist
    const platformUser = await this.userRepo.findOne({ where: { email: entry.email } });
    if (platformUser) {
      platformUser.isPremium = true;
      await this.userRepo.save(platformUser);
    }

    try {
      await this.sendPremiumAccessEmail(entry.email, entry.targetId ?? 'Premium Features', entry.name);
    } catch (err) {
      this.logger.error(`Failed to send premium access email to ${entry.email}:`, err);
    }

    this.logger.log(`Premium access unlocked for ${entry.email} by admin ${adminId}`);
    return { success: true };
  }

  /**
   * List all premium waitlist entries, optionally filtered by feature / tier.
   */
  async listPremiumWaitlist(featureName?: string, tier?: string, page = 1, limit = 20) {
    const qb = this.waitlistRepo.createQueryBuilder('w')
      .where('w.type = :type', { type: WaitlistType.PREMIUM_FEATURE })
      .orderBy('w.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (featureName) {
      qb.andWhere("w.targetId LIKE :feature", { feature: `premium:${featureName}%` });
    }
    if (tier) {
      qb.andWhere("w.targetId LIKE :tier", { tier: `%:${tier}` });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ---------------------------------------------------------------------------
  // #333 — Waitlist for New Asset Pairs
  // ---------------------------------------------------------------------------

  /**
   * Join or vote for a new cryptocurrency asset pair.
   * If the vote threshold is met, all waitlisted users receive a launch notification.
   */
  async joinAssetPairWaitlist(
    email: string,
    pairSymbol: string,
    name?: string,
  ): Promise<{ success: boolean; message: string; votes: number; thresholdMet: boolean }> {
    const targetId = `pair:${pairSymbol.toUpperCase()}`;

    // Check if this email already voted for this pair
    const existing = await this.waitlistRepo.findOne({
      where: { email, type: WaitlistType.ASSET_PAIR, targetId },
    });

    if (existing) {
      throw new ConflictException(`You have already joined the waitlist for ${pairSymbol}`);
    }

    const waitlistUser = this.waitlistRepo.create({
      email,
      name,
      type: WaitlistType.ASSET_PAIR,
      targetId,
      status: WaitlistStatus.PENDING,
      votes: 1,
    });
    await this.waitlistRepo.save(waitlistUser);

    // Count total votes for this pair
    const totalVotes = await this.waitlistRepo.count({
      where: { type: WaitlistType.ASSET_PAIR, targetId },
    });

    const thresholdMet = totalVotes >= ASSET_PAIR_LAUNCH_THRESHOLD;

    if (thresholdMet) {
      // Notify all waitlisted users for this pair
      await this.notifyAssetPairLaunch(pairSymbol, targetId);
    }

    return {
      success: true,
      message: thresholdMet
        ? `Threshold reached! ${pairSymbol} will be launched soon. Watch your inbox!`
        : `You're on the waitlist for ${pairSymbol}. Current votes: ${totalVotes}/${ASSET_PAIR_LAUNCH_THRESHOLD}`,
      votes: totalVotes,
      thresholdMet,
    };
  }

  /**
   * Get vote counts for all pending asset pairs, ordered by popularity.
   */
  async getAssetPairVoteCounts(page = 1, limit = 20) {
    const results = await this.dataSource.query(
      `SELECT target_id,
              COUNT(*) as totalVotes,
              MIN(created_at) as firstVote,
              MAX(created_at) as lastVote
       FROM waitlist_users
       WHERE type = ?
       GROUP BY target_id
       ORDER BY totalVotes DESC
       LIMIT ? OFFSET ?`,
      [WaitlistType.ASSET_PAIR, limit, (page - 1) * limit],
    );
    return results.map((r: any) => ({
      pair: r.target_id?.replace('pair:', ''),
      votes: Number(r.totalVotes),
      launchThreshold: ASSET_PAIR_LAUNCH_THRESHOLD,
      thresholdMet: Number(r.totalVotes) >= ASSET_PAIR_LAUNCH_THRESHOLD,
      firstVote: r.firstVote,
      lastVote: r.lastVote,
    }));
  }

  /**
   * Admin: mark a pair as launched and notify subscribers.
   */
  async markAssetPairLaunched(pairSymbol: string, adminId: string): Promise<{ notified: number }> {
    const targetId = `pair:${pairSymbol.toUpperCase()}`;
    const entries = await this.waitlistRepo.find({
      where: { type: WaitlistType.ASSET_PAIR, targetId },
    });

    let notified = 0;
    for (const entry of entries) {
      entry.status = WaitlistStatus.INVITED;
      entry.invitedAt = new Date();
      await this.waitlistRepo.save(entry);
      try {
        await this.sendAssetPairLaunchEmail(entry.email, pairSymbol, entry.name);
        notified++;
      } catch (err) {
        this.logger.error(`Notification failed for ${entry.email}:`, err);
      }
    }

    this.logger.log(`Asset pair ${pairSymbol} marked as launched by admin ${adminId}. Notified: ${notified}`);
    return { notified };
  }

  // ---------------------------------------------------------------------------
  // Existing helpers
  // ---------------------------------------------------------------------------

  async verifyEmail(email: string, token: string): Promise<{ success: boolean; message: string }> {
    const verificationToken = await this.tokenRepo.findOne({
      where: { token, email, isUsed: false },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or already used token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    const waitlistUser = await this.waitlistRepo.findOne({ where: { email } });
    if (!waitlistUser) throw new NotFoundException('Waitlist entry not found');

    waitlistUser.status = WaitlistStatus.VERIFIED;
    waitlistUser.verifiedAt = new Date();
    verificationToken.isUsed = true;
    verificationToken.usedAt = new Date();

    await Promise.all([
      this.waitlistRepo.save(waitlistUser),
      this.tokenRepo.save(verificationToken),
    ]);

    this.logger.log(`Email verified successfully: ${email}`);

    return { success: true, message: 'Email verified successfully! You are now on the waitlist.' };
  }

  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const waitlistUser = await this.waitlistRepo.findOne({ where: { email } });
    if (!waitlistUser) throw new NotFoundException('Waitlist entry not found');

    if (waitlistUser.status === WaitlistStatus.VERIFIED) {
      throw new BadRequestException('Email already verified');
    }
    if (waitlistUser.status === WaitlistStatus.INVITED) {
      throw new BadRequestException('Already invited - please check your inbox');
    }

    await this.tokenRepo.update({ email, isUsed: false }, { isUsed: true, usedAt: new Date() });

    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    await this.tokenRepo.save(this.tokenRepo.create({ email, token, expiresAt, isUsed: false }));

    try {
      await this.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      throw new BadRequestException('Failed to send verification email');
    }

    return { success: true, message: 'Verification email sent!' };
  }

  async findAll(query: any) {
    const { status, type, page = 1, limit = 20 } = query;
    const qb = this.waitlistRepo.createQueryBuilder('w')
      .orderBy('w.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('w.status = :status', { status });
    if (type) qb.andWhere('w.type = :type', { type });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async invite(id: string, adminId: string): Promise<WaitlistUser> {
    const entry = await this.waitlistRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    entry.status = WaitlistStatus.INVITED;
    entry.invitedAt = new Date();
    await this.waitlistRepo.save(entry);

    try {
      await this.sendInviteNotification(entry.email, entry.name);
    } catch (error) {
      this.logger.error(`Failed to send invite notification to ${entry.email}:`, error);
    }

    return entry;
  }

  async getLeaderboard(limit: number = 10): Promise<any[]> {
    return this.dataSource.query(
      `SELECT user_id, display_name, points, rank, updated_at
       FROM leaderboard_cache
       WHERE type = 'REFERRALS'
       ORDER BY rank ASC
       LIMIT ?`,
      [limit],
    );
  }

  async getStats(): Promise<any> {
    const totalSignups = await this.waitlistRepo.count();
    const verifiedUsers = await this.waitlistRepo.count({ where: { status: WaitlistStatus.VERIFIED } });
    const invitedUsers = await this.waitlistRepo.count({ where: { status: WaitlistStatus.INVITED } });
    const premiumWaitlist = await this.waitlistRepo.count({ where: { type: WaitlistType.PREMIUM_FEATURE } });
    const assetPairWaitlist = await this.waitlistRepo.count({ where: { type: WaitlistType.ASSET_PAIR } });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySignups = await this.dataSource.query(
      `SELECT date(created_at) as date, count(*) as count
       FROM waitlist_users
       WHERE created_at >= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      [sevenDaysAgo.toISOString()],
    );

    return { totalSignups, verifiedUsers, invitedUsers, premiumWaitlist, assetPairWaitlist, dailySignups };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/waitlist/verify?token=${token}&email=${encodeURIComponent(email)}`;

    await this.notificationService.send({
      userId: 1,
      type: 'WAITLIST_VERIFICATION',
      channels: [NotificationChannel.Email],
      subject: 'Verify Your Email - SwapTrade Waitlist',
      message: `Welcome to SwapTrade!\n\nPlease verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in ${TOKEN_EXPIRY_HOURS} hours.\n\nIf you didn't sign up for SwapTrade, please ignore this email.\n\nBest regards,\nThe SwapTrade Team`,
    });
  }

  private async sendInviteNotification(email: string, name?: string): Promise<void> {
    const greeting = name ? `Hi ${name}` : 'Hi there';
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;

    await this.notificationService.send({
      userId: 1,
      type: 'WAITLIST_INVITE',
      channels: [NotificationChannel.Email],
      subject: "You're invited! SwapTrade is ready for you",
      message: `${greeting},\n\nGreat news — you've been invited to access SwapTrade!\n\nClick the link below to get started:\n\n${loginUrl}\n\nWelcome aboard,\nThe SwapTrade Team`,
    });
  }

  private async sendPremiumAccessEmail(email: string, featureName: string, name?: string): Promise<void> {
    const greeting = name ? `Hi ${name}` : 'Hi there';
    const dashboardUrl = `${process.env.APP_URL || 'http://localhost:3000'}/dashboard/premium`;

    await this.notificationService.send({
      userId: 1,
      type: 'PREMIUM_ACCESS_GRANTED',
      channels: [NotificationChannel.Email],
      subject: '🎉 Your Premium Access is Live - SwapTrade',
      message: `${greeting},\n\nYour early access to "${featureName}" has been activated!\n\nVisit your dashboard to explore your premium tools:\n${dashboardUrl}\n\nThank you for being an early adopter,\nThe SwapTrade Team`,
    });
  }

  private async sendAssetPairLaunchEmail(email: string, pairSymbol: string, name?: string): Promise<void> {
    const greeting = name ? `Hi ${name}` : 'Hi there';
    const tradeUrl = `${process.env.APP_URL || 'http://localhost:3000'}/trade/${pairSymbol}`;

    await this.notificationService.send({
      userId: 1,
      type: 'ASSET_PAIR_LAUNCHED',
      channels: [NotificationChannel.Email],
      subject: `🚀 ${pairSymbol} is now live on SwapTrade!`,
      message: `${greeting},\n\nGreat news — the ${pairSymbol} trading pair you voted for is now live!\n\nStart trading now:\n${tradeUrl}\n\nHappy trading,\nThe SwapTrade Team`,
    });
  }

  private async notifyAssetPairLaunch(pairSymbol: string, targetId: string): Promise<void> {
    const entries = await this.waitlistRepo.find({
      where: { type: WaitlistType.ASSET_PAIR, targetId },
    });
    for (const entry of entries) {
      try {
        await this.sendAssetPairLaunchEmail(entry.email, pairSymbol, entry.name);
      } catch (err) {
        this.logger.error(`Failed to notify ${entry.email} about ${pairSymbol} launch:`, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // #330 — Waitlist for Staking Rewards
  // ---------------------------------------------------------------------------

  /**
   * Join the staking rewards waitlist for a specific tier.
   * Tiers: 'flexible', 'locked', 'liquidity'
   * Priority is determined by join date (FIFO).
   */
  async joinStakingWaitlist(
    email: string,
    stakingTier: StakingTier,
    name?: string,
  ): Promise<{ success: boolean; message: string; position: number }> {
    const targetId = `staking:${stakingTier}`;
    const result = await this.signup(email, name, undefined, undefined, WaitlistType.STAKING, targetId);

    const position = await this.waitlistRepo.count({
      where: { type: WaitlistType.STAKING, targetId },
    });

    return { ...result, position };
  }

  /**
   * Get a user's position in the staking waitlist for a tier.
   */
  async getStakingWaitlistPosition(
    email: string,
    stakingTier: StakingTier,
  ): Promise<{ found: boolean; position?: number; status?: string; tier: StakingTier }> {
    const targetId = `staking:${stakingTier}`;
    const entry = await this.waitlistRepo.findOne({
      where: { email, type: WaitlistType.STAKING, targetId },
    });

    if (!entry) {
      return { found: false, tier: stakingTier };
    }

    const position = await this.waitlistRepo.count({
      where: { type: WaitlistType.STAKING, targetId, status: WaitlistStatus.VERIFIED },
    });

    return { found: true, position, status: entry.status, tier: stakingTier };
  }

  /**
   * Admin: grant staking access to a waitlist entry (sequential, FIFO).
   */
  async processStakingAccess(
    waitlistEntryId: string,
    adminId: string,
  ): Promise<{ success: boolean }> {
    const entry = await this.waitlistRepo.findOne({ where: { id: waitlistEntryId } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');
    if (entry.type !== WaitlistType.STAKING) {
      throw new BadRequestException('Entry is not for staking rewards');
    }

    entry.status = WaitlistStatus.INVITED;
    entry.invitedAt = new Date();
    await this.waitlistRepo.save(entry);

    try {
      await this.sendStakingAccessEmail(entry.email, entry.targetId ?? 'Staking Rewards', entry.name);
    } catch (err) {
      this.logger.error(`Failed to send staking access email to ${entry.email}:`, err);
    }

    this.logger.log(`Staking access granted for ${entry.email} (tier: ${entry.targetId}) by admin ${adminId}`);
    return { success: true };
  }

  /**
   * Admin: get staking waitlist stats grouped by tier.
   */
  async getStakingWaitlistStats(): Promise<{
    total: number;
    byTier: Record<StakingTier, number>;
    byStatus: Record<string, number>;
  }> {
    const entries = await this.waitlistRepo.find({ where: { type: WaitlistType.STAKING } });

    const byTier: Record<StakingTier, number> = {
      [StakingTier.FLEXIBLE]: 0,
      [StakingTier.LOCKED]: 0,
      [StakingTier.LIQUIDITY]: 0,
    };

    const byStatus: Record<string, number> = {};

    for (const entry of entries) {
      const tier = (entry.targetId ?? '').replace('staking:', '') as StakingTier;
      if (tier in byTier) byTier[tier]++;
      byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
    }

    return { total: entries.length, byTier, byStatus };
  }

  private async sendStakingAccessEmail(email: string, targetId: string, name?: string): Promise<void> {
    const tier = targetId.replace('staking:', '');
    const greeting = name ? `Hi ${name}` : 'Hi there';
    const stakingUrl = `${process.env.APP_URL || 'http://localhost:3000'}/staking/${tier}`;

    await this.notificationService.send({
      userId: 1,
      type: 'STAKING_ACCESS_GRANTED',
      channels: [NotificationChannel.Email],
      subject: `Your ${tier} staking access is ready — SwapTrade`,
      message: `${greeting},\n\nYour access to ${tier} staking rewards has been activated!\n\nStart staking now:\n${stakingUrl}\n\nHappy staking,\nThe SwapTrade Team`,
    });
  }
}

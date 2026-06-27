import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { User } from './entities/user.entity';
import { UserBalance } from '../database/entities/user-balance.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { AccountStatus } from '../auth/entities/auth.entity';
import { Auth } from '../auth/entities/auth.entity';
import {
  RoleSeparationViolation,
  assertNoGovernanceKycRoleConflict,
  normalizeRoleValues,
} from '../common/security/role-separation';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/user-status.dto';
import { PortfolioStatsDto } from './dto/portfolio-stats.dto';

// ─── Event Constants ──────────────────────────────────────────────────────────
export const USER_EVENTS = {
  PROFILE_CREATED: 'identity.user.profile.created',
  PROFILE_UPDATED: 'identity.user.profile.updated',
  STATUS_CHANGED: 'identity.user.status.changed',
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserBalance)
    private readonly userBalanceRepository: Repository<UserBalance>,

    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>,

    @Optional()
    @InjectRepository(Auth)
    private readonly authRepository?: Repository<Auth>,

    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  // ─── Profile CRUD ────────────────────────────────────────────────────────────

  async findAll(): Promise<User[]> {
    this.ensureUserRepo();
    return this.userRepository!.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<User> {
    this.ensureUserRepo();
    const user = await this.userRepository!.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    this.ensureUserRepo();
    return this.userRepository!.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    this.ensureUserRepo();

    const existing = await this.userRepository!.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }

    const roles = this.validateRoleAssignment(
      dto.roles ?? [dto.role ?? UserRole.USER],
    );
    const user = this.userRepository!.create({
      ...dto,
      role: roles[0],
      roles,
    });

    const saved = await this.userRepository!.save(user);

    this.eventEmitter?.emit(USER_EVENTS.PROFILE_CREATED, {
      userId: saved.id,
      email: saved.email,
    });

    return saved;
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    this.ensureUserRepo();

    const user = await this.findOne(id);

    // Role update requires separation check
    if (dto.roles || dto.role) {
      const rolesToValidate = dto.roles ?? (dto.role ? [dto.role] : user.roles);
      const validatedRoles = this.validateRoleAssignment(rolesToValidate);
      dto.roles = validatedRoles;
      dto.role = validatedRoles[0];
    }

    Object.assign(user, dto);
    const saved = await this.userRepository!.save(user);

    this.eventEmitter?.emit(USER_EVENTS.PROFILE_UPDATED, {
      userId: saved.id,
      changes: dto,
    });

    return saved;
  }

  // ─── Status Management ───────────────────────────────────────────────────────

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<User> {
    this.ensureUserRepo();

    const user = await this.findOne(id);
    const previousStatus = user.status;

    if (previousStatus === dto.status) {
      throw new BadRequestException(`User is already ${dto.status}`);
    }

    user.status = dto.status;
    const saved = await this.userRepository!.save(user);

    // Sync status with auth credential if available
    if (this.authRepository && user.authId) {
      await this.authRepository.update(
        { id: user.authId },
        { status: dto.status },
      );
    }

    this.eventEmitter?.emit(USER_EVENTS.STATUS_CHANGED, {
      userId: user.id,
      email: user.email,
      previousStatus,
      newStatus: dto.status,
      reason: dto.reason,
    });

    this.logger.log(
      `User ${user.email} status changed: ${previousStatus} → ${dto.status}`,
    );

    return saved;
  }

  async activate(id: string): Promise<User> {
    return this.updateStatus(id, { status: AccountStatus.ACTIVE });
  }

  async suspend(id: string, reason?: string): Promise<User> {
    return this.updateStatus(id, { status: AccountStatus.SUSPENDED, reason });
  }

  async deactivate(id: string, reason?: string): Promise<User> {
    return this.updateStatus(id, { status: AccountStatus.INACTIVE, reason });
  }

  // ─── Role Management ────────────────────────────────────────────────────────

  validateRoleAssignment(roles: UserRole | UserRole[]): UserRole[] {
    const normalizedRoles = normalizeRoleValues(roles) as UserRole[];

    if (normalizedRoles.length === 0) {
      throw new BadRequestException('At least one role must be assigned.');
    }

    try {
      assertNoGovernanceKycRoleConflict(normalizedRoles);
    } catch (error) {
      if (error instanceof RoleSeparationViolation) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    return normalizedRoles;
  }

  async assignRoles(
    userId: string,
    roles: UserRole | UserRole[],
  ): Promise<User> {
    this.ensureUserRepo();

    const normalizedRoles = this.validateRoleAssignment(roles);
    const user = await this.findOne(userId);

    user.roles = normalizedRoles;
    user.role = normalizedRoles[0];

    return this.userRepository!.save(user);
  }

  // ─── Portfolio Stats ─────────────────────────────────────────────────────────

  async getPortfolioStats(userId: string | number): Promise<PortfolioStatsDto> {
    const numericId =
      typeof userId === 'string' ? parseInt(userId, 10) : userId;

    const userBalances = await this.userBalanceRepository.find({
      where: { userId: numericId },
      relations: ['asset'],
    });

    if (!userBalances || userBalances.length === 0) {
      throw new NotFoundException(`Portfolio not found for user ${userId}`);
    }

    const totalTrades = userBalances.reduce(
      (sum, balance) => sum + (balance.totalTrades || 0),
      0,
    );
    const cumulativePnL = userBalances.reduce(
      (sum, balance) => sum + Number(balance.cumulativePnL || 0),
      0,
    );
    const totalTradeVolume = userBalances.reduce(
      (sum, balance) => sum + Number(balance.totalTradeVolume || 0),
      0,
    );

    const lastTradeDate = userBalances.reduce(
      (latest: Date | null, balance) => {
        if (
          !latest ||
          (balance.lastTradeDate && balance.lastTradeDate > latest)
        ) {
          return balance.lastTradeDate;
        }
        return latest;
      },
      null as Date | null,
    );

    return {
      userId: numericId,
      totalTrades,
      cumulativePnL,
      totalTradeVolume,
      lastTradeDate,
      currentBalances: userBalances.map((balance) => ({
        asset: balance.asset?.name || String(balance.assetId),
        amount: Number(balance.balance),
        trades: balance.totalTrades,
        pnl: Number(balance.cumulativePnL),
      })),
    };
  }

  async updatePortfolioAfterTrade(
    userId: number,
    assetId: number,
    tradeValue: number,
    pnl: number,
  ): Promise<void> {
    let userBalance = await this.userBalanceRepository.findOne({
      where: { userId, assetId },
      relations: ['asset'],
    });

    if (!userBalance) {
      userBalance = this.userBalanceRepository.create({
        userId,
        assetId,
        balance: 0,
        totalTrades: 0,
        cumulativePnL: 0,
        totalTradeVolume: 0,
      });
    }

    userBalance.totalTrades += 1;
    userBalance.cumulativePnL = Number(userBalance.cumulativePnL) + pnl;
    userBalance.totalTradeVolume =
      Number(userBalance.totalTradeVolume) + Math.abs(tradeValue);
    userBalance.lastTradeDate = new Date();

    await this.userBalanceRepository.save(userBalance);
  }

  async getUserBalance(
    userId: number,
    assetId: number,
  ): Promise<UserBalance | null> {
    return this.userBalanceRepository.findOne({
      where: { userId, assetId },
      relations: ['asset'],
    });
  }

  async updateBalance(
    userId: number,
    assetId: number,
    amount: number,
  ): Promise<void> {
    let userBalance = await this.userBalanceRepository.findOne({
      where: { userId, assetId },
      relations: ['asset'],
    });

    if (!userBalance) {
      userBalance = this.userBalanceRepository.create({
        userId,
        assetId,
        balance: 0,
        totalTrades: 0,
        cumulativePnL: 0,
        totalTradeVolume: 0,
        totalInvested: 0,
        averageBuyPrice: 0,
      });
    }

    userBalance.balance = Number(userBalance.balance) + amount;
    await this.userBalanceRepository.save(userBalance);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private ensureUserRepo() {
    if (!this.userRepository) {
      throw new BadRequestException('User repository is not configured.');
    }
  }
}

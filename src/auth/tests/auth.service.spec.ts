import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from '../auth.service';
import { Auth, AccountStatus } from '../entities/auth.entity';
import { Session } from '../entities/session.entity';
import { User } from '../../user/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

const mockAuthRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockSessionRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockUserRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockJwtService = () => ({
  signAsync: jest.fn().mockResolvedValue('mock.jwt.token'),
  verifyAsync: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, defaultVal?: any) => {
    const map: Record<string, any> = {
      BCRYPT_ROUNDS: 10,
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_EXPIRES_IN: 3600,
      JWT_REFRESH_EXPIRES_IN: 604800,
      AUTH_MAX_LOGIN_ATTEMPTS: 5,
      AUTH_LOCKOUT_DURATION: 900000,
    };
    return map[key] ?? defaultVal;
  }),
});

const mockEventEmitter = () => ({
  emit: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let authRepo: ReturnType<typeof mockAuthRepo>;
  let sessionRepo: ReturnType<typeof mockSessionRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let eventEmitter: ReturnType<typeof mockEventEmitter>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Auth), useFactory: mockAuthRepo },
        { provide: getRepositoryToken(Session), useFactory: mockSessionRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: EventEmitter2, useFactory: mockEventEmitter },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepo = module.get(getRepositoryToken(Auth));
    sessionRepo = module.get(getRepositoryToken(Session));
    userRepo = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    eventEmitter = module.get(EventEmitter2);
  });

  // ─── Registration ───────────────────────────────────────────────────────────

  describe('register', () => {
    const dto: RegisterDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password1!',
    };

    it('should register a new user successfully', async () => {
      authRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      const savedAuth = { id: 'auth-uuid', email: dto.email };
      const savedUser = { id: 'user-uuid', email: dto.email };

      authRepo.create.mockReturnValue(savedAuth);
      authRepo.save.mockResolvedValue(savedAuth);
      userRepo.create.mockReturnValue(savedUser);
      userRepo.save.mockResolvedValue(savedUser);

      const result = await service.register(dto);

      expect(result.message).toContain('Registration successful');
      expect(result.userId).toBe('user-uuid');
      expect(authRepo.save).toHaveBeenCalled();
      expect(userRepo.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should throw ConflictException when email already exists in auth', async () => {
      authRepo.findOne.mockResolvedValue({ id: 'existing', email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── Account Activation ─────────────────────────────────────────────────────

  describe('activateAccount', () => {
    it('should activate an account with a valid token', async () => {
      const auth = {
        id: 'auth-id',
        email: 'test@test.com',
        status: AccountStatus.INACTIVE,
        activationToken: 'valid-token',
        activationTokenExpiry: new Date(Date.now() + 3600000),
      };

      authRepo.findOne.mockResolvedValue(auth);
      authRepo.save.mockResolvedValue({ ...auth, status: AccountStatus.ACTIVE });
      userRepo.update.mockResolvedValue({});

      const result = await service.activateAccount('valid-token');
      expect(result.message).toContain('activated');
    });

    it('should throw BadRequestException for invalid token', async () => {
      authRepo.findOne.mockResolvedValue(null);
      await expect(service.activateAccount('bad-token')).rejects.toThrow();
    });

    it('should throw BadRequestException for expired token', async () => {
      authRepo.findOne.mockResolvedValue({
        id: 'auth-id',
        activationToken: 'expired-token',
        activationTokenExpiry: new Date(Date.now() - 1000), // expired
      });
      await expect(service.activateAccount('expired-token')).rejects.toThrow();
    });
  });

  // ─── Login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    const dto: LoginDto = {
      email: 'test@example.com',
      password: 'Password1!',
    };

    const makeAuth = (overrides = {}) => ({
      id: 'auth-id',
      email: dto.email,
      passwordHash: bcrypt.hashSync(dto.password, 10),
      status: AccountStatus.ACTIVE,
      is2FAEnabled: false,
      failedLoginAttempts: 0,
      refreshTokenHashes: [],
      ...overrides,
    });

    const makeQb = (auth: any) => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(auth),
    });

    beforeEach(() => {
      sessionRepo.create.mockReturnValue({ id: 'session-id' });
      sessionRepo.save.mockResolvedValue({ id: 'session-id' });
      authRepo.update.mockResolvedValue({});
      authRepo.save.mockResolvedValue({});

      // For the refresh token hash update query
      const updateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };

      authRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb(makeAuth()))
        .mockReturnValue(updateQb);
    });

    it('should login successfully and return tokens', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-id',
        email: dto.email,
        role: UserRole.USER,
        roles: [UserRole.USER],
      });

      const result = await service.login(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const badPasswordQb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(
          makeAuth({ passwordHash: bcrypt.hashSync('WrongPassword1!', 10) }),
        ),
      };
      authRepo.createQueryBuilder.mockReturnValueOnce(badPasswordQb);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const nullQb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      authRepo.createQueryBuilder.mockReturnValueOnce(nullQb);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive account', async () => {
      const inactiveQb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeAuth({ status: AccountStatus.INACTIVE })),
      };
      authRepo.createQueryBuilder.mockReturnValueOnce(inactiveQb);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException for suspended account', async () => {
      const suspendedQb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeAuth({ status: AccountStatus.SUSPENDED })),
      };
      authRepo.createQueryBuilder.mockReturnValueOnce(suspendedQb);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });

    it('should require 2FA code if 2FA is enabled', async () => {
      const mfaQb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(makeAuth({ is2FAEnabled: true })),
      };
      authRepo.createQueryBuilder.mockReturnValueOnce(mfaQb);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Password Reset ──────────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should always return 200-style message (no enumeration)', async () => {
      authRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'notexist@example.com' });
      expect(result.message).toContain('If an account');
    });

    it('should generate a reset token if user exists', async () => {
      const auth = { id: 'auth-id', email: 'test@example.com' };
      authRepo.findOne.mockResolvedValue(auth);
      authRepo.save.mockResolvedValue(auth);

      const result = await service.forgotPassword({ email: auth.email });
      expect(result.resetToken).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      const auth = {
        id: 'auth-id',
        passwordResetToken: 'valid-token',
        passwordResetExpiry: new Date(Date.now() + 3600000),
        refreshTokenHashes: ['old-hash'],
      };
      const qb = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(auth),
      };
      authRepo.createQueryBuilder.mockReturnValue(qb);
      authRepo.save.mockResolvedValue(auth);
      sessionRepo.update.mockResolvedValue({});

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword1!',
      });

      expect(result.message).toContain('reset successfully');
    });
  });

  // ─── Session Management ──────────────────────────────────────────────────────

  describe('listSessions', () => {
    it('should return active sessions', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-1',
          deviceInfo: 'Chrome',
          ipAddress: '127.0.0.1',
          createdAt: new Date(),
          lastActive: new Date(),
          expiresAt: new Date(),
        },
      ]);

      const result = await service.listSessions('auth-id');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
    });
  });

  describe('revokeSession', () => {
    it('should revoke an existing session', async () => {
      const session = { id: 'session-1', authId: 'auth-id', revoked: false };
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue({ ...session, revoked: true });

      const result = await service.revokeSession('auth-id', 'session-1');
      expect(result.message).toContain('revoked');
    });

    it('should throw NotFoundException for missing session', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeSession('auth-id', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('should revoke sessions and emit event', async () => {
      sessionRepo.update.mockResolvedValue({});
      authRepo.findOne.mockResolvedValue({ id: 'auth-id', email: 'test@test.com' });
      userRepo.findOne.mockResolvedValue({ id: 'user-id' });

      const result = await service.logout('auth-id');
      expect(result.message).toContain('Logged out');
      expect(sessionRepo.update).toHaveBeenCalled();
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistService } from './waitlist.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  WaitlistUser,
  WaitlistUserStatus,
} from './entities/waitlist-user.entity';
import { VerificationToken } from './entities/verification-token.entity';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let waitlistUserRepository: any;
  let verificationTokenRepository: any;

  const mockUser: WaitlistUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    referralCode: 'ABC123XY',
    referredBy: null,
    status: WaitlistUserStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockToken: VerificationToken = {
    id: 1,
    token: 'valid_token_12345678901234567890123456789012',
    waitlistUserId: 1,
    waitlistUser: mockUser,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    used: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    waitlistUserRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) =>
        Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000', ...dto }),
      ),
    };

    verificationTokenRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((dto) => Promise.resolve({ id: 1, ...dto })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: getRepositoryToken(WaitlistUser),
          useValue: waitlistUserRepository,
        },
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: verificationTokenRepository,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  describe('signup', () => {
    it('should create a new waitlist user and send verification email', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(null);

      const result = await service.signup({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.message).toContain('Verification email sent');
      expect(waitlistUserRepository.create).toHaveBeenCalled();
      expect(verificationTokenRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists and is verified', async () => {
      waitlistUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: WaitlistUserStatus.VERIFIED,
      });

      await expect(
        service.signup({ email: 'test@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if email already registered but not verified', async () => {
      waitlistUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: WaitlistUserStatus.PENDING,
      });

      await expect(
        service.signup({ email: 'test@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid referral code', async () => {
      waitlistUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.signup({
          email: 'test@example.com',
          referralCode: 'INVALID',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process referral when valid referral code is provided', async () => {
      const referrer = {
        ...mockUser,
        id: 'referrer-id',
        referralCode: 'VALID123',
        status: WaitlistUserStatus.VERIFIED,
      };
      waitlistUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(referrer);

      const result = await service.signup({
        email: 'test@example.com',
        referralCode: 'VALID123',
      });

      expect(result.user.referredBy).toBe('VALID123');
    });

    it('should throw BadRequestException when referrer is not verified', async () => {
      const unverifiedReferrer = {
        ...mockUser,
        id: 'unverified-referrer-id',
        referralCode: 'PENDING123',
        status: WaitlistUserStatus.PENDING,
      };
      waitlistUserRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(unverifiedReferrer);

      await expect(
        service.signup({
          email: 'test@example.com',
          referralCode: 'PENDING123',
        }),
      ).rejects.toThrow('Referrer email is not verified');
    });
  });

  describe('verify', () => {
    it('should verify user email with valid token', async () => {
      verificationTokenRepository.findOne.mockResolvedValue(mockToken);
      waitlistUserRepository.save.mockResolvedValue({
        ...mockUser,
        status: WaitlistUserStatus.VERIFIED,
      });

      const result = await service.verify({
        token: 'valid_token_12345678901234567890123456789012',
      });

      expect(result.user.status).toBe(WaitlistUserStatus.VERIFIED);
      expect(result.message).toContain('Email verified successfully');
      expect(verificationTokenRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid token', async () => {
      verificationTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.verify({ token: 'invalid_token' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      verificationTokenRepository.findOne.mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verify({ token: 'expired_token' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if email already verified', async () => {
      verificationTokenRepository.findOne.mockResolvedValue({
        ...mockToken,
        waitlistUser: { ...mockUser, status: WaitlistUserStatus.VERIFIED },
      });

      await expect(service.verify({ token: 'valid_token' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('should log referral info when user was referred', async () => {
      const referredUser = {
        ...mockUser,
        referredBy: 'REFERER123',
        status: WaitlistUserStatus.PENDING,
      };
      verificationTokenRepository.findOne.mockResolvedValue({
        ...mockToken,
        waitlistUser: referredUser,
      });
      waitlistUserRepository.save.mockResolvedValue({
        ...referredUser,
        status: WaitlistUserStatus.VERIFIED,
      });

      const result = await service.verify({ token: 'valid_token' });

      expect(result.user.status).toBe(WaitlistUserStatus.VERIFIED);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserById(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserByEmail('test@example.com');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('getUserByReferralCode', () => {
    it('should return user by referral code', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUserByReferralCode('ABC123XY');

      expect(result).toEqual(mockUser);
    });

    it('should return null if no user found with referral code', async () => {
      waitlistUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserByReferralCode('NOTFOUND');

      expect(result).toBeNull();
    });
  });
});

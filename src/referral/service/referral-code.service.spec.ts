import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReferralCodeService } from './referral-code.service';
import { UserReferralCode } from '../entities/user-referral-code.entity';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

describe('ReferralCodeService', () => {
  let service: ReferralCodeService;
  let repository: Repository<UserReferralCode>;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralCodeService,
        {
          provide: getRepositoryToken(UserReferralCode),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ReferralCodeService>(ReferralCodeService);
    repository = module.get<Repository<UserReferralCode>>(
      getRepositoryToken(UserReferralCode),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateCode', () => {
    const userId = 1;

    it('should return existing code if user already has one', async () => {
      const existingCode: Partial<UserReferralCode> = {
        id: 1,
        userId,
        code: 'ABCD1234',
        qrCodeDataUrl: 'data:text/plain;base64,UkVGOjFBQkREMTAyNA==',
        isActive: true,
        createdAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(existingCode);
      mockRepository.save.mockResolvedValue(existingCode);

      const result = await service.generateCode(userId);

      expect(result.code).toBe('ABCD1234');
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should generate a new code if user does not have one', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null) // No existing code
        .mockResolvedValueOnce(null); // No collision during generation
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) =>
        Promise.resolve({ ...data, id: 1, createdAt: new Date() }),
      );

      const result = await service.generateCode(userId);

      expect(result.code).toBeDefined();
      expect(result.code.length).toBeGreaterThanOrEqual(8);
      expect(result.code.length).toBeLessThanOrEqual(12);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException after max attempts', async () => {
      // Always return an existing code for collision check (simulating every generated code already exists)
      // First call checks if user has existing code (returns null)
      // Subsequent calls are collision checks - always find a collision
      mockRepository.findOne
        .mockResolvedValueOnce(null) // No existing code for user
        .mockResolvedValue({ code: 'COLLISION' }); // Always collision for generated codes

      await expect(service.generateCode(userId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getMyCode', () => {
    const userId = 1;

    it('should return user code if exists', async () => {
      const existingCode: Partial<UserReferralCode> = {
        id: 1,
        userId,
        code: 'ABCD1234',
        qrCodeDataUrl: 'data:text/plain;base64,UkVGOjFBQkREMTAyNA==',
        isActive: true,
        createdAt: new Date(),
        lastUsedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(existingCode);

      const result = await service.getMyCode(userId);

      expect(result.code).toBe('ABCD1234');
      expect(result.isActive).toBe(true);
    });

    it('should throw BadRequestException if user has no code', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.getMyCode(userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateReferralCode', () => {
    it('should return code if valid and active', async () => {
      const code = 'ABCD1234';
      const referralCode: Partial<UserReferralCode> = {
        id: 1,
        userId: 1,
        code,
        isActive: true,
        lastUsedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(referralCode);
      mockRepository.save.mockResolvedValue(referralCode);

      const result = await service.validateReferralCode(code);

      expect(result).toBeDefined();
      expect(result?.code).toBe(code);
    });

    it('should return null if code not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateReferralCode('INVALID');

      expect(result).toBeNull();
    });

    it('should return null if code is inactive', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.validateReferralCode('INACTIVE');

      expect(result).toBeNull();
    });
  });

  describe('deactivateCode', () => {
    it('should deactivate existing code', async () => {
      const referralCode: Partial<UserReferralCode> = {
        id: 1,
        userId: 1,
        code: 'ABCD1234',
        isActive: true,
      };

      mockRepository.findOne.mockResolvedValue(referralCode);
      mockRepository.save.mockResolvedValue({ ...referralCode, isActive: false });

      await service.deactivateCode(1);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('should do nothing if user has no code', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await service.deactivateCode(1);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});

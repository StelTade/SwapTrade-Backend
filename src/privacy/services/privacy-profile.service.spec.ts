import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyProfileService } from '../services/privacy-profile.service';
import { PrivacyEncryptionService } from '../services/privacy-encryption.service';
import {
  PrivacyProfile,
  AnonymityLevel,
} from '../entities/privacy-profile.entity';

describe('PrivacyProfileService', () => {
  let service: PrivacyProfileService;
  let repository: Repository<PrivacyProfile>;
  let encryptionService: PrivacyEncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyProfileService,
        PrivacyEncryptionService,
        {
          provide: getRepositoryToken(PrivacyProfile),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PrivacyProfileService>(PrivacyProfileService);
    repository = module.get<Repository<PrivacyProfile>>(
      getRepositoryToken(PrivacyProfile),
    );
    encryptionService = module.get<PrivacyEncryptionService>(
      PrivacyEncryptionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProfile', () => {
    it('should create a new privacy profile', async () => {
      const createDto = {
        publicKey: 'mock-public-key',
        anonymityLevel: AnonymityLevel.MEDIUM,
        isAnonymous: false,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'save').mockResolvedValue({
        id: 'profile-id',
        userId: 1,
        pseudonymousId: 'pseudo-id',
        publicKey: createDto.publicKey,
        anonymityLevel: createDto.anonymityLevel,
        isAnonymous: createDto.isAnonymous,
        anonymousOrderCount: 0,
        anonymousTradeVolume: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.createProfile(1, createDto);

      expect(result).toBeDefined();
      expect(result.userId).toBe(1);
      expect(result.publicKey).toBe(createDto.publicKey);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw if user already has profile', async () => {
      const existingProfile = { id: 'existing-id', userId: 1 } as any;
      jest.spyOn(repository, 'findOne').mockResolvedValueOnce(existingProfile);

      await expect(
        service.createProfile(1, { publicKey: 'key', isAnonymous: true }),
      ).rejects.toThrow();
    });
  });

  describe('getProfileByUserId', () => {
    it('should get profile by user ID', async () => {
      const profile = { userId: 1, pseudonymousId: 'pseudo-id' } as any;
      jest.spyOn(repository, 'findOne').mockResolvedValue(profile);

      const result = await service.getProfileByUserId(1);

      expect(result).toEqual(profile);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { userId: 1 } });
    });
  });

  describe('enableAnonymousMode', () => {
    it('should enable anonymous mode', async () => {
      const profile = {
        pseudonymousId: 'pseudo-id',
        isAnonymous: false,
        anonymityLevel: AnonymityLevel.LOW,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(profile);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...profile,
        isAnonymous: true,
        anonymityLevel: AnonymityLevel.HIGH,
      });

      const result = await service.enableAnonymousMode('pseudo-id');

      expect(result.isAnonymous).toBe(true);
      expect(result.anonymityLevel).toBe(AnonymityLevel.HIGH);
    });
  });

  describe('incrementOrderCount', () => {
    it('should increment order count', async () => {
      const profile = {
        pseudonymousId: 'pseudo-id',
        anonymousOrderCount: 5,
        anonymousTradeVolume: 1000,
      } as any;

      jest.spyOn(repository, 'findOne').mockResolvedValue(profile);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...profile,
        anonymousOrderCount: 6,
        anonymousTradeVolume: 1500,
      });

      await service.incrementOrderCount('pseudo-id', 500);

      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('toResponseDto', () => {
    it('should convert profile to response DTO', () => {
      const profile = {
        id: 'profile-id',
        pseudonymousId: 'pseudo-id',
        anonymityLevel: AnonymityLevel.MEDIUM,
        isAnonymous: true,
        anonymousOrderCount: 10,
        anonymousTradeVolume: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const dto = service.toResponseDto(profile);

      expect(dto).toMatchObject({
        id: 'profile-id',
        pseudonymousId: 'pseudo-id',
        anonymityLevel: AnonymityLevel.MEDIUM,
        isAnonymous: true,
      });

      // Ensure sensitive fields are not included
      expect(dto).not.toHaveProperty('publicKey');
    });
  });
});

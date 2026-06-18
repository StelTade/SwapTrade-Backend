import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  PrivacyProfile,
  AnonymityLevel,
} from '../entities/privacy-profile.entity';
import {
  CreatePrivacyProfileDto,
  UpdatePrivacyProfileDto,
  PrivacyProfileResponseDto,
} from '../dto/privacy-profile.dto';
import { PrivacyEncryptionService } from './privacy-encryption.service';

@Injectable()
export class PrivacyProfileService {
  constructor(
    @InjectRepository(PrivacyProfile)
    private readonly privacyProfileRepository: Repository<PrivacyProfile>,
    private readonly encryptionService: PrivacyEncryptionService,
  ) {}

  /**
   * Create a new privacy profile for a user
   * @param userId User ID
   * @param createDto Profile creation DTO
   * @returns Created privacy profile
   */
  async createProfile(
    userId: number,
    createDto: CreatePrivacyProfileDto,
  ): Promise<PrivacyProfile> {
    // Check if user already has a privacy profile
    const existing = await this.privacyProfileRepository.findOne({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('User already has a privacy profile');
    }

    // Generate unique pseudonymous ID for this user
    let pseudonymousId = uuidv4();
    let idExists = true;
    while (idExists) {
      const existing = await this.privacyProfileRepository.findOne({
        where: { pseudonymousId },
      });
      if (!existing) {
        idExists = false;
      } else {
        pseudonymousId = uuidv4();
      }
    }

    const profile = new PrivacyProfile();
    profile.userId = userId;
    profile.pseudonymousId = pseudonymousId;
    profile.publicKey = createDto.publicKey;
    profile.anonymityLevel = createDto.anonymityLevel || AnonymityLevel.MEDIUM;
    profile.isAnonymous = createDto.isAnonymous || false;
    profile.privacySettings = createDto.privacySettings || {
      hideOrderHistory: false,
      hideBalance: false,
      enableZKProofs: true,
      autoDeleteOldOrders: false,
      orderRetentionDays: 90,
    };

    // Encrypt username/pseudonym if provided
    if (createDto.encryptedPseudonym) {
      profile.encryptedPseudonym = createDto.encryptedPseudonym;
    }

    // Store encrypted backup if provided
    if (createDto.encryptedPseudonym) {
      profile.encryptedPrivateKeyBackup = createDto.encryptedPseudonym;
    }

    profile.anonymousOrderCount = 0;
    profile.anonymousTradeVolume = 0;

    return await this.privacyProfileRepository.save(profile);
  }

  /**
   * Get privacy profile for a user
   * @param userId User ID
   * @returns Privacy profile or null
   */
  async getProfileByUserId(userId: number): Promise<PrivacyProfile | null> {
    return await this.privacyProfileRepository.findOne({
      where: { userId },
    });
  }

  /**
   * Get privacy profile by pseudonymous ID
   * @param pseudonymousId Pseudonymous ID
   * @returns Privacy profile
   */
  async getProfileByPseudonymousId(
    pseudonymousId: string,
  ): Promise<PrivacyProfile> {
    const profile = await this.privacyProfileRepository.findOne({
      where: { pseudonymousId },
    });

    if (!profile) {
      throw new NotFoundException(
        `Profile not found for pseudonymous ID: ${pseudonymousId}`,
      );
    }

    return profile;
  }

  /**
   * Update privacy profile settings
   * @param pseudonymousId Pseudonymous ID
   * @param updateDto Update DTO
   * @returns Updated profile
   */
  async updateProfile(
    pseudonymousId: string,
    updateDto: UpdatePrivacyProfileDto,
  ): Promise<PrivacyProfile> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);

    if (updateDto.anonymityLevel) {
      profile.anonymityLevel = updateDto.anonymityLevel;
    }

    if (typeof updateDto.isAnonymous === 'boolean') {
      profile.isAnonymous = updateDto.isAnonymous;
    }

    if (updateDto.privacySettings) {
      profile.privacySettings = {
        ...profile.privacySettings,
        ...updateDto.privacySettings,
      };
    }

    if (updateDto.encryptedPseudonym) {
      profile.encryptedPseudonym = updateDto.encryptedPseudonym;
    }

    return await this.privacyProfileRepository.save(profile);
  }

  /**
   * Enable anonymous mode for a user
   * @param pseudonymousId Pseudonymous ID
   * @returns Updated profile
   */
  async enableAnonymousMode(pseudonymousId: string): Promise<PrivacyProfile> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);
    profile.isAnonymous = true;
    profile.anonymityLevel = AnonymityLevel.HIGH;
    return await this.privacyProfileRepository.save(profile);
  }

  /**
   * Disable anonymous mode for a user
   * @param pseudonymousId Pseudonymous ID
   * @returns Updated profile
   */
  async disableAnonymousMode(pseudonymousId: string): Promise<PrivacyProfile> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);
    profile.isAnonymous = false;
    profile.anonymityLevel = AnonymityLevel.LOW;
    return await this.privacyProfileRepository.save(profile);
  }

  /**
   * Increment anonymous order count
   * @param pseudonymousId Pseudonymous ID
   * @param amount Order quantity
   */
  async incrementOrderCount(
    pseudonymousId: string,
    amount: number = 1,
  ): Promise<void> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);
    profile.anonymousOrderCount++;
    profile.anonymousTradeVolume += amount;
    await this.privacyProfileRepository.save(profile);
  }

  /**
   * Get aggregated trading stats (privacy-preserving)
   * Returns aggregate stats without revealing individual orders
   * @param pseudonymousId Pseudonymous ID
   * @returns Aggregated stats
   */
  async getAggregatedStats(pseudonymousId: string): Promise<{
    totalOrders: number;
    totalVolume: number;
    profileAge: number; // in days
    anonymityLevel: AnonymityLevel;
  }> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);

    const profileAge = Math.floor(
      (Date.now() - profile.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      totalOrders: profile.anonymousOrderCount,
      totalVolume: profile.anonymousTradeVolume,
      profileAge,
      anonymityLevel: profile.anonymityLevel,
    };
  }

  /**
   * Delete privacy profile and associated data
   * @param pseudonymousId Pseudonymous ID
   */
  async deleteProfile(pseudonymousId: string): Promise<void> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);
    await this.privacyProfileRepository.remove(profile);
  }

  /**
   * Convert profile to response DTO (removes sensitive fields)
   * @param profile Privacy profile entity
   * @returns Response DTO
   */
  toResponseDto(profile: PrivacyProfile): PrivacyProfileResponseDto {
    return {
      id: profile.id,
      pseudonymousId: profile.pseudonymousId,
      anonymityLevel: profile.anonymityLevel,
      isAnonymous: profile.isAnonymous,
      anonymousOrderCount: profile.anonymousOrderCount,
      anonymousTradeVolume: profile.anonymousTradeVolume,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  /**
   * Get multiple profiles by IDs
   * @param pseudonymousIds Array of pseudonymous IDs
   * @returns Array of profiles
   */
  async getProfilesByIds(pseudonymousIds: string[]): Promise<PrivacyProfile[]> {
    return await this.privacyProfileRepository
      .createQueryBuilder('profile')
      .where('profile.pseudonymousId IN (:...pseudonymousIds)', {
        pseudonymousIds,
      })
      .getMany();
  }

  /**
   * Count total anonymous users
   * @returns Count of anonymous users
   */
  async countAnonymousUsers(): Promise<number> {
    return await this.privacyProfileRepository.count({
      where: { isAnonymous: true },
    });
  }

  /**
   * Get profiles by anonymity level
   * @param level Anonymity level
   * @returns Array of profiles
   */
  async getProfilesByAnonymityLevel(
    level: AnonymityLevel,
  ): Promise<PrivacyProfile[]> {
    return await this.privacyProfileRepository.find({
      where: { anonymityLevel: level },
    });
  }

  /**
   * Rotate and update public key
   * @param pseudonymousId Pseudonymous ID
   * @param newPublicKey New public key
   * @returns Updated profile
   */
  async rotatePublicKey(
    pseudonymousId: string,
    newPublicKey: string,
  ): Promise<PrivacyProfile> {
    const profile = await this.getProfileByPseudonymousId(pseudonymousId);

    if (!newPublicKey || newPublicKey.length < 10) {
      throw new BadRequestException('Invalid public key format');
    }

    profile.publicKey = newPublicKey;
    return await this.privacyProfileRepository.save(profile);
  }
}

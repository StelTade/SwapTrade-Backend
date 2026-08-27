import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserProfile } from '../entities/user-profile.entity';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {
  UpdatePreferencesDto,
  UserPreferencesResponseDto,
} from '../dto/user-preferences.dto';

/** Default preference values applied on first profile creation. */
const DEFAULT_PREFERENCES: Record<string, unknown> = {
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
  priceAlerts: true,
  tradeConfirmations: true,
  language: 'en',
  theme: 'dark',
};

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(UserProfile)
    private readonly profileRepo: Repository<UserProfile>,
  ) {}

  // ─── Profile CRUD ─────────────────────────────────────────────────────

  /**
   * Get the extended profile for a user. Creates one with defaults if
   * it does not exist yet (lazy initialization).
   */
  async getProfile(userId: string): Promise<UserProfile> {
    let profile = await this.profileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.profileRepo.create({
        userId,
        preferences: { ...DEFAULT_PREFERENCES },
      });
      profile = await this.profileRepo.save(profile);
    }

    return profile;
  }

  /**
   * Partial update of profile fields. Unknown keys in `preferences`
   * are merged; existing keys not present in the payload are preserved.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfile> {
    const profile = await this.getProfile(userId);

    if (dto.displayName !== undefined) {
      profile.displayName = dto.displayName;
    }
    if (dto.bio !== undefined) {
      profile.bio = dto.bio;
    }
    if (dto.contactEmail !== undefined) {
      profile.contactEmail = dto.contactEmail;
    }
    if (dto.preferences !== undefined) {
      // Deep merge preferences
      profile.preferences = {
        ...(profile.preferences ?? {}),
        ...dto.preferences,
      };
    }

    const saved = await this.profileRepo.save(profile);
    this.logger.log(`Profile updated for user ${userId}`);

    return saved;
  }

  // ─── Preferences ──────────────────────────────────────────────────────

  async getPreferences(userId: string): Promise<UserPreferencesResponseDto> {
    const profile = await this.getProfile(userId);
    return profile.preferences as UserPreferencesResponseDto;
  }

  /**
   * Toggle a single notification setting by key.
   */
  async toggleNotification(
    userId: string,
    key: string,
    value: boolean,
  ): Promise<UserPreferencesResponseDto> {
    const profile = await this.getProfile(userId);
    profile.preferences = {
      ...profile.preferences,
      [key]: value,
    };

    await this.profileRepo.save(profile);
    this.logger.log(
      `Preference "${key}" set to ${value} for user ${userId}`,
    );

    return profile.preferences as UserPreferencesResponseDto;
  }

  /**
   * Bulk-update preferences.
   */
  async updatePreferences(
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    const profile = await this.getProfile(userId);

    // Only apply fields that were explicitly sent
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    profile.preferences = {
      ...(profile.preferences ?? {}),
      ...updates,
    };

    await this.profileRepo.save(profile);
    this.logger.log(`Preferences updated for user ${userId}`);

    return profile.preferences as UserPreferencesResponseDto;
  }
}

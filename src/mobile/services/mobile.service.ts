import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { MobileDevice } from '../entities/mobile-device.entity';
import { RegisterDeviceDto, BiometricVerifyDto } from '../dto/mobile.dto';

// In-memory challenge store (use Redis for multi-instance deployments)
const CHALLENGE_TTL_MS = 60_000;
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

@Injectable()
export class MobileService {
  constructor(
    @InjectRepository(MobileDevice)
    private readonly deviceRepo: Repository<MobileDevice>,
  ) {}

  // ─── Device Registration ────────────────────────────────────────────────────

  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<MobileDevice> {
    let device = await this.deviceRepo.findOne({
      where: { fcmToken: dto.fcmToken },
    });
    if (device) {
      // Update the existing token (e.g. re-install or new user taking over token)
      device.userId = userId;
      device.platform = dto.platform;
      device.deviceModel = dto.deviceModel;
      device.osVersion = dto.osVersion;
      device.appVersion = dto.appVersion;
      device.lastSeenAt = new Date();
    } else {
      device = this.deviceRepo.create({
        userId,
        ...dto,
        lastSeenAt: new Date(),
      });
    }
    return this.deviceRepo.save(device);
  }

  async removeDevice(userId: string, fcmToken: string): Promise<void> {
    const device = await this.deviceRepo.findOne({
      where: { userId, fcmToken },
    });
    if (!device) throw new NotFoundException('Device not found');
    await this.deviceRepo.remove(device);
  }

  async listDevices(userId: string): Promise<MobileDevice[]> {
    return this.deviceRepo.find({ where: { userId } });
  }

  async touchDevice(fcmToken: string): Promise<void> {
    await this.deviceRepo.update({ fcmToken }, { lastSeenAt: new Date() });
  }

  // ─── Biometric Auth ─────────────────────────────────────────────────────────

  /**
   * Issues a short-lived random challenge the mobile app must sign
   * with the device's biometric-protected private key.
   */
  issueChallenge(deviceId: string): { challenge: string } {
    const challenge = randomBytes(32).toString('base64url');
    challenges.set(deviceId, {
      challenge,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return { challenge };
  }

  /**
   * Verifies the signed challenge.
   * The mobile app signs the challenge with a key pair whose private key
   * is protected by the device's biometric authenticator.
   * The public key should be registered during first biometric setup
   * (stored on the MobileDevice or a separate biometric-key table).
   *
   * NOTE: This implementation validates the challenge flow and signature
   * format. Full PKI verification requires the stored public key per device,
   * which can be added when the biometric-key enrollment endpoint is built.
   */
  async verifyBiometric(dto: BiometricVerifyDto): Promise<{ valid: boolean }> {
    const stored = challenges.get(dto.deviceId);
    if (!stored || Date.now() > stored.expiresAt) {
      throw new UnauthorizedException('Challenge expired or not found');
    }
    if (stored.challenge !== dto.challenge) {
      throw new UnauthorizedException('Challenge mismatch');
    }

    // Clean up used challenge (single-use)
    challenges.delete(dto.deviceId);

    // Signature format validation — real verification needs the stored public key
    const isValidBase64 = /^[A-Za-z0-9+/\-_]+=*$/.test(dto.signature);
    if (!isValidBase64 || dto.signature.length < 16) {
      throw new UnauthorizedException('Invalid signature format');
    }

    return { valid: true };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppVersion } from '../entities/app-version.entity';
import { DevicePlatform } from '../entities/mobile-device.entity';
import { CreateAppVersionDto } from '../dto/mobile.dto';

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

@Injectable()
export class AppVersionService {
  constructor(
    @InjectRepository(AppVersion)
    private readonly versionRepo: Repository<AppVersion>,
  ) {}

  async check(
    platform: DevicePlatform,
    clientVersion: string,
  ): Promise<{
    upToDate: boolean;
    forceUpdate: boolean;
    latestVersion: string;
    minimumVersion: string;
    updateMessage?: string;
    storeUrl?: string;
  }> {
    const latest = await this.versionRepo.findOne({
      where: { platform, isActive: true },
      order: { createdAt: 'DESC' },
    });

    if (!latest) {
      return {
        upToDate: true,
        forceUpdate: false,
        latestVersion: clientVersion,
        minimumVersion: clientVersion,
      };
    }

    const isBelowMinimum =
      semverCompare(clientVersion, latest.minimumVersion) < 0;
    const isLatest = semverCompare(clientVersion, latest.version) >= 0;

    return {
      upToDate: isLatest,
      forceUpdate: isBelowMinimum || latest.forceUpdate,
      latestVersion: latest.version,
      minimumVersion: latest.minimumVersion,
      updateMessage: latest.updateMessage,
      storeUrl: latest.storeUrl,
    };
  }

  async create(dto: CreateAppVersionDto): Promise<AppVersion> {
    const version = this.versionRepo.create(dto);
    return this.versionRepo.save(version);
  }

  async findAll(): Promise<AppVersion[]> {
    return this.versionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async deactivate(id: string): Promise<void> {
    const version = await this.versionRepo.findOneBy({ id });
    if (!version) throw new NotFoundException('Version not found');
    version.isActive = false;
    await this.versionRepo.save(version);
  }
}

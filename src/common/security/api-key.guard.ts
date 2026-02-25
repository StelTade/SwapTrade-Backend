import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from './api-key.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.header('x-api-key') as string | undefined;
    if (!key) {
      throw new UnauthorizedException('Missing API key');
    }
    const apiKey = await this.apiKeyRepo.findOne({ where: { key, active: true } });
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key expired');
    }
    apiKey.lastUsedAt = new Date();
    await this.apiKeyRepo.save(apiKey);
    request.apiKeyOwnerId = apiKey.ownerId;
    request.isBot = apiKey.isBot;
    request.apiKeyPermissions = apiKey.permissions || [];
    return true;
  }
}


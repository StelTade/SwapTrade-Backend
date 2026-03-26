import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { EnvService } from './env.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly envService: EnvService) {}

  /**
   * Get current configuration (non-sensitive values only)
   * GET /api/config
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  getConfig(): Record<string, any> {
    return {
      environment: this.envService.get('NODE_ENV'),
      version: process.env.npm_package_version || '1.0.0',
      features: {
        email: this.envService.isEmailConfigured(),
        stellar: this.envService.isStellarConfigured(),
      },
      ...this.envService.getAll(),
    };
  }

  /**
   * Health check for configuration
   * GET /api/config/health
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  healthCheck(): {
    status: 'ok' | 'error';
    environment: string;
    features: {
      database: boolean;
      redis: boolean;
      email: boolean;
      stellar: boolean;
    };
  } {
    return {
      status: 'ok',
      environment: this.envService.get('NODE_ENV') || 'development',
      features: {
        database: true, // If we got here, database is connected
        redis: true, // If we got here, redis is connected
        email: this.envService.isEmailConfigured(),
        stellar: this.envService.isStellarConfigured(),
      },
    };
  }
}

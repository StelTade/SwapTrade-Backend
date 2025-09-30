import { Controller, Get, Post } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}
  @Get()
  async getStatus() {
    return { status: 'Database controller is running' };
  }

  @Post('seed')
  async seedDatabase() {
    return await this.databaseService.seed();
  }
}

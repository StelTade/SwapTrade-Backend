import { Controller, Get, Post } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('profile')
  async profileQueries() {
    return this.performanceService.profileCriticalQueries();
  }

  @Get('benchmarks')
  async runBenchmarks() {
    return this.performanceService.runPerformanceBenchmarks();
  }

  @Post('load-test')
  async runLoadTest() {
    return this.performanceService.simulateLoadTest(1000);
  }

  @Get('index-stats')
  async getIndexStats() {
    return this.performanceService.getIndexUsageStats();
  }

  @Get('validate')
  async validatePerformance() {
    return this.performanceService.validatePerformanceTargets();
  }
}

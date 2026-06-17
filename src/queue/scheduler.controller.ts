// src/queue/scheduler.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { SchedulerFailoverService } from './scheduler-failover.service';
import { QueueMonitoringService } from './queue-monitoring.service';

interface TriggerReportDto {
  email: string;
  startDate?: Date;
  endDate?: Date;
  format?: 'pdf' | 'csv' | 'xlsx';
}

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(
    private readonly schedulerService: SchedulerService,
    private readonly schedulerFailover: SchedulerFailoverService,
    private readonly queueMonitoring: QueueMonitoringService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get scheduler status',
    description: 'Returns the status of all scheduled jobs',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduler status retrieved successfully',
  })
  getSchedulerStatus() {
    return {
      success: true,
      data: this.schedulerService.getSchedulerStatus(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get scheduled task metrics',
    description: 'Returns metrics for all scheduled tasks',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled task metrics retrieved successfully',
  })
  getScheduledTaskMetrics() {
    return {
      success: true,
      data: this.queueMonitoring.getAllScheduledTasksSummary(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('trigger/cache-warming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger cache warming',
    description: 'Manually trigger immediate cache warming',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache warming triggered successfully',
  })
  async triggerCacheWarming() {
    this.logger.log('Manual cache warming triggered via API');
    await this.schedulerService.triggerCacheWarming();
    return {
      success: true,
      message: 'Cache warming triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('trigger/portfolio-optimization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger portfolio optimization',
    description: 'Manually trigger portfolio optimization report',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio optimization triggered successfully',
  })
  async triggerPortfolioOptimization() {
    this.logger.log('Manual portfolio optimization triggered via API');
    await this.schedulerService.triggerPortfolioOptimization();
    return {
      success: true,
      message: 'Portfolio optimization triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('trigger/daily-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger daily report',
    description: 'Manually trigger daily report generation',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          example: 'admin@example.com',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Daily report triggered successfully',
  })
  async triggerDailyReport(@Body() body: { email?: string }) {
    this.logger.log('Manual daily report triggered via API');
    await this.schedulerService.triggerDailyReport(body.email);
    return {
      success: true,
      message: 'Daily report triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('trigger/custom-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger custom report',
    description: 'Generate a custom report for a specific date range',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          example: 'admin@example.com',
        },
        startDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-01T00:00:00Z',
        },
        endDate: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-31T23:59:59Z',
        },
        format: {
          type: 'string',
          enum: ['pdf', 'csv', 'xlsx'],
          example: 'pdf',
        },
      },
      required: ['email'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Custom report triggered successfully',
  })
  async triggerCustomReport(
    @Body() body: TriggerReportDto & { startDate?: Date; endDate?: Date },
  ) {
    this.logger.log('Manual custom report triggered via API');

    const startDate =
      body.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = body.endDate || new Date();
    const format = body.format || 'pdf';

    await this.schedulerService.triggerCustomReport(
      startDate,
      endDate,
      body.email,
      format,
    );

    return {
      success: true,
      message: 'Custom report triggered successfully',
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('trigger/weekly-cleanup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger weekly cleanup',
    description: 'Manually trigger weekly cleanup tasks',
  })
  @ApiResponse({
    status: 200,
    description: 'Weekly cleanup triggered successfully',
  })
  async triggerWeeklyCleanup() {
    this.logger.log('Manual weekly cleanup triggered via API');
    await this.schedulerService.triggerWeeklyCleanup();
    return {
      success: true,
      message: 'Weekly cleanup triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('failover/:queueName/summary')
  @ApiOperation({
    summary: 'Get failed jobs summary',
    description: 'Get summary of failed jobs for a specific queue',
  })
  @ApiParam({
    name: 'queueName',
    enum: ['notifications', 'reports'],
    description: 'Queue name',
  })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs summary retrieved successfully',
  })
  async getFailedJobsSummary(@Param('queueName') queueName: string) {
    const summary =
      await this.schedulerFailover.getFailedJobsSummary(queueName);
    return {
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('failover/:queueName/recover')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recover failed jobs',
    description: 'Attempt to recover and retry failed jobs',
  })
  @ApiParam({
    name: 'queueName',
    enum: ['notifications', 'reports'],
    description: 'Queue name',
  })
  @ApiResponse({
    status: 200,
    description: 'Job recovery initiated successfully',
  })
  async recoverFailedJobs(
    @Param('queueName') queueName: string,
    @Body() body?: { limit?: number },
  ) {
    const limit = body?.limit || 50;
    const recoveredCount = await this.schedulerFailover.recoverFailedJobs(
      queueName,
      limit,
    );

    return {
      success: true,
      message: `Recovered ${recoveredCount} jobs`,
      recoveredCount,
      queue: queueName,
      timestamp: new Date().toISOString(),
    };
  }
}

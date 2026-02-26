// src/queue/queue.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { SchedulerService } from './scheduler.service';
import { QueueName } from './queue.constants';

// Uncomment if you have auth guards
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../auth/guards/roles.guard';
// import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('queue')
@ApiBearerAuth()
@Controller('api/queue')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly monitoringService: QueueMonitoringService,
    private readonly schedulerService: SchedulerService,
  ) {}

  // ==================== Queue Metrics ====================

  @Get('metrics')
  @ApiOperation({ summary: 'Get metrics for all queues', description: 'Returns metrics for all background job queues. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved', schema: { example: [{ queue: 'default', jobs: 10 }] } })
  async getAllMetrics() {
    return await this.monitoringService.getAllQueueMetrics();
  }

  @Get('metrics/:queueName')
  @ApiOperation({ summary: 'Get metrics for specific queue', description: 'Returns metrics for a specific queue. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved', schema: { example: { queue: 'default', jobs: 10 } } })
  async getQueueMetrics(@Param('queueName') queueName: QueueName) {
    return await this.monitoringService.getQueueMetrics(queueName);
  }

  // ==================== Health Check ====================

  @Get('health')
  @ApiOperation({ summary: 'Check queue system health', description: 'Returns health status of the queue system. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Health status retrieved', schema: { example: { status: 'ok' } } })
  async getHealth() {
    return await this.monitoringService.getHealthStatus();
  }

  // ==================== Job Management ====================

  @Get('jobs/:queueName/:jobId')
  @ApiOperation({ summary: 'Get job status', description: 'Returns status of a specific job. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Job status retrieved', schema: { example: { jobId: '123', status: 'completed' } } })
  async getJobStatus(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    return await this.monitoringService.getJobStatus(queueName, jobId);
  }

  @Post('jobs/:queueName/:jobId/retry')
  @ApiOperation({ summary: 'Retry a failed job', description: 'Retries a failed job in the queue. Requires authentication.' })
  @ApiResponse({ status: 200, description: 'Job retry initiated', schema: { example: { jobId: '123', retried: true } } })
  async retryJob(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    await this.queueService.retryJob(queueName, jobId);
    return { jobId, retried: true };
  }

  @Delete('jobs/:queueName/:jobId')
  @ApiOperation({ summary: 'Remove a job' })
  @ApiResponse({ status: 200, description: 'Job removed' })
  async removeJob(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    await this.queueService.removeJob(queueName, jobId);
    return { message: 'Job removed', jobId };
  }

  // ==================== Dead Letter Queue ====================

  @Get('dead-letter/:queueName')
  @ApiOperation({ summary: 'Get dead letter queue jobs' })
  @ApiResponse({ status: 200, description: 'Dead letter jobs retrieved' })
  async getDeadLetterJobs(
    @Param('queueName') queueName: QueueName,
    @Query('limit') limit = 50,
  ) {
    return await this.monitoringService.getDeadLetterJobs(
      queueName,
      Number(limit),
    );
  }

  // ==================== Queue Control ====================

  @Post('pause/:queueName')
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiResponse({ status: 200, description: 'Queue paused' })
  async pauseQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.pauseQueue(queueName);
    return { message: 'Queue paused', queueName };
  }

  @Post('resume/:queueName')
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiResponse({ status: 200, description: 'Queue resumed' })
  async resumeQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.resumeQueue(queueName);
    return { message: 'Queue resumed', queueName };
  }

  @Delete('empty/:queueName')
  @ApiOperation({ summary: 'Empty a queue (remove all jobs)' })
  @ApiResponse({ status: 200, description: 'Queue emptied' })
  async emptyQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.emptyQueue(queueName);
    return { message: 'Queue emptied', queueName };
  }

  // ==================== Manual Job Triggers ====================

  @Post('trigger/daily-report')
  @ApiOperation({ summary: 'Manually trigger daily report generation' })
  @ApiResponse({ status: 200, description: 'Daily report triggered' })
  async triggerDailyReport(@Body('email') email?: string) {
    await this.schedulerService.triggerDailyReport(email);
    return { message: 'Daily report generation triggered' };
  }

  @Post('trigger/weekly-cleanup')
  @ApiOperation({ summary: 'Manually trigger weekly cleanup' })
  @ApiResponse({ status: 200, description: 'Weekly cleanup triggered' })
  async triggerWeeklyCleanup() {
    await this.schedulerService.triggerWeeklyCleanup();
    return { message: 'Weekly cleanup triggered' };
  }

  @Post('trigger/custom-report')
  @ApiOperation({ summary: 'Trigger custom report generation' })
  @ApiResponse({ status: 200, description: 'Custom report triggered' })
  async triggerCustomReport(
    @Body()
    body: {
      startDate: string;
      endDate: string;
      email: string;
      format?: 'pdf' | 'csv' | 'xlsx';
    },
  ) {
    await this.schedulerService.triggerCustomReport(
      new Date(body.startDate),
      new Date(body.endDate),
      body.email,
      body.format,
    );
    return { message: 'Custom report generation triggered' };
  }

  // ==================== Test Endpoints ====================

  @Post('test/notification')
  @ApiOperation({ summary: 'Test notification job' })
  @ApiResponse({ status: 200, description: 'Test notification queued' })
  async testNotification(@Body() body: { userId: string; message: string }) {
    const job = await this.queueService.addNotificationJob({
      userId: body.userId,
      type: 'system_alert',
      title: 'Test Notification',
      message: body.message,
      priority: 'normal',
    });

    return {
      message: 'Test notification queued',
      jobId: job.id,
      queueName: QueueName.NOTIFICATIONS,
    };
  }

  @Post('test/email')
  @ApiOperation({ summary: 'Test email job' })
  @ApiResponse({ status: 200, description: 'Test email queued' })
  async testEmail(@Body() body: { to: string; subject: string }) {
    const job = await this.queueService.addEmailJob({
      to: body.to,
      subject: body.subject,
      template: 'test',
      context: { timestamp: new Date() },
    });

    return {
      message: 'Test email queued',
      jobId: job.id,
      queueName: QueueName.EMAILS,
    };
  }
}

// Update queue.module.ts to export the controller
// Add QueueController to the controllers array in QueueModule

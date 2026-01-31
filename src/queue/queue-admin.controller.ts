// src/queue/queue-admin.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { QueueService } from './queue.service';
import { ExponentialBackoffService } from './exponential-backoff.service';
import { DeadLetterQueueService, DLQReason } from './dead-letter-queue.service';
import { QueueAnalyticsService } from './queue-analytics.service';
import { QueueName } from './queue.constants';
import { RetryPolicy, DLQConfig, QueueHealthThresholds } from './queue.config';

/**
 * Admin Dashboard Controller for Queue Management
 * Provides comprehensive monitoring, control, and analytics endpoints
 * Protected by admin role (uncomment guards as needed)
 */
@ApiTags('queue-admin')
@ApiBearerAuth()
@Controller('api/admin/queue')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles('admin')
export class QueueAdminController {
  constructor(
    private readonly queueService: QueueService,
    private readonly backoffService: ExponentialBackoffService,
    private readonly dlqService: DeadLetterQueueService,
    private readonly analyticsService: QueueAnalyticsService,
  ) {}

  // ==================== Dashboard Summary ====================

  /**
   * Get comprehensive dashboard summary with all queue metrics
   */
  @Get('dashboard')
  @ApiOperation({
    summary: 'Get queue dashboard summary',
    description: 'Returns comprehensive summary of all queues for dashboard display',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved',
    schema: {
      example: {
        timestamp: '2024-01-31T10:00:00Z',
        queues: { notifications: { active: 5, waiting: 10 } },
        health: { status: 'healthy' },
      },
    },
  })
  async getDashboardSummary() {
    const summary = await this.queueService.getDashboardSummary();
    const dlqStats = this.dlqService.getDLQStats();

    return {
      timestamp: new Date(),
      queues: summary,
      dlq: dlqStats,
      health: Object.fromEntries(
        Object.values(QueueName).map((queueName) => [
          queueName,
          this.analyticsService.getQueueHealth(queueName),
        ]),
      ),
    };
  }

  // ==================== Queue Metrics & Analytics ====================

  /**
   * Get detailed metrics for all queues
   */
  @Get('metrics/all')
  @ApiOperation({
    summary: 'Get metrics for all queues',
    description: 'Returns detailed metrics for all queues',
  })
  @ApiResponse({ status: 200, description: 'Metrics retrieved' })
  async getAllMetrics() {
    return await this.queueService.getAllQueueMetrics();
  }

  /**
   * Get detailed metrics for a specific queue
   */
  @Get('metrics/:queueName')
  @ApiOperation({
    summary: 'Get metrics for specific queue',
    description: 'Returns detailed metrics for a specific queue',
  })
  async getQueueMetrics(@Param('queueName') queueName: QueueName) {
    return await this.queueService.getQueueMetrics(queueName);
  }

  /**
   * Get metrics history for a queue
   */
  @Get('metrics/:queueName/history')
  @ApiOperation({
    summary: 'Get metrics history',
    description: 'Returns historical metrics for trend analysis',
  })
  async getMetricsHistory(
    @Param('queueName') queueName: QueueName,
    @Query('limit') limit: number = 100,
  ) {
    return this.analyticsService.getMetricsHistory(queueName, limit);
  }

  /**
   * Get analytics report for a time period
   */
  @Post('analytics/report')
  @ApiOperation({
    summary: 'Generate analytics report',
    description: 'Generates comprehensive analytics report for specified period',
  })
  async getAnalyticsReport(
    @Body() body: { startTime: string; endTime: string },
  ) {
    const startTime = new Date(body.startTime);
    const endTime = new Date(body.endTime);

    return this.analyticsService.generateAnalyticsReport(startTime, endTime);
  }

  // ==================== Queue Health & Status ====================

  /**
   * Get health status for all queues
   */
  @Get('health/all')
  @ApiOperation({
    summary: 'Get health status for all queues',
    description: 'Returns health status (healthy/warning/critical) for all queues',
  })
  async getAllQueueHealth() {
    const health: Record<string, any> = {};

    for (const queueName of Object.values(QueueName)) {
      health[queueName] = this.analyticsService.getQueueHealth(queueName);
    }

    return health;
  }

  /**
   * Get health status for a specific queue
   */
  @Get('health/:queueName')
  @ApiOperation({
    summary: 'Get health status for specific queue',
  })
  async getQueueHealth(@Param('queueName') queueName: QueueName) {
    return this.analyticsService.getQueueHealth(queueName);
  }

  /**
   * Get and update health thresholds
   */
  @Get('health-thresholds')
  @ApiOperation({
    summary: 'Get current health thresholds',
  })
  async getHealthThresholds() {
    return this.analyticsService.getHealthThresholds();
  }

  @Put('health-thresholds')
  @ApiOperation({
    summary: 'Update health thresholds',
  })
  async updateHealthThresholds(
    @Body() thresholds: Partial<QueueHealthThresholds>,
  ) {
    this.analyticsService.setHealthThresholds(thresholds);
    return {
      message: 'Health thresholds updated',
      thresholds: this.analyticsService.getHealthThresholds(),
    };
  }

  // ==================== Dead Letter Queue Management ====================

  /**
   * Get DLQ items for a queue
   */
  @Get('dlq/:queueName')
  @ApiOperation({
    summary: 'Get dead letter queue items',
    description: 'Returns items that permanently failed',
  })
  async getDLQItems(
    @Param('queueName') queueName: QueueName,
    @Query('limit') limit: number = 50,
  ) {
    return this.dlqService.getDLQItems(queueName, limit);
  }

  /**
   * Get specific DLQ item
   */
  @Get('dlq/:queueName/:jobId')
  @ApiOperation({
    summary: 'Get specific DLQ item details',
  })
  async getDLQItem(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    return this.dlqService.getDLQItem(queueName, jobId);
  }

  /**
   * Get DLQ statistics and summary
   */
  @Get('dlq-stats')
  @ApiOperation({
    summary: 'Get DLQ statistics',
    description: 'Returns count and details of dead lettered items',
  })
  async getDLQStats() {
    return this.dlqService.getDLQStats();
  }

  /**
   * Get and update DLQ configuration
   */
  @Get('dlq-config')
  @ApiOperation({
    summary: 'Get DLQ configuration',
  })
  async getDLQConfig() {
    return this.dlqService.getDLQConfig();
  }

  @Put('dlq-config')
  @ApiOperation({
    summary: 'Update DLQ configuration',
  })
  async updateDLQConfig(@Body() config: Partial<DLQConfig>) {
    this.dlqService.setDLQConfig(config);
    return {
      message: 'DLQ configuration updated',
      config: this.dlqService.getDLQConfig(),
    };
  }

  /**
   * Attempt to recover a DLQ item
   */
  @Post('dlq/:queueName/:jobId/recover')
  @ApiOperation({
    summary: 'Recover a DLQ job',
    description: 'Attempts to retry a permanently failed job',
  })
  @HttpCode(HttpStatus.OK)
  async recoverDLQJob(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    const success = await this.dlqService.recoverJob(queueName, jobId);

    if (!success) {
      return {
        success: false,
        message: 'Failed to recover job',
        jobId,
      };
    }

    return {
      success: true,
      message: 'Job recovered and re-queued',
      jobId,
      queueName,
    };
  }

  /**
   * Remove a DLQ item permanently
   */
  @Delete('dlq/:queueName/:jobId')
  @ApiOperation({
    summary: 'Remove a DLQ item',
    description: 'Permanently remove a failed job from DLQ',
  })
  async removeDLQItem(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    const removed = this.dlqService.removeDLQItem(queueName, jobId);

    return {
      removed,
      message: removed ? 'DLQ item removed' : 'DLQ item not found',
      jobId,
    };
  }

  /**
   * Clear entire DLQ for a queue
   */
  @Delete('dlq/:queueName')
  @ApiOperation({
    summary: 'Clear entire DLQ',
    description: 'Remove all failed jobs from DLQ for a queue',
  })
  @HttpCode(HttpStatus.OK)
  async clearDLQ(@Param('queueName') queueName: QueueName) {
    const count = this.dlqService.clearDLQ(queueName);

    return {
      message: 'DLQ cleared',
      queueName,
      itemsRemoved: count,
    };
  }

  // ==================== Retry Policy Management ====================

  /**
   * Get all retry policies
   */
  @Get('retry-policies')
  @ApiOperation({
    summary: 'Get all retry policies',
    description: 'Returns all available retry policies and their configurations',
  })
  async getRetryPolicies() {
    return this.backoffService.getAllPolicies();
  }

  /**
   * Get specific retry policy
   */
  @Get('retry-policies/:policy')
  @ApiOperation({
    summary: 'Get retry policy details',
  })
  async getRetryPolicy(@Param('policy') policy: RetryPolicy) {
    return this.backoffService.getPolicy(policy);
  }

  // ==================== Queue Control ====================

  /**
   * Pause a queue (stop processing)
   */
  @Post('control/:queueName/pause')
  @ApiOperation({
    summary: 'Pause queue',
    description: 'Stop processing jobs but keep them in queue',
  })
  @HttpCode(HttpStatus.OK)
  async pauseQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.pauseQueue(queueName);

    return {
      message: `Queue ${queueName} paused`,
      queueName,
      status: 'paused',
    };
  }

  /**
   * Resume a paused queue
   */
  @Post('control/:queueName/resume')
  @ApiOperation({
    summary: 'Resume queue',
    description: 'Resume processing of paused queue',
  })
  @HttpCode(HttpStatus.OK)
  async resumeQueue(@Param('queueName') queueName: QueueName) {
    await this.queueService.resumeQueue(queueName);

    return {
      message: `Queue ${queueName} resumed`,
      queueName,
      status: 'active',
    };
  }

  /**
   * Empty a queue (remove all jobs)
   */
  @Delete('control/:queueName')
  @ApiOperation({
    summary: 'Empty queue',
    description: 'Remove all jobs from queue (cannot be undone)',
  })
  @HttpCode(HttpStatus.OK)
  async emptyQueue(@Param('queueName') queueName: QueueName) {
    const count = await this.queueService.getQueueJobCount(queueName);
    await this.queueService.emptyQueue(queueName);

    return {
      message: `Queue ${queueName} emptied`,
      queueName,
      jobsRemoved: count,
    };
  }

  /**
   * Drain a queue (process all and remove)
   */
  @Post('control/:queueName/drain')
  @ApiOperation({
    summary: 'Drain queue',
    description: 'Process remaining jobs then remove completed ones',
  })
  @HttpCode(HttpStatus.OK)
  async drainQueue(@Param('queueName') queueName: QueueName) {
    // Wait for queue to complete
    await this.queueService.waitUntilEmpty(queueName);

    return {
      message: `Queue ${queueName} drained`,
      queueName,
      status: 'drained',
    };
  }

  // ==================== Job Management ====================

  /**
   * Get job details
   */
  @Get('jobs/:queueName/:jobId')
  @ApiOperation({
    summary: 'Get job details',
  })
  async getJobDetails(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    return await this.queueService.getJobDetails(queueName, jobId);
  }

  /**
   * Retry a failed job
   */
  @Post('jobs/:queueName/:jobId/retry')
  @ApiOperation({
    summary: 'Retry failed job',
  })
  @HttpCode(HttpStatus.OK)
  async retryJob(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    await this.queueService.retryJob(queueName, jobId);

    return {
      message: `Job ${jobId} retry initiated`,
      jobId,
      queueName,
    };
  }

  /**
   * Remove a specific job
   */
  @Delete('jobs/:queueName/:jobId')
  @ApiOperation({
    summary: 'Remove job',
  })
  @HttpCode(HttpStatus.OK)
  async removeJob(
    @Param('queueName') queueName: QueueName,
    @Param('jobId') jobId: string,
  ) {
    await this.queueService.removeJob(queueName, jobId);

    return {
      message: `Job ${jobId} removed`,
      jobId,
      queueName,
    };
  }

  /**
   * Get jobs by status
   */
  @Get('jobs/:queueName/status/:status')
  @ApiOperation({
    summary: 'Get jobs by status',
    description: 'Returns jobs with specific status (active/waiting/failed/completed)',
  })
  async getJobsByStatus(
    @Param('queueName') queueName: QueueName,
    @Param('status') status: string,
    @Query('limit') limit: number = 100,
  ) {
    return await this.queueService.getJobsByStatus(
      queueName,
      status,
      limit,
    );
  }

  // ==================== System Health & Diagnostics ====================

  /**
   * Get overall system health
   */
  @Get('system/health')
  @ApiOperation({
    summary: 'Get system health',
    description: 'Returns overall queue system health',
  })
  async getSystemHealth() {
    const allHealth = {};

    for (const queueName of Object.values(QueueName)) {
      const health = this.analyticsService.getQueueHealth(queueName);
      allHealth[queueName] = health;
    }

    const criticalQueues = Object.entries(allHealth).filter(
      ([, health]: any) => health.status === 'critical',
    );
    const warningQueues = Object.entries(allHealth).filter(
      ([, health]: any) => health.status === 'warning',
    );

    return {
      timestamp: new Date(),
      overallStatus:
        criticalQueues.length > 0 ? 'critical'
          : warningQueues.length > 0 ? 'warning'
          : 'healthy',
      queueHealth: allHealth,
      summary: {
        critical: criticalQueues.length,
        warning: warningQueues.length,
        healthy:
          Object.values(QueueName).length -
          criticalQueues.length -
          warningQueues.length,
      },
    };
  }

  /**
   * Get diagnostics data
   */
  @Get('diagnostics')
  @ApiOperation({
    summary: 'Get queue diagnostics',
    description: 'Returns diagnostic information for troubleshooting',
  })
  async getDiagnostics() {
    const metrics = await this.queueService.getAllQueueMetrics();
    const health = await this.getSystemHealth();
    const dlqStats = this.dlqService.getDLQStats();

    return {
      timestamp: new Date(),
      metrics,
      health,
      dlqStats,
      policies: this.backoffService.getAllPolicies(),
    };
  }
}

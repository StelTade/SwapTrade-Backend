// src/queue/horizontal-scaling.controller.ts
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
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { QueueWorkerManagerService } from './queue-worker-manager.service';
import { QueueLoadBalancerService } from './queue-load-balancer.service';
import { QueueFaultToleranceService } from './queue-fault-tolerance.service';
import { MessageDeduplicationService } from './message-deduplication.service';
import { MessageOrderingService } from './message-ordering.service';
import { DynamicScalingService } from './dynamic-scaling.service';
import { HorizontalScalingMonitoringService } from './horizontal-scaling-monitoring.service';
import { ZeroLossMessageService } from './zero-loss-message.service';
import { LoadTestingService } from './load-testing.service';
import {
  HorizontalScalingConfig,
  LoadBalancingStrategy,
} from './horizontal-scaling.config';
import { FailoverTarget } from './queue-fault-tolerance.service';
import { ScalingDecision, QueueMetrics } from './dynamic-scaling.service';
import { PersistedMessage } from './zero-loss-message.service';

/**
 * Horizontal Scaling Controller
 * Provides REST API for managing horizontal scaling capabilities
 */
@ApiTags('Horizontal Scaling')
@Controller('queue/horizontal-scaling')
export class HorizontalScalingController {
  constructor(
    private workerManager: QueueWorkerManagerService,
    private loadBalancer: QueueLoadBalancerService,
    private faultTolerance: QueueFaultToleranceService,
    private deduplication: MessageDeduplicationService,
    private ordering: MessageOrderingService,
    private dynamicScaling: DynamicScalingService,
    private monitoring: HorizontalScalingMonitoringService,
    private zeroLoss: ZeroLossMessageService,
    private loadTesting: LoadTestingService,
  ) {}

  // ==================== Worker Management ====================

  @Get('workers')
  @ApiOperation({ summary: 'Get all workers' })
  @ApiResponse({ status: 200, description: 'List of all workers' })
  getWorkers() {
    return {
      workers: this.workerManager.getAllWorkers(),
      stats: this.workerManager.getWorkerStats(),
    };
  }

  @Get('workers/:workerId')
  @ApiOperation({ summary: 'Get worker by ID' })
  @ApiResponse({ status: 200, description: 'Worker details' })
  @ApiResponse({ status: 404, description: 'Worker not found' })
  getWorker(@Param('workerId') workerId: string) {
    const worker = this.workerManager.getWorker(workerId);
    if (!worker) {
      return { error: 'Worker not found' };
    }
    return worker;
  }

  @Post('workers/register')
  @ApiOperation({ summary: 'Register a new worker' })
  @ApiResponse({ status: 201, description: 'Worker registered successfully' })
  registerWorker(
    @Body() body: { hostname: string; pid: number; capacity?: number },
  ) {
    const worker = this.workerManager.registerWorker(
      body.hostname,
      body.pid,
      body.capacity || 10,
    );
    return { message: 'Worker registered', worker };
  }

  @Delete('workers/:workerId')
  @ApiOperation({ summary: 'Unregister a worker' })
  @ApiResponse({ status: 200, description: 'Worker unregistered' })
  unregisterWorker(@Param('workerId') workerId: string) {
    const success = this.workerManager.unregisterWorker(workerId);
    return { success };
  }

  @Post('workers/:workerId/heartbeat')
  @ApiOperation({ summary: 'Update worker heartbeat' })
  @ApiResponse({ status: 200, description: 'Heartbeat updated' })
  updateHeartbeat(
    @Param('workerId') workerId: string,
    @Body() body: { metrics?: any },
  ) {
    const success = this.workerManager.updateWorkerHeartbeat(workerId, body.metrics);
    return { success };
  }

  // ==================== Load Balancing ====================

  @Get('load-balancer/stats')
  @ApiOperation({ summary: 'Get load balancer statistics' })
  @ApiResponse({ status: 200, description: 'Load balancer stats' })
  getLoadBalancerStats() {
    return this.loadBalancer.getStats();
  }

  @Put('load-balancer/strategy')
  @ApiOperation({ summary: 'Update load balancing strategy' })
  @ApiResponse({ status: 200, description: 'Strategy updated' })
  updateLoadBalancingStrategy(
    @Body() body: { strategy: LoadBalancingStrategy },
  ) {
    this.loadBalancer.setStrategy(body.strategy);
    return { message: 'Strategy updated', strategy: body.strategy };
  }

  // ==================== Fault Tolerance ====================

  @Get('fault-tolerance/health')
  @ApiOperation({ summary: 'Get fault tolerance health status' })
  @ApiResponse({ status: 200, description: 'Health status' })
  getFaultToleranceHealth() {
    return this.faultTolerance.healthCheck();
  }

  @Get('fault-tolerance/circuit-breakers')
  @ApiOperation({ summary: 'Get all circuit breaker states' })
  @ApiResponse({ status: 200, description: 'Circuit breaker states' })
  getCircuitBreakers() {
    return {
      states: Object.fromEntries(this.faultTolerance.getAllCircuitBreakerStates()),
    };
  }

  @Post('fault-tolerance/circuit-breakers/:serviceId/reset')
  @ApiOperation({ summary: 'Reset a circuit breaker' })
  @ApiResponse({ status: 200, description: 'Circuit breaker reset' })
  resetCircuitBreaker(@Param('serviceId') serviceId: string) {
    this.faultTolerance.resetCircuitBreaker(serviceId);
    return { message: 'Circuit breaker reset', serviceId };
  }

  @Get('fault-tolerance/failover-targets')
  @ApiOperation({ summary: 'Get all failover targets' })
  @ApiResponse({ status: 200, description: 'Failover targets' })
  getFailoverTargets() {
    return {
      targets: Object.fromEntries(this.faultTolerance.getAllFailoverTargets()),
    };
  }

  // ==================== Message Deduplication ====================

  @Get('deduplication/stats')
  @ApiOperation({ summary: 'Get deduplication statistics' })
  @ApiResponse({ status: 200, description: 'Deduplication stats' })
  getDeduplicationStats() {
    return this.deduplication.getStats();
  }

  @Post('deduplication/check')
  @ApiOperation({ summary: 'Check if message is duplicate' })
  @ApiResponse({ status: 200, description: 'Duplicate check result' })
  checkDuplicate(@Body() body: { messageId: string; data: any }) {
    const isDuplicate = this.deduplication.isDuplicate(body.messageId, body.data);
    return { messageId: body.messageId, isDuplicate };
  }

  @Delete('deduplication/clear')
  @ApiOperation({ summary: 'Clear all deduplication data' })
  @ApiResponse({ status: 200, description: 'Data cleared' })
  clearDeduplication() {
    this.deduplication.clearAll();
    return { message: 'Deduplication data cleared' };
  }

  // ==================== Message Ordering ====================

  @Get('ordering/stats')
  @ApiOperation({ summary: 'Get message ordering statistics' })
  @ApiResponse({ status: 200, description: 'Ordering stats' })
  getOrderingStats() {
    return this.ordering.getStats();
  }

  @Get('ordering/partitions/:queueName')
  @ApiOperation({ summary: 'Get partitions for a queue' })
  @ApiResponse({ status: 200, description: 'Queue partitions' })
  getQueuePartitions(@Param('queueName') queueName: string) {
    return {
      partitions: this.ordering.getQueuePartitions(queueName),
      count: this.ordering.getPartitionCount(queueName),
    };
  }

  // ==================== Dynamic Scaling ====================

  @Get('dynamic-scaling/stats')
  @ApiOperation({ summary: 'Get dynamic scaling statistics' })
  @ApiResponse({ status: 200, description: 'Dynamic scaling stats' })
  getDynamicScalingStats() {
    return this.dynamicScaling.getScalingStats();
  }

  @Get('dynamic-scaling/decisions')
  @ApiOperation({ summary: 'Get all scaling decisions' })
  @ApiResponse({ status: 200, description: 'Scaling decisions' })
  getScalingDecisions() {
    return {
      decisions: Object.fromEntries(this.dynamicScaling.getAllScalingDecisions()),
    };
  }

  @Get('dynamic-scaling/history/:queueName')
  @ApiOperation({ summary: 'Get metrics history for a queue' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Metrics history' })
  getMetricsHistory(
    @Param('queueName') queueName: string,
    @Query('limit') limit?: number,
  ) {
    return {
      history: this.dynamicScaling.getMetricsHistory(queueName, limit),
    };
  }

  // ==================== Monitoring ====================

  @Get('monitoring/health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'System health' })
  getSystemHealth() {
    return this.monitoring.getSystemHealth();
  }

  @Get('monitoring/alerts')
  @ApiOperation({ summary: 'Get alerts' })
  @ApiQuery({ name: 'level', required: false, enum: ['info', 'warning', 'critical'] })
  @ApiQuery({ name: 'component', required: false, type: String })
  @ApiQuery({ name: 'acknowledged', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Alerts' })
  getAlerts(
    @Query('level') level?: string,
    @Query('component') component?: string,
    @Query('acknowledged') acknowledged?: boolean,
    @Query('limit') limit?: number,
  ) {
    return {
      alerts: this.monitoring.getAlerts({ level: level as any, component, acknowledged, limit }),
    };
  }

  @Post('monitoring/alerts/:alertId/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiResponse({ status: 200, description: 'Alert acknowledged' })
  acknowledgeAlert(@Param('alertId') alertId: string) {
    const success = this.monitoring.acknowledgeAlert(alertId);
    return { success };
  }

  @Get('monitoring/stats')
  @ApiOperation({ summary: 'Get monitoring statistics' })
  @ApiResponse({ status: 200, description: 'Monitoring stats' })
  getMonitoringStats() {
    return this.monitoring.getMonitoringStats();
  }

  @Get('monitoring/metrics')
  @ApiOperation({ summary: 'Get metrics history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Metrics history' })
  getMetrics(@Query('limit') limit?: number) {
    return {
      metrics: this.monitoring.getMetricsHistory(limit),
    };
  }

  // ==================== Zero-Loss Messages ====================

  @Get('zero-loss/stats')
  @ApiOperation({ summary: 'Get zero-loss message statistics' })
  @ApiResponse({ status: 200, description: 'Zero-loss stats' })
  getZeroLossStats() {
    return this.zeroLoss.getStats();
  }

  @Get('zero-loss/messages/:messageId')
  @ApiOperation({ summary: 'Get message by ID' })
  @ApiResponse({ status: 200, description: 'Message details' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  getMessage(@Param('messageId') messageId: string) {
    const message = this.zeroLoss.getMessage(messageId);
    if (!message) {
      return { error: 'Message not found' };
    }
    return message;
  }

  @Get('zero-loss/messages/queue/:queueName')
  @ApiOperation({ summary: 'Get messages for a queue' })
  @ApiResponse({ status: 200, description: 'Queue messages' })
  getQueueMessages(@Param('queueName') queueName: string) {
    return {
      messages: this.zeroLoss.getQueueMessages(queueName),
    };
  }

  @Post('zero-loss/messages/:messageId/retry')
  @ApiOperation({ summary: 'Retry a failed message' })
  @ApiResponse({ status: 200, description: 'Retry initiated' })
  retryMessage(@Param('messageId') messageId: string) {
    const success = this.zeroLoss.retryMessage(messageId);
    return { success };
  }

  @Get('zero-loss/messages/:messageId/verify')
  @ApiOperation({ summary: 'Verify message integrity' })
  @ApiResponse({ status: 200, description: 'Integrity check result' })
  verifyMessageIntegrity(@Param('messageId') messageId: string) {
    return this.zeroLoss.verifyMessageIntegrity(messageId);
  }

  // ==================== Load Testing ====================

  @Post('load-testing/start')
  @ApiOperation({ summary: 'Start a load test' })
  @ApiResponse({ status: 201, description: 'Test started' })
  async startLoadTest(
    @Body() body: { config?: any; queueName: string },
  ) {
    // Note: In real implementation, you'd inject the actual queue
    // For now, return a placeholder
    return {
      message: 'Load test endpoint ready',
      note: 'Queue injection required for actual testing',
    };
  }

  @Post('load-testing/:testId/stop')
  @ApiOperation({ summary: 'Stop a running load test' })
  @ApiResponse({ status: 200, description: 'Test stopped' })
  stopLoadTest(@Param('testId') testId: string) {
    const success = this.loadTesting.stopTest(testId);
    return { success };
  }

  @Get('load-testing/:testId/status')
  @ApiOperation({ summary: 'Get load test status' })
  @ApiResponse({ status: 200, description: 'Test status' })
  getLoadTestStatus(@Param('testId') testId: string) {
    return this.loadTesting.getTestStatus(testId);
  }

  @Get('load-testing/active')
  @ApiOperation({ summary: 'Get all active load tests' })
  @ApiResponse({ status: 200, description: 'Active tests' })
  getActiveLoadTests() {
    return {
      tests: this.loadTesting.getActiveTests(),
    };
  }

  // ==================== Configuration ====================

  @Get('config')
  @ApiOperation({ summary: 'Get current configuration' })
  @ApiResponse({ status: 200, description: 'Current configuration' })
  getConfig() {
    return {
      workerManager: this.workerManager.getConfig(),
      loadBalancer: this.loadBalancer.getConfig(),
      faultTolerance: this.faultTolerance.getConfig(),
      deduplication: this.deduplication.getConfig(),
      ordering: this.ordering.getConfig(),
      dynamicScaling: this.dynamicScaling.getConfig(),
      monitoring: this.monitoring.getConfig(),
      zeroLoss: this.zeroLoss.getConfig(),
    };
  }

  @Put('config')
  @ApiOperation({ summary: 'Update configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  updateConfig(@Body() body: Partial<HorizontalScalingConfig>) {
    this.workerManager.updateConfig(body);
    this.loadBalancer.updateConfig(body);
    this.faultTolerance.updateConfig(body);
    this.deduplication.updateConfig(body);
    this.ordering.updateConfig(body);
    this.dynamicScaling.updateConfig(body);
    this.monitoring.updateConfig(body);
    this.zeroLoss.updateConfig(body);

    return { message: 'Configuration updated' };
  }

  // ==================== Scaling Operations ====================

  @Post('scale-up/:queueName')
  @ApiOperation({ summary: 'Manually scale up workers' })
  @ApiResponse({ status: 200, description: 'Scaled up' })
  async scaleUp(
    @Param('queueName') queueName: string,
    @Body() body: { count?: number },
  ) {
    const event = await this.workerManager.scaleUp(queueName, body.count);
    return { message: 'Scaled up', event };
  }

  @Post('scale-down/:queueName')
  @ApiOperation({ summary: 'Manually scale down workers' })
  @ApiResponse({ status: 200, description: 'Scaled down' })
  async scaleDown(
    @Param('queueName') queueName: string,
    @Body() body: { count?: number },
  ) {
    const event = await this.workerManager.scaleDown(queueName, body.count);
    return { message: 'Scaled down', event };
  }

  @Get('scaling-history')
  @ApiOperation({ summary: 'Get scaling history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Scaling history' })
  getScalingHistory(@Query('limit') limit?: number) {
    return {
      history: this.workerManager.getScalingHistory(limit),
    };
  }
}
import { Injectable } from '@nestjs/common';
import { HealthCheckResult, HealthCheck, SLODefinition } from '../interfaces/monitoring.interfaces';
import { PrometheusService } from './prometheus.service';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly logger: StructuredLoggerService
  ) {}

  async performHealthChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: Record<string, HealthCheck> = {};

    try {
      // Database health check
      checks.database = await this.checkDatabase();

      // Redis/cache health check
      checks.cache = await this.checkCache();

      // External services health check
      checks.external_services = await this.checkExternalServices();

      // Queue health check
      checks.queues = await this.checkQueues();

      // System resources health check
      checks.system_resources = await this.checkSystemResources();

      // Business logic health check
      checks.business_logic = await this.checkBusinessLogic();

      // Calculate overall status
      const status = this.calculateOverallStatus(checks);
      const duration = Date.now() - startTime;

      // Record health check metrics
      this.prometheusService.recordHealthCheck('overall', status === 'healthy' ? 'pass' : status === 'degraded' ? 'warn' : 'fail', duration);

      const result: HealthCheckResult = {
        status,
        checks,
        timestamp: new Date().toISOString(),
        duration
      };

      // Log health check result
      this.logger.logWithCorrelation(
        status === 'healthy' ? 'info' : 'warn',
        `Health check completed: ${status}`,
        result.timestamp,
        { healthCheck: true, status, duration, checks }
      );

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Health check failed', error, undefined, { healthCheck: true });

      return {
        status: 'unhealthy',
        checks: { error: { status: 'fail', output: error.message } },
        timestamp: new Date().toISOString(),
        duration
      };
    }
  }

  async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // This would check database connectivity
      // For now, we'll simulate a database check
      const isHealthy = await this.simulateDatabaseCheck();
      const duration = Date.now() - startTime;

      if (isHealthy) {
        this.prometheusService.recordHealthCheck('database', 'pass', duration);
        return {
          status: 'pass',
          output: 'Database connection successful',
          observedValue: duration,
          observedUnit: 'ms',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('database', 'fail', duration);
        return {
          status: 'fail',
          output: 'Database connection failed',
          observedValue: duration,
          observedUnit: 'ms',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('database', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: duration,
        observedUnit: 'ms',
        duration
      };
    }
  }

  async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // This would check Redis/cache connectivity
      const isHealthy = await this.simulateCacheCheck();
      const duration = Date.now() - startTime;

      if (isHealthy) {
        this.prometheusService.recordHealthCheck('cache', 'pass', duration);
        return {
          status: 'pass',
          output: 'Cache connection successful',
          observedValue: duration,
          observedUnit: 'ms',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('cache', 'warn', duration);
        return {
          status: 'warn',
          output: 'Cache connection degraded',
          observedValue: duration,
          observedUnit: 'ms',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('cache', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: duration,
        observedUnit: 'ms',
        duration
      };
    }
  }

  async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    const services = ['blockchain', 'notification', 'payment'];
    const results: string[] = [];

    try {
      for (const service of services) {
        const isHealthy = await this.simulateExternalServiceCheck(service);
        if (isHealthy) {
          results.push(`${service}: OK`);
        } else {
          results.push(`${service}: FAILED`);
        }
      }

      const duration = Date.now() - startTime;
      const failedServices = results.filter(r => r.includes('FAILED')).length;

      if (failedServices === 0) {
        this.prometheusService.recordHealthCheck('external_services', 'pass', duration);
        return {
          status: 'pass',
          output: 'All external services healthy',
          observedValue: results.length,
          observedUnit: 'services',
          duration
        };
      } else if (failedServices < services.length) {
        this.prometheusService.recordHealthCheck('external_services', 'warn', duration);
        return {
          status: 'warn',
          output: `${failedServices} services degraded: ${results.join(', ')}`,
          observedValue: failedServices,
          observedUnit: 'services',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('external_services', 'fail', duration);
        return {
          status: 'fail',
          output: 'All external services failed',
          observedValue: failedServices,
          observedUnit: 'services',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('external_services', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: 0,
        observedUnit: 'services',
        duration
      };
    }
  }

  async checkQueues(): Promise<HealthCheck> {
    const startTime = Date.now();
    const queues = ['trading', 'notifications', 'referrals'];
    const queueStatuses: string[] = [];

    try {
      for (const queue of queues) {
        const size = await this.getQueueSize(queue);
        const maxSize = 1000; // Configurable threshold
        
        if (size < maxSize * 0.8) {
          queueStatuses.push(`${queue}: OK (${size})`);
        } else if (size < maxSize) {
          queueStatuses.push(`${queue}: WARNING (${size})`);
        } else {
          queueStatuses.push(`${queue}: CRITICAL (${size})`);
        }
      }

      const duration = Date.now() - startTime;
      const criticalQueues = queueStatuses.filter(s => s.includes('CRITICAL')).length;
      const warningQueues = queueStatuses.filter(s => s.includes('WARNING')).length;

      if (criticalQueues === 0 && warningQueues === 0) {
        this.prometheusService.recordHealthCheck('queues', 'pass', duration);
        return {
          status: 'pass',
          output: 'All queues healthy',
          observedValue: queues.length,
          observedUnit: 'queues',
          duration
        };
      } else if (criticalQueues === 0) {
        this.prometheusService.recordHealthCheck('queues', 'warn', duration);
        return {
          status: 'warn',
          output: `${warningQueues} queues near capacity: ${queueStatuses.join(', ')}`,
          observedValue: warningQueues,
          observedUnit: 'queues',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('queues', 'fail', duration);
        return {
          status: 'fail',
          output: `${criticalQueues} queues at capacity: ${queueStatuses.join(', ')}`,
          observedValue: criticalQueues,
          observedUnit: 'queues',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('queues', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: 0,
        observedUnit: 'queues',
        duration
      };
    }
  }

  async checkSystemResources(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.getSystemMetrics();
      const duration = Date.now() - startTime;

      const issues: string[] = [];

      // CPU usage check
      if (metrics.cpuUsage > 80) {
        issues.push(`CPU usage high: ${metrics.cpuUsage}%`);
      }

      // Memory usage check
      if (metrics.memoryUsage > 85) {
        issues.push(`Memory usage high: ${metrics.memoryUsage}%`);
      }

      // Disk usage check
      if (metrics.diskUsage > 90) {
        issues.push(`Disk usage high: ${metrics.diskUsage}%`);
      }

      if (issues.length === 0) {
        this.prometheusService.recordHealthCheck('system_resources', 'pass', duration);
        return {
          status: 'pass',
          output: 'System resources healthy',
          observedValue: Math.max(metrics.cpuUsage, metrics.memoryUsage, metrics.diskUsage),
          observedUnit: 'percent',
          duration
        };
      } else if (issues.length === 1) {
        this.prometheusService.recordHealthCheck('system_resources', 'warn', duration);
        return {
          status: 'warn',
          output: issues.join(', '),
          observedValue: Math.max(metrics.cpuUsage, metrics.memoryUsage, metrics.diskUsage),
          observedUnit: 'percent',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('system_resources', 'fail', duration);
        return {
          status: 'fail',
          output: issues.join(', '),
          observedValue: Math.max(metrics.cpuUsage, metrics.memoryUsage, metrics.diskUsage),
          observedUnit: 'percent',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('system_resources', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: 0,
        observedUnit: 'percent',
        duration
      };
    }
  }

  async checkBusinessLogic(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const metrics = await this.getBusinessMetrics();
      const duration = Date.now() - startTime;

      const issues: string[] = [];

      // Check if trading is happening
      if (metrics.tradesPerSecond === 0) {
        issues.push('No trading activity detected');
      }

      // Check error rate
      if (metrics.errorRate > 5) {
        issues.push(`High error rate: ${metrics.errorRate}%`);
      }

      // Check latency
      if (metrics.latency.p95 > 1000) {
        issues.push(`High latency: P95 ${metrics.latency.p95}ms`);
      }

      if (issues.length === 0) {
        this.prometheusService.recordHealthCheck('business_logic', 'pass', duration);
        return {
          status: 'pass',
          output: 'Business logic healthy',
          observedValue: metrics.tradesPerSecond,
          observedUnit: 'trades/sec',
          duration
        };
      } else if (issues.length === 1) {
        this.prometheusService.recordHealthCheck('business_logic', 'warn', duration);
        return {
          status: 'warn',
          output: issues.join(', '),
          observedValue: metrics.tradesPerSecond,
          observedUnit: 'trades/sec',
          duration
        };
      } else {
        this.prometheusService.recordHealthCheck('business_logic', 'fail', duration);
        return {
          status: 'fail',
          output: issues.join(', '),
          observedValue: metrics.tradesPerSecond,
          observedUnit: 'trades/sec',
          duration
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHealthCheck('business_logic', 'fail', duration);
      return {
        status: 'fail',
        output: error.message,
        observedValue: 0,
        observedUnit: 'trades/sec',
        duration
      };
    }
  }

  private calculateOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(checks).map(check => check.status);
    const failCount = statuses.filter(status => status === 'fail').length;
    const warnCount = statuses.filter(status => status === 'warn').length;

    if (failCount > 0) {
      return 'unhealthy';
    } else if (warnCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  // Simulation methods (these would be replaced with actual implementations)
  private async simulateDatabaseCheck(): Promise<boolean> {
    // Simulate database connectivity check
    return Math.random() > 0.1; // 90% success rate
  }

  private async simulateCacheCheck(): Promise<boolean> {
    // Simulate cache connectivity check
    return Math.random() > 0.15; // 85% success rate
  }

  private async simulateExternalServiceCheck(service: string): Promise<boolean> {
    // Simulate external service check
    return Math.random() > 0.2; // 80% success rate
  }

  private async getQueueSize(queue: string): Promise<number> {
    // Simulate queue size check
    return Math.floor(Math.random() * 1200);
  }

  private async getSystemMetrics(): Promise<{
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  }> {
    // Simulate system metrics
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100
    };
  }

  private async getBusinessMetrics(): Promise<{
    tradesPerSecond: number;
    errorRate: number;
    latency: { p95: number; p99: number };
  }> {
    // Get business metrics from Prometheus service
    const metrics = this.prometheusService.getBusinessMetrics();
    
    return {
      tradesPerSecond: metrics.tradesPerSecond,
      errorRate: metrics.errorRate,
      latency: {
        p95: metrics.latency.p95,
        p99: metrics.latency.p99
      }
    };
  }

  // SLO monitoring
  async checkSLOs(): Promise<Record<string, { passed: boolean; value: number; target: number }>> {
    const sloResults: Record<string, { passed: boolean; value: number; target: number }> = {};

    // Define SLOs
    const slos: SLODefinition[] = [
      {
        name: 'api_latency',
        description: 'API response time P95',
        objective: 'P95 response time should be under 500ms',
        target: 500,
        window: '5m',
        alerting: {
          burnRateThresholds: [1, 2, 5],
          alertOnBurnRate: true,
          alertOnErrorBudget: true,
          errorBudgetThreshold: 0.1
        }
      },
      {
        name: 'error_rate',
        description: 'Error rate',
        objective: 'Error rate should be under 1%',
        target: 1,
        window: '5m',
        alerting: {
          burnRateThresholds: [1, 2, 5],
          alertOnBurnRate: true,
          alertOnErrorBudget: true,
          errorBudgetThreshold: 0.05
        }
      },
      {
        name: 'availability',
        description: 'Service availability',
        objective: 'Service should be available 99.9% of the time',
        target: 99.9,
        window: '30d',
        alerting: {
          burnRateThresholds: [1, 2, 5],
          alertOnBurnRate: true,
          alertOnErrorBudget: true,
          errorBudgetThreshold: 0.01
        }
      }
    ];

    // Check each SLO
    for (const slo of slos) {
      const currentValue = await this.getSLOValue(slo.name);
      const passed = this.evaluateSLO(slo, currentValue);
      
      sloResults[slo.name] = {
        passed,
        value: currentValue,
        target: slo.target
      };
    }

    return sloResults;
  }

  private async getSLOValue(sloName: string): Promise<number> {
    // This would query metrics to get current SLO values
    switch (sloName) {
      case 'api_latency':
        return Math.random() * 1000; // Simulated latency in ms
      case 'error_rate':
        return Math.random() * 5; // Simulated error rate in %
      case 'availability':
        return 99 + Math.random(); // Simulated availability in %
      default:
        return 0;
    }
  }

  private evaluateSLO(slo: SLODefinition, currentValue: number): boolean {
    switch (slo.name) {
      case 'api_latency':
        return currentValue <= slo.target;
      case 'error_rate':
        return currentValue <= slo.target;
      case 'availability':
        return currentValue >= slo.target;
      default:
        return false;
    }
  }
}

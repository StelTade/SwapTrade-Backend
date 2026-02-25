import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrometheusService } from './prometheus.service';
import { StructuredLoggerService } from './structured-logger.service';
import { OpenTelemetryService } from './opentelemetry.service';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';

@Injectable()
export class SyntheticMonitoringService {
  private readonly logger = new Logger(SyntheticMonitoringService.name);
  private readonly baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly structuredLogger: StructuredLoggerService,
    private readonly telemetryService: OpenTelemetryService,
    private readonly httpService: HttpService
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performHealthChecks() {
    const checks = [
      this.checkApiHealth(),
      this.checkTradingFunctionality(),
      this.checkUserAuthentication(),
      this.checkFeeProgression(),
      this.checkReferralSystem(),
      this.checkRateLimiting()
    ];

    const results = await Promise.allSettled(checks);
    const passed = results.filter(r => r.status === 'fulfilled').length;
    const total = results.length;

    this.prometheusService.setGauge('synthetic_checks_passed', passed);
    this.prometheusService.setGauge('synthetic_checks_total', total);

    this.structuredLogger.logWithCorrelation(
      'info',
      `Synthetic monitoring completed: ${passed}/${total} checks passed`,
      'synthetic-monitoring',
      { passed, total, results }
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async performBusinessFlowTests() {
    await this.testCompleteTradingFlow();
    await this.testUserJourney();
    await this.testAchievementProgression();
  }

  private async checkApiHealth(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpService.get(`${this.baseUrl}/health`).toPromise();
      const duration = Date.now() - startTime;

      this.prometheusService.recordHistogram('synthetic_api_health_check_duration', duration / 1000);
      
      if (response.status === 200) {
        this.prometheusService.incrementCounter('synthetic_api_health_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_api_health_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_api_health_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_api_health_checks_total', { status: 'error' });
      
      this.structuredLogger.error('API health check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async checkTradingFunctionality(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test trading endpoint availability
      const response = await this.httpService.get(`${this.baseUrl}/trading/status`).toPromise();
      const duration = Date.now() - startTime;

      this.prometheusService.recordHistogram('synthetic_trading_check_duration', duration / 1000);
      
      if (response.status === 200) {
        this.prometheusService.incrementCounter('synthetic_trading_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_trading_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_trading_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_trading_checks_total', { status: 'error' });
      
      this.structuredLogger.error('Trading functionality check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async checkUserAuthentication(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test authentication endpoint
      const response = await this.httpService.post(`${this.baseUrl}/auth/test`, {
        test: true
      }).toPromise();
      
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_auth_check_duration', duration / 1000);
      
      if (response.status === 200) {
        this.prometheusService.incrementCounter('synthetic_auth_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_auth_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_auth_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_auth_checks_total', { status: 'error' });
      
      this.structuredLogger.error('Authentication check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async checkFeeProgression(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test fee progression endpoint
      const response = await this.httpService.get(`${this.baseUrl}/fee-progression/status`).toPromise();
      const duration = Date.now() - startTime;

      this.prometheusService.recordHistogram('synthetic_fee_progression_check_duration', duration / 1000);
      
      if (response.status === 200) {
        this.prometheusService.incrementCounter('synthetic_fee_progression_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_fee_progression_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_fee_progression_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_fee_progression_checks_total', { status: 'error' });
      
      this.structuredLogger.error('Fee progression check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async checkReferralSystem(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test referral system endpoint
      const response = await this.httpService.get(`${this.baseUrl}/referral/status`).toPromise();
      const duration = Date.now() - startTime;

      this.prometheusService.recordHistogram('synthetic_referral_check_duration', duration / 1000);
      
      if (response.status === 200) {
        this.prometheusService.incrementCounter('synthetic_referral_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_referral_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_referral_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_referral_checks_total', { status: 'error' });
      
      this.structuredLogger.error('Referral system check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async checkRateLimiting(): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // Test rate limiting by making multiple requests
      const requests = Array(5).fill(null).map(() => 
        this.httpService.get(`${this.baseUrl}/test/rate-limit`).toPromise()
      );
      
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;

      this.prometheusService.recordHistogram('synthetic_rate_limit_check_duration', duration / 1000);
      
      const successCount = responses.filter(r => r.status === 'fulfilled').length;
      
      if (successCount >= 3) { // At least 3 out of 5 should succeed
        this.prometheusService.incrementCounter('synthetic_rate_limit_checks_total', { status: 'success' });
        return true;
      } else {
        this.prometheusService.incrementCounter('synthetic_rate_limit_checks_total', { status: 'failure' });
        return false;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.prometheusService.recordHistogram('synthetic_rate_limit_check_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_rate_limit_checks_total', { status: 'error' });
      
      this.structuredLogger.error('Rate limiting check failed', error, { correlationId: 'synthetic-monitoring' });
      return false;
    }
  }

  private async testCompleteTradingFlow(): Promise<void> {
    const span = this.telemetryService.startSpan('synthetic_trading_flow_test');
    
    try {
      // Simulate complete trading flow
      const startTime = Date.now();
      
      // 1. Check user balance
      await this.httpService.get(`${this.baseUrl}/user/balance/test`).toPromise();
      
      // 2. Get order book
      await this.httpService.get(`${this.baseUrl}/trading/orderbook/XLM`).toPromise();
      
      // 3. Place test order (simulation only)
      await this.httpService.post(`${this.baseUrl}/trading/simulate`, {
        asset: 'XLM',
        amount: 100,
        type: 'buy'
      }).toPromise();
      
      // 4. Check fee calculation
      await this.httpService.get(`${this.baseUrl}/fee-progression/calculate/test`).toPromise();
      
      const duration = Date.now() - startTime;
      
      this.prometheusService.recordHistogram('synthetic_trading_flow_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_trading_flows_total', { status: 'success' });
      
      this.structuredLogger.logPerformance('synthetic_trading_flow', duration, { correlationId: 'synthetic-monitoring' });
      
    } catch (error) {
      this.prometheusService.incrementCounter('synthetic_trading_flows_total', { status: 'failure' });
      this.structuredLogger.error('Synthetic trading flow test failed', error, { correlationId: 'synthetic-monitoring' });
      span.recordException(error);
    } finally {
      span.end();
    }
  }

  private async testUserJourney(): Promise<void> {
    const span = this.telemetryService.startSpan('synthetic_user_journey_test');
    
    try {
      const startTime = Date.now();
      
      // 1. User registration simulation
      await this.httpService.post(`${this.baseUrl}/auth/simulate-register`, {
        email: 'test@synthetic.com',
        username: 'synthetic_user'
      }).toPromise();
      
      // 2. User login simulation
      await this.httpService.post(`${this.baseUrl}/auth/simulate-login`, {
        email: 'test@synthetic.com'
      }).toPromise();
      
      // 3. Check user profile
      await this.httpService.get(`${this.baseUrl}/user/profile/test`).toPromise();
      
      // 4. Check referral status
      await this.httpService.get(`${this.baseUrl}/referral/status/test`).toPromise();
      
      const duration = Date.now() - startTime;
      
      this.prometheusService.recordHistogram('synthetic_user_journey_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_user_journeys_total', { status: 'success' });
      
      this.structuredLogger.logPerformance('synthetic_user_journey', duration, { correlationId: 'synthetic-monitoring' });
      
    } catch (error) {
      this.prometheusService.incrementCounter('synthetic_user_journeys_total', { status: 'failure' });
      this.structuredLogger.error('Synthetic user journey test failed', error, { correlationId: 'synthetic-monitoring' });
      span.recordException(error);
    } finally {
      span.end();
    }
  }

  private async testAchievementProgression(): Promise<void> {
    const span = this.telemetryService.startSpan('synthetic_achievement_test');
    
    try {
      const startTime = Date.now();
      
      // 1. Check achievement eligibility
      await this.httpService.get(`${this.baseUrl}/fee-progression/check-achievements/test`).toPromise();
      
      // 2. Simulate achievement unlock
      await this.httpService.post(`${this.baseUrl}/fee-progression/simulate-achievement`, {
        achievement: 'CONSISTENCY_STREAK_7',
        userId: 'test_user'
      }).toPromise();
      
      // 3. Check tier progression
      await this.httpService.get(`${this.baseUrl}/fee-progression/tier-progress/test`).toPromise();
      
      // 4. Verify fee calculation with achievements
      await this.httpService.get(`${this.baseUrl}/fee-progression/calculate-with-achievements/test`).toPromise();
      
      const duration = Date.now() - startTime;
      
      this.prometheusService.recordHistogram('synthetic_achievement_test_duration', duration / 1000);
      this.prometheusService.incrementCounter('synthetic_achievement_tests_total', { status: 'success' });
      
      this.structuredLogger.logPerformance('synthetic_achievement_test', duration, { correlationId: 'synthetic-monitoring' });
      
    } catch (error) {
      this.prometheusService.incrementCounter('synthetic_achievement_tests_total', { status: 'failure' });
      this.structuredLogger.error('Synthetic achievement test failed', error, { correlationId: 'synthetic-monitoring' });
      span.recordException(error);
    } finally {
      span.end();
    }
  }

  // Manual trigger for immediate testing
  async runAllTests(): Promise<{ passed: number; total: number; results: any[] }> {
    this.structuredLogger.logWithCorrelation(
      'info',
      'Running manual synthetic monitoring tests',
      'synthetic-monitoring'
    );

    await this.performHealthChecks();
    await this.performBusinessFlowTests();

    // Get current metrics
    const passed = await this.getMetricValue('synthetic_checks_passed');
    const total = await this.getMetricValue('synthetic_checks_total');

    return {
      passed: passed || 0,
      total: total || 0,
      results: []
    };
  }

  private async getMetricValue(metricName: string): Promise<number> {
    try {
      const response = await this.httpService.get(`${this.baseUrl}/metrics`).toPromise();
      const metrics = response.data;
      
      const lines = metrics.split('\n');
      for (const line of lines) {
        if (line.startsWith(metricName)) {
          return parseFloat(line.split(' ')[1]);
        }
      }
      
      return 0;
    } catch (error) {
      this.structuredLogger.error(`Failed to get metric ${metricName}`, error, { correlationId: 'synthetic-monitoring' });
      return 0;
    }
  }

  // Get synthetic monitoring status
  getSyntheticMonitoringStatus(): {
    lastRun: string;
    nextRun: string;
    checksPassed: number;
    checksTotal: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const now = new Date();
    const nextRun = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

    return {
      lastRun: now.toISOString(),
      nextRun: nextRun.toISOString(),
      checksPassed: 0, // Would be pulled from actual metrics
      checksTotal: 6, // Total number of checks
      status: 'healthy'
    };
  }
}

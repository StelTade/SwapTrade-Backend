// src/queue/processors/report.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../queue.constants';
import { ReportJobData } from '../queue.service';

@Processor(QueueName.REPORTS)
export class ReportJobProcessor {
  private readonly logger = new Logger(ReportJobProcessor.name);

  @Process({ concurrency: 1 })
  async processReport(job: Job<ReportJobData>): Promise<void> {
    const { reportType, startDate, endDate, format, email } = job.data;

    this.logger.log(
      `Processing report job ${job.id}: ${reportType} (${format}) from ${startDate} to ${endDate}`,
    );

    try {
      await job.progress(5);
      const data = await this.fetchReportData(job.data);
      await job.progress(30);
      const reportBuffer = await this.generateReport(data, format);
      await job.progress(70);
      const reportPath = await this.saveReport(reportBuffer, job.data);
      await job.progress(85);

      if (email) {
        await this.sendReportEmail(email, reportPath, job.data);
      }

      await job.progress(100);
      this.logger.log(
        `Report generated successfully: ${reportType} saved to ${reportPath}`,
      );
    } catch (error) {
      this.logger.error(`Failed to process report job ${job.id}:`, error.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<ReportJobData>): void {
    this.logger.debug(
      `Report job ${job.id} is now active: ${job.data.reportType}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<ReportJobData>, result: any): void {
    this.logger.log(`Report job ${job.id} completed: ${job.data.reportType}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<ReportJobData>, error: Error): void {
    const attempts = job.opts.attempts || 2;
    this.logger.error(
      `Report job ${job.id} failed: ${job.data.reportType}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );
  }

  private async fetchReportData(jobData: ReportJobData): Promise<any> {
    this.logger.debug(`Fetching data for ${jobData.reportType} report`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return {
      reportType: jobData.reportType,
      period: `${jobData.startDate} to ${jobData.endDate}`,
      totalTrades: 150,
      totalVolume: 50000,
      averageTradeValue: 333.33,
    };
  }

  private async generateReport(data: any, format: string): Promise<Buffer> {
    this.logger.debug(`Generating report in ${format} format`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return Buffer.from(JSON.stringify(data, null, 2));
  }

  private async saveReport(
    buffer: Buffer,
    jobData: ReportJobData,
  ): Promise<string> {
    const filename = `report-${jobData.reportType}-${Date.now()}.${jobData.format}`;
    const path = `reports/${filename}`;
    this.logger.debug(`Report saved to ${path}`);
    return path;
  }

  private async sendReportEmail(
    email: string,
    reportPath: string,
    jobData: ReportJobData,
  ): Promise<void> {
    this.logger.debug(`Sending report to ${email}`);
  }
}

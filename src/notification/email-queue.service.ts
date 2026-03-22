/**
 * Email Queue Service
 * 基于队列的邮件发送服务，支持重试和速率限制
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import {
  EmailJob,
  EmailJobStatus,
  EmailJobPriority,
} from './entities/email-job.entity';

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  templateKey?: string;
  userId?: number;
  priority?: EmailJobPriority;
  maxRetries?: number;
}

@Injectable()
export class EmailQueueService implements OnModuleInit {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 30000]; // 指数退避：1s, 5s, 30s
  private readonly RATE_LIMIT_PER_MINUTE = 60;
  private lastSendTime: Map<string, number> = new Map();

  constructor(
    @InjectRepository(EmailJob)
    private readonly emailJobRepo: Repository<EmailJob>,
  ) {}

  async onModuleInit() {
    this.logger.log('Email Queue Service 已初始化');
    // 启动时恢复未完成的邮件任务
    await this.recoverPendingJobs();
  }

  /**
   * 添加邮件到队列
   */
  async enqueueEmail(data: EmailJobData): Promise<EmailJob> {
    const job = this.emailJobRepo.create({
      to: data.to,
      subject: data.subject,
      body: data.body,
      templateKey: data.templateKey,
      userId: data.userId,
      status: EmailJobStatus.PENDING,
      priority: data.priority || EmailJobPriority.NORMAL,
      attempt: 0,
      maxRetries: data.maxRetries || this.MAX_RETRIES,
      nextRunAt: new Date(),
    });

    await this.emailJobRepo.save(job);
    this.logger.log(`邮件已加入队列：${job.id} -> ${data.to}`);
    return job;
  }

  /**
   * 处理队列中的邮件（每分钟调用）
   */
  @Interval(60000) // 每分钟执行一次
  async processQueue() {
    this.logger.debug('开始处理邮件队列...');

    const now = new Date();

    // 获取待处理的邮件（按优先级排序）
    const jobs = await this.emailJobRepo.find({
      where: {
        status: EmailJobStatus.PENDING,
        nextRunAt: LessThan(now),
      },
      order: {
        priority: 'DESC',
        nextRunAt: 'ASC',
      },
      take: this.RATE_LIMIT_PER_MINUTE,
    });

    let sentCount = 0;

    for (const job of jobs) {
      if (sentCount >= this.RATE_LIMIT_PER_MINUTE) {
        break;
      }

      // 速率限制检查（同一用户每分钟最多 1 封）
      if (job.userId) {
        const lastSend = this.lastSendTime.get(`user-${job.userId}`);
        if (lastSend && Date.now() - lastSend < 60000) {
          this.logger.debug(`速率限制：用户 ${job.userId} 的邮件延后发送`);
          job.nextRunAt = new Date(Date.now() + 60000);
          await this.emailJobRepo.save(job);
          continue;
        }
      }

      // 发送邮件
      try {
        await this.sendEmail(job);
        this.lastSendTime.set(`user-${job.userId || job.to}`, Date.now());
        sentCount++;
      } catch (error) {
        await this.handleSendFailure(job, error);
      }
    }

    this.logger.log(`邮件队列处理完成：发送 ${sentCount} 封`);
  }

  /**
   * 发送邮件
   */
  private async sendEmail(job: EmailJob): Promise<void> {
    this.logger.log(`发送邮件：${job.id} -> ${job.to}`);

    // TODO: 集成实际的邮件发送服务（SendGrid/Mailgun/SMTP）
    // 这里使用 nodemailer 示例
    const nodemailer = require('nodemailer');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.mailgun.org',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"SwapTrade" <${process.env.SMTP_FROM || 'noreply@swaptrade.io'}>`,
      to: job.to,
      subject: job.subject,
      html: job.body,
    });

    // 更新状态为成功
    job.status = EmailJobStatus.COMPLETED;
    job.completedAt = new Date();
    job.lastError = null;
    await this.emailJobRepo.save(job);

    this.logger.log(`邮件发送成功：${job.id}`);
  }

  /**
   * 处理发送失败（重试逻辑）
   */
  private async handleSendFailure(job: EmailJob, error: Error): Promise<void> {
    job.attempt += 1;
    job.lastError = error.message;

    if (job.attempt >= job.maxRetries) {
      // 超过最大重试次数，标记为失败
      job.status = EmailJobStatus.FAILED;
      job.failedAt = new Date();
      this.logger.error(`邮件发送失败（已达最大重试次数）：${job.id} - ${error.message}`);
    } else {
      // 指数退避重试
      const delay = this.RETRY_DELAYS[job.attempt - 1] || 60000;
      job.nextRunAt = new Date(Date.now() + delay);
      job.status = EmailJobStatus.RETRYING;
      this.logger.warn(`邮件发送失败，稍后重试：${job.id} (第 ${job.attempt} 次)`);
    }

    await this.emailJobRepo.save(job);
  }

  /**
   * 恢复未完成的邮件任务
   */
  private async recoverPendingJobs(): Promise<void> {
    const pendingJobs = await this.emailJobRepo.find({
      where: {
        status: EmailJobStatus.PENDING,
      },
    });

    this.logger.log(`恢复 ${pendingJobs.length} 个未完成的邮件任务`);

    // 重置所有 pending 任务的 nextRunAt，让它们立即处理
    for (const job of pendingJobs) {
      job.nextRunAt = new Date();
    }

    if (pendingJobs.length > 0) {
      await this.emailJobRepo.save(pendingJobs);
    }
  }

  /**
   * 清理已完成的邮件任务（保留最近 7 天）
   */
  @Interval(3600000) // 每小时执行一次
  async cleanupOldJobs() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await this.emailJobRepo.delete({
      status: EmailJobStatus.COMPLETED,
      completedAt: LessThan(sevenDaysAgo),
    });

    if (result.affected) {
      this.logger.log(`清理 ${result.affected} 个已完成的邮件任务`);
    }
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats() {
    const [pending, completed, failed, retrying] = await Promise.all([
      this.emailJobRepo.count({ where: { status: EmailJobStatus.PENDING } }),
      this.emailJobRepo.count({ where: { status: EmailJobStatus.COMPLETED } }),
      this.emailJobRepo.count({ where: { status: EmailJobStatus.FAILED } }),
      this.emailJobRepo.count({ where: { status: EmailJobStatus.RETRYING } }),
    ]);

    return {
      pending,
      completed,
      failed,
      retrying,
      total: pending + completed + failed + retrying,
    };
  }
}

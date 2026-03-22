/**
 * Waitlist Notification Service
 * 实现等待列表相关的邮件通知服务
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { NotificationTemplate } from './entities/notification-template.entity';

export interface WaitlistSignupData {
  email: string;
  name?: string;
  signupDate: Date;
  referralCode?: string;
}

export interface ReferralSuccessData {
  email: string;
  name?: string;
  refereeEmail: string;
  pointsAwarded: number;
  totalPoints: number;
}

export interface LaunchNotificationData {
  email: string;
  name?: string;
  launchDate: Date;
  specialOffer?: string;
}

@Injectable()
export class WaitlistNotificationService {
  private readonly logger = new Logger(WaitlistNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
  ) {}

  /**
   * 发送等待列表注册确认邮件
   */
  async sendSignupConfirmation(data: WaitlistSignupData): Promise<void> {
    this.logger.log(`发送注册确认邮件到：${data.email}`);

    const template = await this.getOrCreateTemplate(
      'waitlist-signup',
      '等待列表注册确认',
      `
        <h1>欢迎加入 SwapTrade 等待列表！🎉</h1>
        <p>亲爱的 {{name}}，</p>
        <p>感谢您注册 SwapTrade 等待列表。我们已收到您的注册申请，将在产品上线时第一时间通知您。</p>
        <p><strong>注册邮箱：</strong>{{email}}</p>
        <p><strong>注册日期：</strong>{{signupDate}}</p>
        {{#if referralCode}}
        <p><strong>推荐码：</strong>{{referralCode}}</p>
        {{/if}}
        <p>祝您交易愉快！</p>
        <p>SwapTrade 团队</p>
      `,
    );

    try {
      await this.notificationService.send({
        userId: null,
        type: 'waitlist-signup',
        channels: ['email'],
        subject: '欢迎加入 SwapTrade 等待列表！',
        message: this.renderTemplate(template.content, data),
        templateKey: 'waitlist-signup',
      });

      this.logger.log(`注册确认邮件发送成功：${data.email}`);
    } catch (error) {
      this.logger.error(`注册确认邮件发送失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 发送推荐成功通知邮件
   */
  async sendReferralSuccess(data: ReferralSuccessData): Promise<void> {
    this.logger.log(`发送推荐成功通知到：${data.email}`);

    const template = await this.getOrCreateTemplate(
      'referral-success',
      '推荐成功通知',
      `
        <h1>推荐成功！🎁</h1>
        <p>亲爱的 {{name}}，</p>
        <p>恭喜！您推荐的朋友 <strong>{{refereeEmail}}</strong> 已成功注册 SwapTrade。</p>
        <p><strong>获得积分：</strong>+{{pointsAwarded}} 点</p>
        <p><strong>当前总积分：</strong>{{totalPoints}} 点</p>
        <p>继续邀请更多朋友，赢取更多奖励！</p>
        <p>SwapTrade 团队</p>
      `,
    );

    try {
      await this.notificationService.send({
        userId: null,
        type: 'referral-success',
        channels: ['email'],
        subject: '推荐成功！积分已到账',
        message: this.renderTemplate(template.content, data),
        templateKey: 'referral-success',
      });

      this.logger.log(`推荐成功通知发送成功：${data.email}`);
    } catch (error) {
      this.logger.error(`推荐成功通知发送失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 发送产品上线通知邮件
   */
  async sendLaunchNotification(data: LaunchNotificationData): Promise<void> {
    this.logger.log(`发送上线通知到：${data.email}`);

    const template = await this.getOrCreateTemplate(
      'launch-notification',
      '产品上线通知',
      `
        <h1>SwapTrade 正式上线啦！🚀</h1>
        <p>亲爱的 {{name}}，</p>
        <p>感谢您耐心等待！SwapTrade 现已正式上线。</p>
        <p><strong>上线日期：</strong>{{launchDate}}</p>
        {{#if specialOffer}}
        <p><strong>特别优惠：</strong>{{specialOffer}}</p>
        {{/if}}
        <p>立即注册，开始您的交易之旅！</p>
        <p><a href="https://swaptrade.io/register" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">立即注册</a></p>
        <p>SwapTrade 团队</p>
      `,
    );

    try {
      await this.notificationService.send({
        userId: null,
        type: 'launch-notification',
        channels: ['email'],
        subject: 'SwapTrade 正式上线！立即注册',
        message: this.renderTemplate(template.content, data),
        templateKey: 'launch-notification',
      });

      this.logger.log(`上线通知发送成功：${data.email}`);
    } catch (error) {
      this.logger.error(`上线通知发送失败：${error.message}`);
      throw error;
    }
  }

  /**
   * 获取或创建邮件模板
   */
  private async getOrCreateTemplate(
    key: string,
    subject: string,
    content: string,
  ): Promise<NotificationTemplate> {
    let template = await this.templateRepo.findOne({ where: { templateKey: key } });

    if (!template) {
      template = this.templateRepo.create({
        templateKey: key,
        subject,
        content,
        variables: this.extractVariables(content),
      });
      await this.templateRepo.save(template);
      this.logger.log(`创建新模板：${key}`);
    }

    return template;
  }

  /**
   * 渲染模板
   */
  private renderTemplate(template: string, data: any): string {
    const compiled = Handlebars.compile(template);
    return compiled({
      ...data,
      signupDate: data.signupDate?.toLocaleDateString('zh-CN'),
      launchDate: data.launchDate?.toLocaleDateString('zh-CN'),
    });
  }

  /**
   * 提取模板变量
   */
  private extractVariables(content: string): string[] {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
    return matches
      .map((m) => m.replace(/{{|}}/g, '').trim())
      .filter((v) => !v.startsWith('#') && !v.startsWith('/'));
  }
}

// 需要引入 Handlebars
import * as Handlebars from 'handlebars';

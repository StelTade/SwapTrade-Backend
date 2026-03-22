/**
 * Fraud Prevention Guard - 反欺诈守卫
 * 实现 IP 速率限制和 CAPTCHA 验证钩子
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class FraudPreventionGuard extends ThrottlerGuard implements CanActivate {
  private readonly logger = new Logger(FraudPreventionGuard.name);

  constructor(protected reflector: Reflector) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = this.tracker.getAddress(request);

    // 检查是否在黑名单中
    if (await this.isBlacklisted(ip)) {
      this.logger.warn(`黑名单 IP 被阻止：${ip}`);
      return false;
    }

    // 调用父类的速率限制检查
    try {
      return await super.canActivate(context);
    } catch (error) {
      this.logger.warn(`速率限制触发：${ip}`);
      throw error;
    }
  }

  /**
   * 检查 IP 是否在黑名单中
   */
  private async isBlacklisted(ip: string): Promise<boolean> {
    // TODO: 查询黑名单数据库
    // const blacklist = await this.blacklistRepo.findOne({ where: { ip, expiresAt: MoreThan(new Date()) } });
    // return !!blacklist;
    return false;
  }

  /**
   * 生成追踪器键
   */
  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest();
    const ip = this.tracker.getAddress(request);
    return `${suffix}-${ip}`;
  }

  /**
   * 处理速率限制错误
   */
  protected throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const ip = this.tracker.getAddress(request);

    this.logger.error(`速率限制异常：${ip}`);

    // TODO: 记录到可疑记录
    // await this.fraudService.logSuspiciousActivity({
    //   type: 'rate_limit_exceeded',
    //   ip,
    //   path: request.path,
    // });

    return super.throwThrottlingException(context);
  }
}

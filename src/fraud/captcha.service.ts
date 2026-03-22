/**
 * CAPTCHA Service - 验证码服务
 * 提供 CAPTCHA 验证钩子支持
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface CaptchaChallenge {
  id: string;
  type: 'math' | 'image' | 'text';
  challenge: string;
  expiresAt: Date;
  attempts: number;
}

export interface CaptchaVerificationResult {
  success: boolean;
  error?: string;
}

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly challenges: Map<string, CaptchaChallenge> = new Map();
  private readonly CHALLENGE_TTL = 5 * 60 * 1000; // 5 分钟
  private readonly MAX_ATTEMPTS = 3;

  /**
   * 生成验证码挑战
   */
  generateChallenge(type: 'math' | 'image' | 'text' = 'math'): CaptchaChallenge {
    const id = crypto.randomBytes(16).toString('hex');
    let challenge: string;
    let answer: string;

    switch (type) {
      case 'math':
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        challenge = `${a} + ${b} = ?`;
        answer = (a + b).toString();
        break;

      case 'text':
        const words = ['apple', 'banana', 'orange', 'grape', 'melon'];
        const word = words[Math.floor(Math.random() * words.length)];
        challenge = `请输入以下单词：${word.split('').reverse().join('')}`;
        answer = word;
        break;

      case 'image':
        // TODO: 生成图片验证码
        challenge = '图片验证码 URL';
        answer = 'random123';
        break;

      default:
        challenge = 'Unknown';
        answer = 'unknown';
    }

    const captchaChallenge: CaptchaChallenge = {
      id,
      type,
      challenge,
      expiresAt: new Date(Date.now() + this.CHALLENGE_TTL),
      attempts: 0,
    };

    // 存储答案（实际应该加密存储）
    this.challenges.set(id, {
      ...captchaChallenge,
      challenge: answer, // 存储答案用于验证
    });

    return captchaChallenge;
  }

  /**
   * 验证验证码
   */
  verifyChallenge(id: string, answer: string): CaptchaVerificationResult {
    const challenge = this.challenges.get(id);

    if (!challenge) {
      return {
        success: false,
        error: '验证码不存在或已过期',
      };
    }

    // 检查是否过期
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(id);
      return {
        success: false,
        error: '验证码已过期',
      };
    }

    // 检查尝试次数
    if (challenge.attempts >= this.MAX_ATTEMPTS) {
      this.challenges.delete(id);
      return {
        success: false,
        error: '尝试次数过多',
      };
    }

    // 验证答案
    if (answer.toLowerCase() !== challenge.challenge.toLowerCase()) {
      challenge.attempts += 1;
      this.challenges.set(id, challenge);
      return {
        success: false,
        error: `答案错误，还剩 ${this.MAX_ATTEMPTS - challenge.attempts} 次尝试`,
      };
    }

    // 验证成功，删除挑战
    this.challenges.delete(id);
    return {
      success: true,
    };
  }

  /**
   * 清理过期的挑战
   */
  cleanupExpiredChallenges(): number {
    const now = Date.now();
    let count = 0;

    for (const [id, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt.getTime()) {
        this.challenges.delete(id);
        count++;
      }
    }

    if (count > 0) {
      this.logger.debug(`清理 ${count} 个过期验证码`);
    }

    return count;
  }

  /**
   * 验证 CAPTCHA（装饰器方式）
   */
  async validateCaptcha(
    captchaId: string,
    captchaAnswer: string,
  ): Promise<void> {
    if (!captchaId || !captchaAnswer) {
      throw new BadRequestException('缺少验证码参数');
    }

    const result = this.verifyChallenge(captchaId, captchaAnswer);

    if (!result.success) {
      throw new BadRequestException(result.error);
    }
  }
}

/**
 * CAPTCHA Service 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { CaptchaService } from './captcha.service';

describe('CaptchaService', () => {
  let service: CaptchaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CaptchaService],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
  });

  it('应该被定义', () => {
    expect(service).toBeDefined();
  });

  describe('generateChallenge', () => {
    it('应该生成数学验证码', () => {
      const challenge = service.generateChallenge('math');

      expect(challenge.id).toBeDefined();
      expect(challenge.type).toBe('math');
      expect(challenge.challenge).toContain('= ?');
      expect(challenge.expiresAt).toBeDefined();
    });

    it('应该生成文本验证码', () => {
      const challenge = service.generateChallenge('text');

      expect(challenge.type).toBe('text');
      expect(challenge.challenge).toContain('请输入以下单词');
    });
  });

  describe('verifyChallenge', () => {
    it('应该验证成功', () => {
      const challenge = service.generateChallenge('math');
      // 提取答案（简化测试）
      const answer = challenge.challenge.split('=')[0].trim();
      // 计算正确答案
      const parts = answer.split('+').map(s => parseInt(s.trim()));
      const correctAnswer = (parts[0] + parts[1]).toString();

      const result = service.verifyChallenge(challenge.id, correctAnswer);

      expect(result.success).toBe(true);
    });

    it('应该验证失败（错误答案）', () => {
      const challenge = service.generateChallenge('math');
      const result = service.verifyChallenge(challenge.id, 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toContain('答案错误');
    });

    it('应该验证失败（过期）', async () => {
      const challenge = service.generateChallenge('math');
      
      // 手动过期
      challenge.expiresAt = new Date(Date.now() - 1000);
      service['challenges'].set(challenge.id, challenge);

      const result = service.verifyChallenge(challenge.id, 'any');

      expect(result.success).toBe(false);
      expect(result.error).toContain('已过期');
    });

    it('应该验证失败（超过尝试次数）', () => {
      const challenge = service.generateChallenge('math');
      
      // 设置尝试次数为最大值
      challenge.attempts = 3;
      service['challenges'].set(challenge.id, challenge);

      const result = service.verifyChallenge(challenge.id, 'any');

      expect(result.success).toBe(false);
      expect(result.error).toContain('尝试次数过多');
    });
  });

  describe('cleanupExpiredChallenges', () => {
    it('应该清理过期挑战', () => {
      const challenge1 = service.generateChallenge('math');
      const challenge2 = service.generateChallenge('math');

      // 过期 challenge1
      challenge1.expiresAt = new Date(Date.now() - 1000);
      service['challenges'].set(challenge1.id, challenge1);

      const count = service.cleanupExpiredChallenges();

      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
});

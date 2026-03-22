/**
 * Admin Controller 单元测试
 * 版权声明：MIT License | Copyright (c) 2026 思捷娅科技 (SJYKJ)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    getWaitlist: jest.fn(),
    updateWaitlistStatus: jest.fn(),
    manualInvite: jest.fn(),
    getReferrals: jest.fn(),
    adjustReferralPoints: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('应该被定义', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /admin/waitlist', () => {
    it('应该返回分页的等待列表', async () => {
      const mockQuery = { page: 1, limit: 20 };
      const mockResult = {
        data: [{ id: 1, email: 'test@example.com', status: 'pending' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockAdminService.getWaitlist.mockResolvedValue(mockResult);

      const result = await controller.getWaitlist(mockQuery as any);

      expect(result).toEqual({
        success: true,
        data: mockResult.data,
        pagination: {
          total: mockResult.total,
          page: mockResult.page,
          limit: mockResult.limit,
          totalPages: mockResult.totalPages,
        },
      });
      expect(service.getWaitlist).toHaveBeenCalledWith(mockQuery);
    });
  });

  describe('PATCH /admin/waitlist/:id/status', () => {
    it('应该更新等待列表状态', async () => {
      const mockId = 1;
      const mockDto = { status: 'invited', reason: '测试' };
      const mockResult = { id: 1, status: 'invited' };

      mockAdminService.updateWaitlistStatus.mockResolvedValue(mockResult);

      const result = await controller.updateWaitlistStatus(mockId, mockDto as any);

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: '状态更新成功',
      });
      expect(service.updateWaitlistStatus).toHaveBeenCalledWith(mockId, mockDto, expect.any(Number));
    });
  });

  describe('POST /admin/waitlist/:id/invite', () => {
    it('应该发送手动邀请', async () => {
      const mockId = 1;
      const mockDto = { message: '欢迎加入！' };
      const mockResult = { id: 1, status: 'invited', invitedAt: new Date() };

      mockAdminService.manualInvite.mockResolvedValue(mockResult);

      const result = await controller.manualInvite(mockId, mockDto as any);

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: '邀请已发送',
      });
      expect(service.manualInvite).toHaveBeenCalledWith(mockId, expect.any(Number), mockDto.message);
    });
  });

  describe('GET /admin/referrals', () => {
    it('应该返回分页的推荐列表', async () => {
      const mockQuery = { page: 1, limit: 20 };
      const mockResult = {
        data: [{ id: 1, points: 100, suspect: false }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockAdminService.getReferrals.mockResolvedValue(mockResult);

      const result = await controller.getReferrals(mockQuery as any);

      expect(result).toEqual({
        success: true,
        data: mockResult.data,
        pagination: {
          total: mockResult.total,
          page: mockResult.page,
          limit: mockResult.limit,
          totalPages: mockResult.totalPages,
        },
      });
      expect(service.getReferrals).toHaveBeenCalledWith(mockQuery);
    });
  });

  describe('POST /admin/referrals/:id/adjust', () => {
    it('应该调整推荐积分', async () => {
      const mockId = 1;
      const mockDto = { pointsAdjustment: 50, reason: '奖励' };
      const mockResult = { id: 1, points: 150 };

      mockAdminService.adjustReferralPoints.mockResolvedValue(mockResult);

      const result = await controller.adjustReferralPoints(mockId, mockDto as any);

      expect(result).toEqual({
        success: true,
        data: mockResult,
        message: '积分调整成功',
      });
      expect(service.adjustReferralPoints).toHaveBeenCalledWith(mockId, mockDto, expect.any(Number));
    });
  });

  describe('GET /admin/health', () => {
    it('应该返回健康状态', async () => {
      const result = await controller.health();

      expect(result).toEqual({
        success: true,
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });
});

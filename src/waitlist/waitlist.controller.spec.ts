import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistUserStatus } from './entities/waitlist-user.entity';

describe('WaitlistController', () => {
  let controller: WaitlistController;
  let service: jest.Mocked<WaitlistService>;

  const mockUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    name: 'Test User',
    referralCode: 'ABC123XY',
    referredBy: null,
    status: WaitlistUserStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockService = {
      signup: jest.fn(),
      verify: jest.fn(),
      getUserById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WaitlistController],
      providers: [{ provide: WaitlistService, useValue: mockService }],
    }).compile();

    controller = module.get<WaitlistController>(WaitlistController);
    service = module.get(WaitlistService);
  });

  describe('signup', () => {
    it('should call waitlistService.signup with correct parameters', async () => {
      const dto = { email: 'test@example.com', name: 'Test User' };
      service.signup.mockResolvedValue({
        user: mockUser,
        message: 'Verification email sent',
      });

      const result = await controller.signup(dto);

      expect(service.signup).toHaveBeenCalledWith(dto);
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('verify', () => {
    it('should call waitlistService.verify with correct parameters', async () => {
      const dto = { token: 'valid_token' };
      const verifiedUser = { ...mockUser, status: WaitlistUserStatus.VERIFIED };
      service.verify.mockResolvedValue({
        user: verifiedUser,
        message: 'Email verified successfully',
      });

      const result = await controller.verify(dto);

      expect(service.verify).toHaveBeenCalledWith(dto);
      expect(result.user.status).toBe(WaitlistUserStatus.VERIFIED);
    });
  });

  describe('getUser', () => {
    it('should call waitlistService.getUserById with correct ID', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      service.getUserById.mockResolvedValue(mockUser);

      const result = await controller.getUser(userId);

      expect(service.getUserById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });
  });
});

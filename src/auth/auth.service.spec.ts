import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RegisterDto } from './dtos/register.dto';
import { SignInDto } from './dtos/userDto';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};
const mockMailService = {
  sendVerificationEmail: jest.fn(),
};
const mockJwtService = {
  sign: jest.fn(),
};

jest.mock('bcryptjs', () => ({
  hash: jest.fn(async () => 'hashed'),
  compare: jest.fn(async (a, b) => a === b),
}));

jest.mock('../utils/jwt.util', () => ({
  generateVerificationToken: jest.fn(() => 'token'),
  verifyJwtToken: jest.fn(() => ({ email: 'test@example.com' })),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw if email exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({});
      await expect(service.register({ email: 'test@example.com', password: 'pass' } as RegisterDto)).rejects.toThrow(BadRequestException);
    });
    it('should register and send email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockUserRepo.create.mockReturnValue({ email: 'test@example.com', password: 'hashed', verificationToken: 'token', role: 'user' });
      mockUserRepo.save.mockResolvedValue({});
      await expect(service.register({ email: 'test@example.com', password: 'pass' } as RegisterDto)).resolves.toBeDefined();
      expect(mockMailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'token');
    });
  });

  describe('signIn', () => {
    it('should throw if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.signIn({ email: 'test@example.com', password: 'pass' } as SignInDto)).rejects.toThrow(UnauthorizedException);
    });
    it('should throw if not verified', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: false });
      await expect(service.signIn({ email: 'test@example.com', password: 'pass' } as SignInDto)).rejects.toThrow(UnauthorizedException);
    });
    it('should throw if password mismatch', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: true, password: 'other' });
      await expect(service.signIn({ email: 'test@example.com', password: 'pass' } as SignInDto)).rejects.toThrow(UnauthorizedException);
    });
    it('should return token if valid', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: true, password: 'pass', id: 1, role: 'user', email: 'test@example.com' });
      mockJwtService.sign.mockReturnValue('jwt');
      await expect(service.signIn({ email: 'test@example.com', password: 'pass' } as SignInDto)).resolves.toMatchObject({ access_token: 'jwt' });
    });
  });

  describe('verifyEmail', () => {
    it('should throw if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('token')).rejects.toThrow(BadRequestException);
    });
    it('should return already verified', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: true });
      await expect(service.verifyEmail('token')).resolves.toMatchObject({ message: 'Already verified' });
    });
    it('should verify user', async () => {
      mockUserRepo.findOne.mockResolvedValue({ isVerified: false });
      mockUserRepo.save.mockResolvedValue({});
      await expect(service.verifyEmail('token')).resolves.toMatchObject({ message: 'Email verified successfully' });
    });
  });
});

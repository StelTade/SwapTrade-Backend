import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailService } from '../email/email.service';
import { UserServices } from 'src/user/provider/user-services.service';
describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let repository: Repository<PasswordResetToken>;
  let emailService: EmailService;
  let usersService: UserServices;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: getRepositoryToken(PasswordResetToken),
          useClass: Repository,
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendPasswordResetConfirmationEmail: jest.fn(),
          },
        },
        {
          provide: UserServices,
          useValue: {
            findByEmail: jest.fn(),
            findOne: jest.fn(),
            updatePassword: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                PASSWORD_RESET_EXPIRATION_HOURS: '1',
                PASSWORD_RESET_RATE_LIMIT_MINUTES: '15',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    repository = module.get<Repository<PasswordResetToken>>(
      getRepositoryToken(PasswordResetToken),
    );
    emailService = module.get<EmailService>(EmailService);
    usersService = module.get<UserServices>(UserServices);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestPasswordReset', () => {
    it('should generate token and send email for valid user', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
      };

      jest.spyOn(usersService, 'findUserByEmail').mockResolvedValue(mockUser);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue({} as any);
      jest.spyOn(repository, 'save').mockResolvedValue({} as any);
      jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue();

      await service.requestPasswordReset(
        'test@example.com',
        '127.0.0.1',
        'test-agent',
      );

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should not throw error for non-existent email', async () => {
      jest.spyOn(usersService, 'findUserByEmail').mockResolvedValue(null);

      await expect(
        service.requestPasswordReset(
          'nonexistent@example.com',
          '127.0.0.1',
          'test-agent',
        ),
      ).resolves.not.toThrow();
    });
  });
});

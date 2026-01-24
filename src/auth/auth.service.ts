import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthError } from '../common/enums/auth-error.enum';
import { checkRateLimit } from './rate-limiter';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(dto: LoginDto) {
    const allowed = checkRateLimit(dto.email);
    if (!allowed) {
      this.logger.warn(AuthError.RATE_LIMIT_EXCEEDED);
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.findUserByEmail(dto.email);

    // IMPORTANT: do NOT reveal which part failed
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      this.logger.warn(AuthError.INVALID_CREDENTIALS);
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.findUserByEmail(dto.email);

    // Security best practice: generic response
    if (existingUser) {
      throw new BadRequestException('Registration failed');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.createUser({
      email: dto.email,
      passwordHash,
    });

    return { id: user.id, email: user.email };
  }

  // ===== MOCKED / EXISTING METHODS =====
  private async findUserByEmail(email: string): Promise<{ id: number; email: string; passwordHash: string } | null> {
    return null; // replace with repo call
  }

  private async createUser(data: any) {
    return data;
  }

  private generateToken(user: any) {
    return { accessToken: 'jwt-token' };
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDto } from './dtos/register.dto';
import { User } from 'src/user/user.entity';
import * as bcrypt from 'bcryptjs';
import { generateVerificationToken, verifyJwtToken } from '../utils/jwt.util';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already in use');

    const hash = await bcrypt.hash(dto.password, 10);
    const token = generateVerificationToken(dto.email);

    const user = this.userRepo.create({
      email: dto.email,
      password: hash,
      verificationToken: token,
    });

    await this.userRepo.save(user);
    await this.mailService.sendVerificationEmail(dto.email, token);

    return { message: 'Registration successful. Check your email for verification link.' };
  }

  async verifyEmail(token: string) {
    try {
      const decoded = verifyJwtToken(token);
      const user = await this.userRepo.findOne({ where: { email: decoded.email } });
      if (!user) throw new BadRequestException('Invalid token');
      if (user.isVerified) return { message: 'Already verified' };

      user.isVerified = true;
      user.verificationToken = null;
      await this.userRepo.save(user);
      return { message: 'Email verified successfully' };
    } catch (err) {
      throw new BadRequestException('Invalid or expired token');
    }
  }
}
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDto } from './dtos/register.dto';
import { User } from '../user/user.entity';
import * as bcrypt from 'bcryptjs';
import { generateVerificationToken, verifyJwtToken } from '../utils/jwt.util';
import { MailService } from '../mail/mail.service';

import { SignInDto } from './dtos/userDto';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private mailService: MailService,
    private jwtService: JwtService,
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
      role: 'user',
    });

    await this.userRepo.save(user);
    await this.mailService.sendVerificationEmail(dto.email, token);

    return { message: 'Registration successful. Check your email for verification link.' };
  }

  async signIn(signInDto: SignInDto) {
    const user = await this.userRepo.findOne({ where: { email: signInDto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isVerified) throw new UnauthorizedException('Email not verified');
    const isMatch = await bcrypt.compare(signInDto.password, user.password || '');
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, role: user.role };
    const token = this.jwtService.sign(payload);
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
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
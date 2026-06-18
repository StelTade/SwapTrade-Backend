import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MFAController } from './mfa.controller';
import { MFAService } from './mfa.service';
import { Auth } from './entities/auth.entity';
import { Session } from './entities/session.entity';
import { User } from '../user/entities/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthAuditListener } from './listeners/auth-audit.listener';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auth, Session, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<number>('JWT_EXPIRES_IN', 3600),
        },
      }),
    }),
    AuditLogModule,
  ],
  controllers: [AuthController, MFAController],
  providers: [AuthService, MFAService, JwtAuthGuard, AuthAuditListener],
  exports: [AuthService, MFAService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}

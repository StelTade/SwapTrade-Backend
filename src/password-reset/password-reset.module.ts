import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetService } from './password-reset.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailModule } from '../email/email.module';
import { throttlerConfig } from '../config/throttler.config';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordResetToken]),
    ThrottlerModule.forRoot(throttlerConfig),
    UserModule,
    EmailModule,
  ],
  controllers: [PasswordResetController],
  providers: [PasswordResetService],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { EmailModule } from './email/email.module';
import { PasswordResetModule } from './password-reset/password-reset.module';

@Module({
  imports: [AuthModule, UserModule, PasswordResetModule, EmailModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

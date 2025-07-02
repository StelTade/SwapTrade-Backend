import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/user.entity';
import { UserServices } from './user/provider/user-services.service';
import { PortfolioModule } from './portfolio/portfolio.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CryptocurrencyModule } from './cryptocurrency/cryptocurrency.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { EmailModule } from './email/email.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 20, // 20 requests per minute per IP globally
    }),
    DatabaseModule,
    AuthModule,
    CryptocurrencyModule,
    PortfolioModule,
    TransactionsModule,
    UserModule,
    AuthModule,
    PasswordResetModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

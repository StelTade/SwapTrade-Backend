import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user/user.entity';
// import { UserServices } from './user/provider/user-services.service';
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
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
    }),
    DatabaseModule,
    AuthModule,
    CryptocurrencyModule,
    PortfolioModule,
    TransactionsModule,
    UserModule,
    PasswordResetModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { CryptocurrencyModule } from '../cryptocurrency/cryptocurrency.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [UserModule, CryptocurrencyModule, TransactionsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}

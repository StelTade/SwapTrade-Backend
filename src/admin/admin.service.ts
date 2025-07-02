import { Injectable } from '@nestjs/common';
import { UserService } from '../user/provider/user-services.service';
import { CryptocurrencyService } from '../cryptocurrency/cryptocurrency.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly userService: UserService,
    private readonly cryptocurrencyService: CryptocurrencyService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async getUsers() {
    return this.userService.findAll();
  }

  async banUser(id: string) {
    return this.userService.banUser(Number(id));
  }

  async activateUser(id: string) {
    return this.userService.activateUser(Number(id));
  }

  async deactivateUser(id: string) {
    return this.userService.deactivateUser(Number(id));
  }

  async getAssets() {
    return this.cryptocurrencyService.findAll();
  }

  async getOffers() {
    // Placeholder: implement offer logic if available
    return [];
  }

  async getMetrics() {
    const users = await this.userService.findAll();
    // Placeholder: count active trades if available
    return {
      totalUsers: users.length,
      // activeTrades: ...
    };
  }
}

import { DataSource } from 'typeorm';
import { User } from '../user/user.entity';
import { Portfolio } from '../portfolio/entities/portfolio.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Cryptocurrency } from '../cryptocurrency/entities/cryptocurrency.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PasswordResetToken } from '../password-reset/entities/password-reset-token.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'swaptrade',
  entities: [
    User,
    Portfolio,
    Transaction,
    Cryptocurrency,
    Offer,
    Notification,
    PasswordResetToken,
  ],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === 'true',
}); 
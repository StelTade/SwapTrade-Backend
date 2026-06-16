import { DataSource } from 'typeorm';
import { VirtualAsset } from './entities/virtual-asset.entity';
import { UserBalance } from './entities/user-balance.entity';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';

const dbType = (process.env.DB_TYPE || 'postgres') as 'postgres' | 'sqlite';

const dataSourceConfig = {
  type: dbType,
  ...(dbType === 'postgres' ? {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swaptrade',
  } : {
    database: process.env.DATABASE_FILE || 'swaptrade.db',
  }),
  entities: [
    VirtualAsset,
    UserBalance,
    User,
    Trade,
  ],
  migrations: ['src/database/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
} as any;

export const AppDataSource = new DataSource(dataSourceConfig);

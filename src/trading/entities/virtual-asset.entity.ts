import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { UserBalance } from 'src/balance/user-balance.entity';

@Entity('virtual_assets')
@Unique(['symbol'])
export class VirtualAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  symbol: string; // e.g. BTC, ETH

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. Bitcoin, Ethereum

  @Column({ type: 'int', default: 18 })
  decimals: number; // precision (e.g. ETH = 18, USDT = 6)

  @OneToMany(() => UserBalance, (balance) => balance.asset)
  balances: UserBalance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

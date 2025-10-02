import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('virtual_assets')
@Unique(['symbol'])
export class VirtualAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  symbol: string; // e.g. BTC, ETH

  @Column({ type: 'number' })
  balances: number;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. Bitcoin, Ethereum

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

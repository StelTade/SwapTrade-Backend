import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('virtual_assets')
@Unique(['symbol'])
@Index(['symbol'])
export class VirtualAsset {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 50, unique: true })
  symbol: string; // e.g. BTC, ETH

  @Column({ type: 'decimal', precision: 15, scale: 8, default: 0 })
  balances: number;

  @Column({ type: 'varchar', length: 100 })
  name: string; // e.g. Bitcoin, Ethereum

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

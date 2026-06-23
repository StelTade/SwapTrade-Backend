import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BlockchainNetwork } from './blockchain-transaction.entity';

@Entity('wallet_addresses')
@Index(['userId', 'network'], { unique: true })
export class WalletAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  network: BlockchainNetwork;

  @Column({ unique: true })
  address: string;

  /** Encrypted private key — never returned in API responses */
  @Column({ select: false })
  encryptedPrivateKey: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum AnonymityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

@Entity('privacy_profile')
@Index(['userId'], { unique: true })
@Index(['pseudonymousId'], { unique: true })
export class PrivacyProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: number;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid', { unique: true })
  pseudonymousId: string;

  @Column({ type: 'text', comment: 'User public key for encryption' })
  publicKey: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted backup of user private key',
  })
  encryptedPrivateKeyBackup?: string;

  @Column({
    type: 'enum',
    enum: AnonymityLevel,
    default: AnonymityLevel.MEDIUM,
  })
  anonymityLevel: AnonymityLevel;

  @Column({ type: 'boolean', default: false })
  isAnonymous: boolean;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted JSON profile metadata',
  })
  profileMetadata?: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Encrypted user notes/pseudonym',
  })
  encryptedPseudonym?: string;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Count of anonymous orders placed',
  })
  anonymousOrderCount: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: 0,
    comment: 'Anonymized trading volume',
  })
  anonymousTradeVolume: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: 'Privacy settings and preferences',
  })
  privacySettings?: {
    hideOrderHistory?: boolean;
    hideBalance?: boolean;
    enableZKProofs?: boolean;
    autoDeleteOldOrders?: boolean;
    orderRetentionDays?: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

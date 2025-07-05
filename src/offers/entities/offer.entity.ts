import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/user.entity';
import { Portfolio } from '../../portfolio/entities/portfolio.entity';
import { OfferStatus } from '../enums/offer-status.enum';

@Entity()
@Index(['initiatorId', 'status'])
@Index(['recipientId', 'status'])
@Index(['offeredAssetId', 'requestedAssetId'])
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  offeredAssetId: number;

  @Column()
  requestedAssetId: number;

  @Column()
  initiatorId: number;

  @Column()
  recipientId: number;

  @Column({
    type: 'enum',
    enum: OfferStatus,
    default: OfferStatus.PENDING,
  })
  status: OfferStatus;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  offeredAmount?: number;

  @Column('decimal', { precision: 18, scale: 8, nullable: true })
  requestedAmount?: number;

  @Column('text', { nullable: true })
  message?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiatorId' })
  initiator: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipientId' })
  recipient: User;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offeredAssetId' })
  offeredAsset: Portfolio;

  @ManyToOne(() => Portfolio, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestedAssetId' })
  requestedAsset: Portfolio;
} 
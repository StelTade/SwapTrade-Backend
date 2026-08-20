import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { FiatDirection, FiatIntentStatus } from '../enums/fiat.enum';

/**
 * A provider-agnostic fiat on/off-ramp intent. The wallet module ships only a
 * sandbox stub provider; this entity is the persistence contract a real PSP
 * adapter would populate (`provider`, `providerRef`) without schema changes.
 */
@Entity('fiat_payment_intents')
@Index(['userId'])
@Index(['status'])
export class FiatPaymentIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ type: 'varchar' })
  direction: FiatDirection;

  /** Provider identifier, e.g. 'stub', 'stripe'. */
  @Column()
  provider: string;

  /** Opaque reference returned by the provider (session/intent id). */
  @Column({ nullable: true })
  providerRef: string;

  /** ISO-4217 fiat currency code, e.g. 'USD'. */
  @Column({ default: 'USD' })
  currency: string;

  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  /** Ledger asset credited/debited on settlement (e.g. 'USDC'). */
  @Column({ default: 'USDC' })
  asset: string;

  @Column({ type: 'varchar', default: FiatIntentStatus.CREATED })
  status: FiatIntentStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

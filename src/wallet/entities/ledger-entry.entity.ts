import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';

/**
 * Append-only audit row written for every mutation of a {@link WalletLedger}.
 * Balance snapshots (`balanceAfter*`) make the ledger fully reconstructable and
 * reconcilable from history, and `idempotencyKey` guarantees a given external
 * event (e.g. an on-chain deposit tx) can only ever be applied once.
 */
@Entity('ledger_entries')
@Index(['userId', 'asset'])
@Index(['referenceType', 'referenceId'])
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ default: 'USDC' })
  asset: string;

  @Column({ type: 'varchar' })
  entryType: LedgerEntryType;

  /** Absolute magnitude of the movement (always positive). */
  @Column('decimal', { precision: 18, scale: 8 })
  amount: number;

  /** Signed change applied to `available` (+credit / −debit). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  availableDelta: number;

  /** Signed change applied to `reserved`. */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  reservedDelta: number;

  /** `available` immediately after this entry was applied. */
  @Column('decimal', { precision: 18, scale: 8 })
  balanceAfterAvailable: number;

  /** `reserved` immediately after this entry was applied. */
  @Column('decimal', { precision: 18, scale: 8 })
  balanceAfterReserved: number;

  /** e.g. 'withdrawal', 'deposit', 'fiat_intent'. */
  @Column({ nullable: true })
  referenceType: string;

  /** Id of the referenced domain object (withdrawal id, tx hash, …). */
  @Column({ nullable: true })
  referenceId: string;

  /**
   * Deduplication key for externally-triggered credits/debits, e.g.
   * `deposit:bsc:<txHash>`. A unique constraint makes double-application a
   * no-op at the database level.
   */
  @Column({ nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}

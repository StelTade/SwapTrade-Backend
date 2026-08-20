import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

/**
 * Real-funds ledger, keyed on the uuid `userId` (from Auth/User/JWT) plus an
 * asset symbol — deliberately separate from the numeric paper-trading
 * {@link UserBalance} used by the orders engine. See the wallet module's
 * plan/README for why the two ledgers are not merged.
 *
 * Invariants (enforced by WalletLedgerService inside a locked transaction):
 *  - `available` and `reserved` are each always ≥ 0;
 *  - `available` can never go negative (reserve/debit check before mutating);
 *  - `total` is derived, never stored, so it can never drift.
 */
@Entity('wallet_ledgers')
@Index(['userId', 'asset'], { unique: true })
export class WalletLedger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ default: 'USDC' })
  asset: string;

  /** Spendable balance (not reserved against a pending withdrawal/order). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  available: number;

  /** Held against pending withdrawals (and, in future, order settlement). */
  @Column('decimal', { precision: 18, scale: 8, default: 0 })
  reserved: number;

  /** Optimistic-lock guard, layered on top of the pessimistic row lock. */
  @VersionColumn()
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Total holdings = spendable + reserved. Derived to avoid drift. */
  get total(): number {
    return Number(this.available) + Number(this.reserved);
  }
}

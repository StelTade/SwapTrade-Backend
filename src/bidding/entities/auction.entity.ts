import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AuctionStatus {
  SCHEDULED = 'scheduled',
  ACTIVE     = 'active',
  ENDING     = 'ending',   // last 60s — triggers "going once, going twice" logic
  ENDED      = 'ended',
  CANCELLED  = 'cancelled',
  SETTLED    = 'settled',
}

@Entity('auctions')
@Index(['status', 'startsAt'])
@Index(['assetId'])
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  assetId: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Reserve price — bids below this won't trigger settlement */
  @Column({ type: 'decimal', precision: 36, scale: 18, default: 0 })
  reservePrice: number;

  /** Starting / current minimum bid */
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  startingPrice: number;

  /** Minimum increment each new bid must exceed the current highest by */
  @Column({ type: 'decimal', precision: 36, scale: 18, default: 1 })
  minBidIncrement: number;

  /** Current highest bid amount (denormalised for fast reads) */
  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  currentHighestBid: number | null;

  /** User ID of the current highest bidder */
  @Column({ type: 'varchar', nullable: true })
  currentHighestBidderId: string | null;

  @Column({ type: 'enum', enum: AuctionStatus, default: AuctionStatus.SCHEDULED })
  status: AuctionStatus;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  /** Each bid in the final 30s extends the auction by this many seconds (anti-sniping) */
  @Column({ type: 'int', default: 30 })
  antiSnipingExtensionSeconds: number;

  /** How many times the auction has been extended */
  @Column({ type: 'int', default: 0 })
  extensionCount: number;

  /** Maximum number of anti-sniping extensions allowed */
  @Column({ type: 'int', default: 10 })
  maxExtensions: number;

  /** Total number of bids placed */
  @Column({ type: 'int', default: 0 })
  bidCount: number;

  /** Winning user ID (set when auction is settled) */
  @Column({ type: 'varchar', nullable: true })
  winnerId: string | null;

  /** Winning bid amount */
  @Column({ type: 'decimal', precision: 36, scale: 18, nullable: true })
  winningBid: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
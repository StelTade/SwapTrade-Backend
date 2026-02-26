import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
	Unique,
} from 'typeorm';

@Entity()
@Unique(['asset'])
export class MarketData {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ unique: true })
	asset: string;

	@Column('decimal')
	currentPrice: number;

	@Column('decimal')
	previousPrice: number;

	@Column('decimal', { default: 0 })
	priceChange24h: number;

	@Column('decimal', { default: 0 })
	volume24h: number;

	@Column('decimal', { default: 1000000 })
	marketCap: number;

	// AMM pool data
	@Column('decimal', { default: 1000000 })
	poolReserveA: number; // Base asset reserve

	@Column('decimal', { default: 1000000 })
	poolReserveB: number; // Quote asset reserve

	@Column('decimal', { default: 0.003 }) // 0.3% default fee
	feeRate: number;

	@CreateDateColumn()
	createdAt: Date;

	@UpdateDateColumn()
	updatedAt: Date;
}

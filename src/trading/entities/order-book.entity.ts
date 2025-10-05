import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	Index,
} from 'typeorm';
import { OrderType } from '../../common/enums/order-type.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Entity()
@Index(['asset', 'type', 'status'])
@Index(['asset', 'price'])
export class OrderBook {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	userId: number;

	@Column()
	asset: string;

	@Column({ type: 'enum', enum: OrderType })
	type: OrderType;

	@Column({ type: 'enum', enum: OrderStatus })
	status: OrderStatus;

	@Column('decimal')
	amount: number;

	@Column('decimal')
	price: number;

	@Column('decimal', { default: 0 })
	filledAmount: number;

	@Column('decimal', { default: 0 })
	remainingAmount: number;

	@CreateDateColumn()
	createdAt: Date;

	@Column({ nullable: true })
	executedAt?: Date;
}

import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	Index,
	ManyToOne,
	JoinColumn,
} from 'typeorm';
import { OrderType } from '../../common/enums/order-type.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { User } from '../../user/entities/user.entity';

@Entity()
@Index(['asset', 'type', 'status'])
@Index(['asset', 'price'])
@Index(['userId'])
@Index(['createdAt'])
@Index(['userId', 'status'])
@Index(['status', 'createdAt'])
export class OrderBook {
	@PrimaryGeneratedColumn()
	id: number;

	@Index()
	@Column()
	userId: number;

	@Column()
	asset: string;

	@Column({ type: 'varchar', default: 'BUY' })
	type: OrderType;

	@Column({ type: 'varchar', default: 'PENDING' })
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

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderType, OrderSide, OrderStatus } from '../enums/order.enum';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  assetPair: string;

  @Column({ type: 'enum', enum: OrderSide })
  side: OrderSide;

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  quantity: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  filledQuantity: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.OPEN })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

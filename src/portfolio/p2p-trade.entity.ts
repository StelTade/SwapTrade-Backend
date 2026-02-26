import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum P2PTradeStatus {
  CREATED = 'CREATED',       // Offer created, funds locked in escrow
  IN_PROGRESS = 'IN_PROGRESS', // Buyer accepted the offer
  PAID = 'PAID',             // Buyer marked as paid
  RELEASED = 'RELEASED',     // Seller released funds (Completed)
  DISPUTED = 'DISPUTED',     // Dispute raised
  CANCELLED = 'CANCELLED',   // Cancelled before payment or by admin
  RESOLVED = 'RESOLVED'      // Resolved by admin
}

@Entity('p2p_trade')
export class P2PTrade {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Column()
  @ApiProperty({ example: 1 })
  sellerId: number;

  @Column({ nullable: true })
  @ApiProperty({ example: 2, required: false })
  buyerId: number;

  @Column()
  @ApiProperty({ example: 'USDT' })
  asset: string;

  @Column('decimal', { precision: 18, scale: 8 })
  @ApiProperty({ example: 100.0 })
  amount: number;

  @Column('decimal', { precision: 18, scale: 8 })
  @ApiProperty({ example: 1.01 })
  price: number;

  @Column('decimal', { precision: 18, scale: 8 })
  @ApiProperty({ example: 101.0 })
  totalValue: number; // Fiat value

  @Column({
    type: 'simple-enum',
    enum: P2PTradeStatus,
    default: P2PTradeStatus.CREATED
  })
  @ApiProperty({ enum: P2PTradeStatus })
  status: P2PTradeStatus;

  @Column({ nullable: true })
  disputeReason: string;

  @Column({ nullable: true })
  disputeEvidence: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
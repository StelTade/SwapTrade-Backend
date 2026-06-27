import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('governance_votes')
@Index(['proposalId', 'voterId'], { unique: true })
export class GovernanceVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  proposalId: string;

  @Column()
  @Index()
  voterId: string;

  @Column()
  voterAddress: string;

  @Column({ type: 'varchar' })
  voteType: string;

  @Column('decimal', { precision: 18, scale: 8 })
  weight: number;

  @Column('decimal', { precision: 18, scale: 8 })
  balanceAtVote: number;

  @Column({ nullable: true })
  delegateTo: string;

  @Column()
  timestamp: Date;

  @Column('text', { nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

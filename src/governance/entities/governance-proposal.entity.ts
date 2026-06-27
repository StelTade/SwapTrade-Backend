import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('governance_proposals')
@Index(['status', 'startTime'])
@Index(['proposerId'])
export class GovernanceProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  proposerId: string;

  @Column()
  proposerAddress: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ type: 'json' })
  parameters: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  executionPayload: Record<string, any>;

  @Column({ type: 'varchar' })
  status: string;

  @Column('decimal', { precision: 18, scale: 8 })
  forVotes: number;

  @Column('decimal', { precision: 18, scale: 8 })
  againstVotes: number;

  @Column('decimal', { precision: 18, scale: 8 })
  abstainVotes: number;

  @Column('decimal', { precision: 18, scale: 8 })
  quorumVotes: number;

  @Column('decimal', { precision: 18, scale: 8 })
  totalSupply: number;

  @Column({ type: 'int' })
  votingPeriodDays: number;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column({ nullable: true })
  executedAt: Date;

  @Column({ nullable: true })
  cancellationReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('decimal', { precision: 18, scale: 8, default: 51 })
  passThresholdVotes: number;

  @Column({ nullable: true })
  executionReason: string;
}

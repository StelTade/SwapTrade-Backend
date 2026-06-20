import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('vote_delegations')
@Index(['delegatorId', 'delegateeId', 'proposalId'], { unique: true })
export class VoteDelegation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  delegatorId: string;

  @Column()
  delegatorAddress: string;

  @Column()
  @Index()
  delegateeId: string;

  @Column()
  delegateeAddress: string;

  @Column({ nullable: true })
  proposalId: string;

  @Column('decimal', { precision: 18, scale: 8 })
  delegatedBalance: number;

  @Column()
  isActive: boolean;

  @Column()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;

  @CreateDateColumn()
  createdAt: Date;
}

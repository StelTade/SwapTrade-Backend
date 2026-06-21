import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('governance_executions')
@Index(['proposalId'])
export class GovernanceExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  proposalId: string;

  @Column({ type: 'varchar' })
  executionStatus: string;

  @Column({ type: 'json' })
  executedBy: string;

  @Column({ type: 'json', nullable: true })
  transactionHash: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column()
  executedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

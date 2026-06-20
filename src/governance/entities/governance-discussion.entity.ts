import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('governance_discussions')
@Index(['proposalId', 'createdAt'])
export class GovernanceDiscussion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  proposalId: string;

  @Column()
  @Index()
  authorId: string;

  @Column()
  authorAddress: string;

  @Column({ type: 'varchar' })
  messageType: string;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

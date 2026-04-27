import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('governance_parameters')
@Index(['key'], { unique: true })
export class GovernanceParameter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 80, unique: true })
  key: string;

  @Column({ type: 'simple-json' })
  value: Record<string, unknown>;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({ type: 'int', nullable: true })
  updatedBy?: number | null;

  @Column({ type: 'uuid', nullable: true })
  lastAppliedUpdateId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('audit_log')
@Index(['userId', 'action'])
@Index(['timestamp'])
@Index(['resource', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  action: string;

  @Column()
  resource: string;

  @Column({ nullable: true })
  resourceId: string;

  @Column('simple-json', { nullable: true })
  oldValue: any;

  @Column('simple-json', { nullable: true })
  newValue: any;

  @Column('simple-json', { nullable: true })
  metadata: any;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  userAgent: string;

  @Column()
  status: string; // SUCCESS, FAILURE

  @CreateDateColumn()
  timestamp: Date;

  // Integrity fields
  @Column({ nullable: true })
  previousHash: string;

  @Column()
  hash: string;
}
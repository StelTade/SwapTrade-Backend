import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  key: string;

  @Column()
  @Index()
  ownerId: number;


  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  isBot: boolean;

  @Column({ type: 'simple-array', nullable: true })
  permissions?: string[];

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;
}


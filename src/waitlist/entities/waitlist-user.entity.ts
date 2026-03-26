import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

export enum WaitlistUserStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  INVITED = 'invited',
  EXCLUDED = 'excluded',
}

@Entity('waitlist_users')
export class WaitlistUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  referralCode: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  referredBy: string | null;

  @Column({
    type: 'enum',
    enum: WaitlistUserStatus,
    default: WaitlistUserStatus.PENDING,
  })
  status: WaitlistUserStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class Auth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  staffId: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  totpSecret?: string;

  @Column({ default: false })
  is2FAEnabled: boolean;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  smsCode?: string;

  @Column({ nullable: true, type: 'timestamp' })
  smsCodeExpiry?: Date;

  @CreateDateColumn()
  createdAt: Date;
}

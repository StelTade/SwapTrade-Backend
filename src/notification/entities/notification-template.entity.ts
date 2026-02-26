import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { NotificationChannel } from './notification.entity';

@Entity()
export class NotificationTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  key: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: NotificationChannel })
  channel: NotificationChannel;

  @Column({ nullable: true })
  subject: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: true })
  active: boolean;
}

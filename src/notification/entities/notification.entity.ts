import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  type: string;

  @Column()
  message: string;

  @Column({ type: 'varchar', default: 'UNREAD' })
  status: NotificationStatus;

  @CreateDateColumn()
  createdAt: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { NotificationType } from '../enums/notification-type.enum';

@Entity()
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  type: NotificationType;

  @Column('json')
  payload: any;

  @CreateDateColumn()
  timestamp: Date;

  @Column({ default: false })
  read: boolean;
} 
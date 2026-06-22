import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
}

@Entity('mobile_devices')
@Index(['userId'])
@Index(['fcmToken'])
export class MobileDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column({ unique: true })
  fcmToken: string;

  @Column({ type: 'varchar' })
  platform: DevicePlatform;

  @Column({ nullable: true })
  deviceModel?: string;

  @Column({ nullable: true })
  osVersion?: string;

  @Column({ nullable: true })
  appVersion?: string;

  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  lastSeenAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

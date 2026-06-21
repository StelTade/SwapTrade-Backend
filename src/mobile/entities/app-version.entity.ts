import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { DevicePlatform } from './mobile-device.entity';

@Entity('app_versions')
export class AppVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  platform: DevicePlatform;

  /** e.g. "2.1.0" */
  @Column()
  version: string;

  /** Semver-parseable minimum allowed version — lower versions are blocked */
  @Column()
  minimumVersion: string;

  @Column({ default: false })
  forceUpdate: boolean;

  @Column({ nullable: true })
  updateMessage?: string;

  @Column({ nullable: true })
  storeUrl?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

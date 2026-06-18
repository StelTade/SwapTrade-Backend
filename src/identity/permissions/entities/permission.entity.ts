import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { RoleEntity } from '../../roles/entities/role.entity';

@Entity('permissions')
@Index(['resource', 'action'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** e.g. 'users', 'accounts', 'trades', 'admin' */
  @Column()
  resource: string;

  /** e.g. 'read', 'write', 'delete', 'manage' */
  @Column()
  action: string;

  /** Computed slug: '<resource>.<action>'  e.g. 'users.read' */
  @Column({ unique: true })
  @Index()
  slug: string;

  @Column({ nullable: true })
  description: string;

  /** Whether this permission is available for assignment */
  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => RoleEntity, (role) => role.permissions)
  roles: RoleEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

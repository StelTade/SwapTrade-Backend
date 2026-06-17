import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { Permission } from '../../permissions/entities/permission.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  @Index()
  name: UserRole;

  @Column({ nullable: true })
  description: string;

  /** Priority level — higher means more privileged */
  @Column({ type: 'int', default: 0 })
  priority: number;

  /** Whether this role can be assigned to users */
  @Column({ default: true })
  isActive: boolean;

  /** Roles that this role explicitly inherits from (DB-level, mirrors ROLE_HIERARCHY) */
  @Column('simple-array', { nullable: true })
  inheritsFrom: string[];

  @ManyToMany(() => Permission, (permission) => permission.roles, {
    eager: true,
    cascade: true,
  })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

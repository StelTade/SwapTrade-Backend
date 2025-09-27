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

  @Column()
  staffId: string;

  @Column()
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}

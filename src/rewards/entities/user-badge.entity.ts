import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_badges')
export class UserBadge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  badgeName: string;

  @CreateDateColumn()
  awardedAt: Date;
}

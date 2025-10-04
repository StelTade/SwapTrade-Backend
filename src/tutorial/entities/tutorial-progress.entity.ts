import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Tutorial } from './tutorial.entity';

@Entity()
export class TutorialProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => Tutorial)
  tutorial: Tutorial;

  @Column({ default: 0 })
  currentStep: number;

  @Column({ default: false })
  isCompleted: boolean;

  @Column({ nullable: true })
  rewardClaimedAt?: Date;
}

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Tutorial {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('jsonb')
  steps: { title: string; content: string }[];

  @Column({ default: false })
  isActive: boolean;
}

import { Exclude } from 'class-transformer';
import { Portfolio } from 'src/portfolio/entities/portfolio.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('varchar', { length: 90, nullable: false })
  firstname: string;

  @Column('varchar', { length: 90, nullable: true })
  lastname: string;

  @Column('varchar', { length: 150, nullable: false, unique: true })
  email: string;

  @Exclude()
  @Column('varchar', { length: 225, nullable: true })
  password?: string;

  @OneToMany(() => Portfolio, (portfolio) => portfolio.user)
  portfolios: Portfolio[];

    @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  verificationToken: string | null ;
}


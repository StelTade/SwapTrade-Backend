import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
  } from 'typeorm';
  import { Portfolio } from '../../portfolio/entities/portfolio.entity';
  import { Cryptocurrency } from '../../cryptocurrency/entities/cryptocurrency.entity';
  
  @Entity()
  export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;
  
    @Column()
    type: 'buy' | 'sell';
  
    @Column('decimal')
    amount: number;
  
    @Column('decimal')
    price: number;
  
    @Column({ type: 'timestamp' })
    timestamp: Date;
  
    @ManyToOne(() => Portfolio, (portfolio) => portfolio.transactions)
    @JoinColumn({ name: 'portfolio_id' })
    portfolio: Portfolio;
  
    @ManyToOne(() => Cryptocurrency, (crypto) => crypto.transactions)
    @JoinColumn({ name: 'cryptocurrency_id' })
    cryptocurrency: Cryptocurrency;
  }
  
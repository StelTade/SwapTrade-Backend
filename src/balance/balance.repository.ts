import { EntityRepository, Repository } from 'typeorm';
import { Balance } from './balance.entity';

@EntityRepository(Balance)
export class BalanceRepository extends Repository<Balance> {}

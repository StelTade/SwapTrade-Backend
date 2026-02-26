import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchingEngine } from './core/matching-engine';
import { OrderPriorityService } from './services/order-priority.service';
import { OrderValidatorService } from './services/order-validator.service';
import { MatchingWorkerPoolService } from './services/matching-worker-pool.service';
import { AdvancedMatchingService } from './advanced-matching.service';
import { MatchingEngineController } from './matching-engine.controller';
import { Trade } from '../entities/trade.entity';
import { OrderBook } from '../entities/order-book.entity';
import { Balance } from '../../balance/balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trade, OrderBook, Balance]),
  ],
  controllers: [MatchingEngineController],
  providers: [
    MatchingEngine,
    OrderPriorityService,
    OrderValidatorService,
    MatchingWorkerPoolService,
    AdvancedMatchingService,
  ],
  exports: [
    AdvancedMatchingService,
    MatchingEngine,
  ],
})
export class MatchingEngineModule {}

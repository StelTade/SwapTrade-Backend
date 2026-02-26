// Core
export { MatchingEngine } from './core/matching-engine';
export { OrderBook } from './core/order-book';
export { OrderBookLevel } from './core/order-book-level';

// Services
export { AdvancedMatchingService } from './advanced-matching.service';
export { OrderPriorityService } from './services/order-priority.service';
export { OrderValidatorService } from './services/order-validator.service';
export { MatchingWorkerPoolService } from './services/matching-worker-pool.service';

// Types
export {
  Order,
  OrderType,
  OrderSide,
  OrderStatus,
  TimeInForce,
  MatchResult,
  MatchingStats,
} from './types/order.types';

// Module
export { MatchingEngineModule } from './matching-engine.module';

// Controller
export { MatchingEngineController, SubmitOrderDto } from './matching-engine.controller';

# Circular Dependencies Resolution Strategy

**Generated:** 2026-06-15  
**Phase:** 0 - Governance  
**Task:** 2 - Circular Dependency Resolution  
**Status:** Ready for Phase 1B Implementation

---

## Executive Summary

11 circular dependencies have been identified across the codebase. These create tight coupling, reduce modularity, and complicate testing and future refactoring. This document proposes resolution strategies using proven NestJS patterns (event-driven, query/command patterns, dependency injection via modules).

**Priority:** HIGH - Circular dependencies must be resolved before Phase 1 architecture enforcement

---

## Cycle Analysis & Resolution Strategies

### Cycle 1: `user → balance → trading → user`

**Impact:** CRITICAL - Core domain cycle affecting 3 major modules  
**Root Cause:** 
- `user` module needs `balance` status in user profile
- `balance` needs `trading` history to calculate balances  
- `trading` imports user to validate traders

**Resolution Strategy: Event-Driven Pattern**

```typescript
// Instead of direct imports, use events

// 1. In user/events/user-balance-updated.event.ts
export class UserBalanceUpdatedEvent {
  constructor(
    public userId: string,
    public balances: { [currency: string]: number },
    public timestamp: Date,
  ) {}
}

// 2. In balance/balance.service.ts - EMIT event, don't import user
import { EventEmitter2 } from '@nestjs/event-emitter';

export class BalanceService {
  constructor(private eventEmitter: EventEmitter2) {}
  
  async updateBalance(userId: string, amount: number) {
    // Update balance logic
    this.eventEmitter.emit(
      'balance.updated',
      new UserBalanceUpdatedEvent(userId, balances, new Date()),
    );
  }
}

// 3. In user/user.service.ts - LISTEN to events, don't import balance
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class UserService {
  @OnEvent('balance.updated')
  handleBalanceUpdate(event: UserBalanceUpdatedEvent) {
    // Update user profile with new balance data
  }
}

// 4. In trading/trading.service.ts - Inject UserService via module, don't import directly
// This is allowed - modules can depend on services through proper DI
```

**Breaking the Cycle:**
- Remove direct import of `user` from `trading`
- Use `@Inject()` token-based dependency injection instead
- Or pass required user data as parameters rather than importing service

**Timeline:** 1-2 days  
**Responsible Party:** Core Domain Team  
**Deliverable:** `docs/implementations/cycle-1-resolution.md`

---

### Cycle 2: `balance → trading → balance`

**Impact:** HIGH - Direct tight coupling between 2 critical modules  
**Root Cause:**
- `balance` module imports `trading` for balance calculations tied to orders
- `trading` imports `balance` to update balances on order completion

**Resolution Strategy: Shared Query Pattern with Saga Pattern**

```typescript
// 1. Create shared query interface (in shared/interfaces/)
export interface IBalanceQuery {
  getBalance(userId: string, currency: string): Promise<Decimal>;
  getAvailableBalance(userId: string): Promise<Decimal>;
}

// 2. In balance/balance.module.ts - provide query interface
@Module({
  providers: [
    BalanceService,
    {
      provide: 'IBalanceQuery',
      useClass: BalanceService,
    },
  ],
  exports: ['IBalanceQuery'],
})
export class BalanceModule {}

// 3. In trading/trading.service.ts - Inject interface, not service
@Injectable()
export class TradingService {
  constructor(@Inject('IBalanceQuery') private balanceQuery: IBalanceQuery) {}
  
  async executeOrder(order: Order) {
    const balance = await this.balanceQuery.getBalance(
      order.userId,
      order.currency,
    );
    // Use balance data without circular dependency
  }
}

// 4. For updates - use Saga pattern with event messaging
// trading.saga.ts
@Injectable()
export class TradingSaga {
  @OnEvent('trading.order-completed')
  async handleOrderCompleted(event: OrderCompletedEvent) {
    // Emit balance update event
    this.eventEmitter.emit('balance.update-required', {
      userId: event.userId,
      delta: event.balanceDelta,
    });
  }
}
```

**Breaking the Cycle:**
- Use dependency injection of interfaces instead of concrete services
- Move bidirectional updates to event-driven saga pattern
- Keep balance service as source of truth, trading as consumer

**Timeline:** 1-2 days  
**Responsible Party:** Core Domain Team  
**Deliverable:** `docs/implementations/cycle-2-resolution.md`

---

### Cycle 3: `user → balance → trading → portfolio → user`

**Impact:** HIGH - Extended cycle involving 4 modules  
**Root Cause:** Portfolio module imports user profile data, which triggers the cycle from Cycles 1-2

**Resolution Strategy: CQRS (Command Query Responsibility Segregation)

```typescript
// 1. Create read model in shared/queries/
export interface UserReadModel {
  id: string;
  profile: UserProfile;
  currentBalances: Record<string, Decimal>;
  portfolioValue: Decimal;
  trades: Trade[];
}

// 2. In portfolio/portfolio.service.ts - query read model instead of importing user
@Injectable()
export class PortfolioService {
  constructor(
    @Inject('UserReadModel') private userReadModel: UserReadModelService,
  ) {}
  
  async getPortfolio(userId: string): Promise<Portfolio> {
    const user = await this.userReadModel.getUser(userId);
    // Work with read model snapshot, not live imports
  }
}

// 3. Maintain read model via event handlers
@Injectable()
export class UserReadModelHandler {
  constructor(private userReadModel: UserReadModelService) {}
  
  @OnEvent('user.updated')
  async handleUserUpdated(event: UserUpdatedEvent) {
    await this.userReadModel.update(event.userId, event.data);
  }
  
  @OnEvent('balance.updated')
  async handleBalanceUpdated(event: BalanceUpdatedEvent) {
    await this.userReadModel.updateBalance(event.userId, event.balance);
  }
}
```

**Breaking the Cycle:**
- Separate read model from domain models
- Portfolio queries read model instead of importing user/balance
- Events maintain read model consistency
- No circular dependencies between domain modules

**Timeline:** 2-3 days  
**Responsible Party:** Core Domain Team + Infrastructure Team  
**Deliverable:** `docs/implementations/cycle-3-resolution.md`

---

### Cycle 4: `balance → trading → portfolio → balance`

**Impact:** HIGH - Multiple bidirectional dependencies  
**Root Cause:** Balance recalculations depend on trading history and portfolio composition

**Resolution Strategy: Domain Events with Eventual Consistency

```typescript
// 1. Define domain events (shared/events/)
export class BalanceRecalculationRequestedEvent {
  constructor(
    public userId: string,
    public source: 'trading' | 'portfolio' | 'manual',
  ) {}
}

// 2. In balance/balance.service.ts - respond to events
@Injectable()
export class BalanceService {
  @OnEvent('balance.recalculation-requested')
  async handleRecalculation(event: BalanceRecalculationRequestedEvent) {
    // Recalculate balance based on current trading and portfolio state
    const totalValue = await this.calculateTotalValue(event.userId);
    // Emit updated event, don't import trading/portfolio
    this.eventEmitter.emit('balance.recalculated', {
      userId: event.userId,
      value: totalValue,
    });
  }
  
  private async calculateTotalValue(userId: string): Promise<Decimal> {
    // Use read model or queries, not imports
    const trades = await this.tradingQueryService.getUserTrades(userId);
    const portfolio = await this.portfolioQueryService.getPortfolio(userId);
    return this.computeTotal(trades, portfolio);
  }
}

// 3. In trading/trading.service.ts - trigger but don't wait
async executeOrder(order: Order) {
  // Execute order logic
  // Request balance recalculation but don't depend on it
  this.eventEmitter.emit('balance.recalculation-requested', {
    userId: order.userId,
    source: 'trading',
  });
}
```

**Breaking the Cycle:**
- Use event-driven async pattern for balance updates
- Services emit events but don't wait for responses
- Balance service becomes autonomous, triggered by events
- Trading/Portfolio don't import Balance, only trigger events

**Timeline:** 2-3 days  
**Responsible Party:** Core Domain Team  
**Deliverable:** `docs/implementations/cycle-4-resolution.md`

---

### Cycle 5: `trading → portfolio → trading`

**Impact:** MEDIUM - Analytics cycle involving portfolio optimization and trading decisions

**Root Cause:**
- `trading` uses portfolio composition to optimize orders
- `portfolio` imports trading history for rebalancing

**Resolution Strategy: Strategy Pattern + Dependency Injection

```typescript
// 1. Define strategy interface (shared/interfaces/)
export interface IPortfolioOptimizationStrategy {
  optimize(trades: Trade[], portfolio: Portfolio): OptimizationResult;
}

// 2. In portfolio/strategies/
export class TradingHistoryOptimizer implements IPortfolioOptimizationStrategy {
  constructor(private tradingDataProvider: ITradingDataProvider) {}
  
  async optimize(portfolio: Portfolio): Promise<OptimizationResult> {
    const trades = await this.tradingDataProvider.getRecent(portfolio.userId);
    // Optimize using trades without importing trading module
  }
}

// 3. In trading/trading.service.ts - inject strategy
@Injectable()
export class TradingService {
  constructor(
    @Inject('IPortfolioOptimizationStrategy') 
    private optimizer: IPortfolioOptimizationStrategy,
  ) {}
  
  async executeOrder(order: Order) {
    const result = await this.optimizer.optimize(order.portfolio);
    // Use optimization result
  }
}

// 4. In portfolio/portfolio.module.ts - provide strategy
@Module({
  providers: [
    {
      provide: 'IPortfolioOptimizationStrategy',
      useClass: TradingHistoryOptimizer,
    },
  ],
  exports: ['IPortfolioOptimizationStrategy'],
})
export class PortfolioModule {}
```

**Breaking the Cycle:**
- Define contracts (interfaces) in shared layer
- Portfolio provides optimizer implementation
- Trading injects optimizer, no direct import
- Bidirectional dependency becomes unidirectional via DI

**Timeline:** 1-2 days  
**Responsible Party:** Portfolio & Trading Teams  
**Deliverable:** `docs/implementations/cycle-5-resolution.md`

---

### Cycle 6: `portfolio → risk → portfolio`

**Impact:** MEDIUM - Risk assessment cycle

**Root Cause:**
- `portfolio` needs risk assessment from `risk` module
- `risk` module imports portfolio to calculate risk metrics

**Resolution Strategy: Decorator Pattern

```typescript
// 1. Define risk assessment interface (shared/interfaces/)
export interface IRiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactor[];
}

// 2. In risk/risk.service.ts - expose as provider
@Injectable()
export class RiskService {
  async assessPortfolioRisk(portfolioSnapshot: PortfolioData): Promise<IRiskAssessment> {
    // Takes data as parameter, doesn't import portfolio module
  }
}

// 3. In portfolio/portfolio.service.ts - inject risk service
@Injectable()
export class PortfolioService {
  constructor(private riskService: RiskService) {}
  
  async getPortfolioWithRisk(userId: string) {
    const portfolio = await this.getPortfolio(userId);
    const risk = await this.riskService.assessPortfolioRisk({
      assets: portfolio.assets,
      positions: portfolio.positions,
    });
    return { ...portfolio, riskAssessment: risk };
  }
}

// 4. In portfolio/portfolio.module.ts - import RiskModule
@Module({
  imports: [RiskModule], // One-directional dependency
  providers: [PortfolioService],
})
export class PortfolioModule {}
```

**Breaking the Cycle:**
- Risk service takes data as parameters, not imports
- Portfolio imports Risk (one direction only)
- Risk module has no knowledge of Portfolio
- Prevents bidirectional coupling

**Timeline:** 1 day  
**Responsible Party:** Risk & Portfolio Teams  
**Deliverable:** `docs/implementations/cycle-6-resolution.md`

---

### Cycle 7: `trading → portfolio → risk → trading`

**Impact:** MEDIUM - Extended cycle involving 3 modules

**Root Cause:** Trading uses risk assessment from risk module, which uses portfolio data

**Resolution Strategy: Observer Pattern + Event Bus

```typescript
// 1. Create risk assessment request event
export class RiskAssessmentRequestedEvent {
  constructor(
    public portfolioId: string,
    public portfolioData: PortfolioSnapshot,
    public requestedBy: string,
  ) {}
}

export class RiskAssessmentCompletedEvent {
  constructor(
    public portfolioId: string,
    public assessment: IRiskAssessment,
  ) {}
}

// 2. In risk/risk.service.ts - respond to events
@OnEvent('risk.assessment-requested')
async handleRiskAssessment(event: RiskAssessmentRequestedEvent) {
  const assessment = await this.assess(event.portfolioData);
  this.eventEmitter.emit('risk.assessment-completed', 
    new RiskAssessmentCompletedEvent(event.portfolioId, assessment),
  );
}

// 3. In trading/trading.service.ts - request risk assessment
async executeOrder(order: Order) {
  this.eventEmitter.emit('risk.assessment-requested', 
    new RiskAssessmentRequestedEvent(order.portfolioId, portfolioData, 'trading'),
  );
  // Continue without waiting for risk response (async)
}

// 4. Subscribe to risk assessment results
@OnEvent('risk.assessment-completed')
async handleRiskAssessment(event: RiskAssessmentCompletedEvent) {
  // React to risk assessment if needed, don't import risk module
}
```

**Breaking the Cycle:**
- All communication via event bus, no direct imports
- Trading requests risk assessment via events
- Risk responds via events
- Portfolio provides data but doesn't know about trading/risk

**Timeline:** 2 days  
**Responsible Party:** Risk & Trading Teams  
**Deliverable:** `docs/implementations/cycle-7-resolution.md`

---

### Cycle 8: `user → balance → trading → rewards → user`

**Impact:** MEDIUM - Rewards cycle affecting user profile

**Root Cause:**
- `user` module tracks reward balance
- `rewards` module imports user for reward allocation
- Cycle extends through trading

**Resolution Strategy: Event Sourcing Pattern

```typescript
// 1. Define reward events
export class RewardEarnedEvent {
  constructor(
    public userId: string,
    public amount: Decimal,
    public source: 'trading' | 'referral' | 'loyalty',
    public timestamp: Date,
  ) {}
}

// 2. In rewards/rewards.service.ts - emit events
@Injectable()
export class RewardsService {
  async allocateReward(userId: string, amount: Decimal, source: string) {
    // Calculate and allocate reward
    this.eventEmitter.emit(
      'reward.earned',
      new RewardEarnedEvent(userId, amount, source as any, new Date()),
    );
  }
}

// 3. In user/user.service.ts - subscribe to reward events
@OnEvent('reward.earned')
async handleRewardEarned(event: RewardEarnedEvent) {
  await this.updateUserRewardBalance(event.userId, event.amount);
}

// 4. Remove user imports from rewards module
// rewards/rewards.module.ts doesn't import UserModule
```

**Breaking the Cycle:**
- Rewards module emits events instead of importing user
- User service listens to reward events
- No circular dependency through trading

**Timeline:** 1-2 days  
**Responsible Party:** Rewards & User Teams  
**Deliverable:** `docs/implementations/cycle-8-resolution.md`

---

### Cycle 9: `balance → trading → rewards → balance`

**Impact:** MEDIUM - Balance update cycle through rewards

**Root Cause:** Similar to Cycle 8 but affecting balance instead of user profile

**Resolution Strategy: Aggregate Root Pattern

```typescript
// 1. Design balance as aggregate root
@Entity()
export class BalanceAggregate {
  @PrimaryColumn()
  userId: string;

  @Column()
  amount: Decimal;

  @Column()
  version: number;

  // Domain events
  private domainEvents: DomainEvent[] = [];

  // When rewards are added, emit event but don't import rewards module
  addReward(amount: Decimal) {
    this.amount = this.amount.plus(amount);
    this.domainEvents.push(
      new RewardAddedToBalanceEvent(this.userId, amount),
    );
  }

  // When order completes, update balance
  completeOrder(orderValue: Decimal) {
    this.amount = this.amount.minus(orderValue);
    this.domainEvents.push(
      new OrderCompletedEvent(this.userId, orderValue),
    );
  }

  getDomainEvents() {
    return this.domainEvents;
  }

  clearDomainEvents() {
    this.domainEvents = [];
  }
}

// 2. In balance/balance.service.ts - manage aggregate
@Injectable()
export class BalanceService {
  async updateFromReward(userId: string, amount: Decimal) {
    const balance = await this.repository.find(userId);
    balance.addReward(amount);
    await this.repository.save(balance);
    // Publish domain events
    this.publishEvents(balance.getDomainEvents());
  }
}
```

**Breaking the Cycle:**
- Balance is autonomous aggregate root
- Doesn't need to import trading or rewards
- Events trigger external reactions
- Trading and rewards can subscribe to balance events

**Timeline:** 2 days  
**Responsible Party:** Core Domain Team  
**Deliverable:** `docs/implementations/cycle-9-resolution.md`

---

### Cycle 10: `user → balance → user`

**Impact:** LOW - Simple bidirectional dependency

**Root Cause:**
- `user` module displays balance information
- `balance` imports user for user validation

**Resolution Strategy: Dependency Injection + Interface Segregation

```typescript
// 1. Create minimal user interface for balance module
// shared/interfaces/user.interface.ts
export interface IUserIdentity {
  id: string;
  email: string;
  status: 'active' | 'inactive';
}

// 2. In balance/balance.service.ts - use interface not full UserService
@Injectable()
export class BalanceService {
  constructor(@Inject('IUserIdentity') private userIdentity: IUserIdentity) {}
}

// 3. In user/user.module.ts - provide interface implementation
@Module({
  providers: [
    UserService,
    {
      provide: 'IUserIdentity',
      useClass: UserService,
    },
  ],
  exports: ['IUserIdentity'],
})
export class UserModule {}

// 4. In user/user.service.ts - subscribe to balance events
@OnEvent('balance.updated')
async handleBalanceUpdated(event: BalanceUpdatedEvent) {
  // Update user profile cache or view model
}
```

**Breaking the Cycle:**
- User provides minimal interface to balance
- Balance only sees IUserIdentity, not full UserService
- User listens to balance events for updates
- Clean separation of concerns

**Timeline:** < 1 day  
**Responsible Party:** User Team  
**Deliverable:** `docs/implementations/cycle-10-resolution.md`

---

### Cycle 11: `queue → swap → queue`

**Impact:** MEDIUM - Settlement/order execution cycle

**Root Cause:**
- `queue` module manages job scheduling for swaps
- `swap` module imports queue to schedule settlement jobs
- Creates circular dependency

**Resolution Strategy: Abstract Factory Pattern + Module Exports

```typescript
// 1. Define queue interface (shared/interfaces/)
export interface IQueueService {
  enqueue(jobName: string, data: any, options?: any): Promise<string>;
  subscribe(jobName: string, handler: (data: any) => Promise<void>): void;
}

// 2. In queue/queue.module.ts - export interface and factory
@Module({
  providers: [
    QueueService,
    {
      provide: 'IQueueService',
      useClass: QueueService,
    },
  ],
  exports: ['IQueueService'],
})
export class QueueModule {}

// 3. In swap/swap.service.ts - inject interface
@Injectable()
export class SwapService {
  constructor(@Inject('IQueueService') private queue: IQueueService) {}
  
  async executeSwap(swap: Swap) {
    // Execute swap logic
    await this.queue.enqueue('settlement', {
      swapId: swap.id,
      status: 'pending',
    });
  }
}

// 4. In queue/processors/ - process swap jobs
@Processor('settlement')
export class SettlementProcessor {
  constructor(private swapService: SwapService) {} // OK - processor imports swap
  
  @Process()
  async process(job: Job<any>) {
    // Process settlement, can import swap here
  }
}

// 5. queue.module.ts doesn't import swap, only exports interface
// swap.module.ts imports QueueModule and uses injected interface
```

**Breaking the Cycle:**
- Queue exposes interface, not concrete service
- Swap injects interface and uses it
- Processors in queue module can import swap (one direction)
- No circular dependency

**Timeline:** 1-2 days  
**Responsible Party:** Queue & Swap Teams  
**Deliverable:** `docs/implementations/cycle-11-resolution.md`

---

## Implementation Roadmap

### Phase 1A: Foundation (Weeks 1-2)

1. **Event Infrastructure Setup**
   - Set up NestJS EventEmitter2 globally
   - Define shared event interfaces and types
   - Create event registry for type safety

2. **Cycle 10 Resolution** (simplest)
   - Implement user/balance interface segregation
   - Validate no regressions in tests

3. **Cycle 6 Resolution**
   - Implement decorator pattern for portfolio/risk
   - Add risk assessment integration tests

### Phase 1B: Core Domain (Weeks 3-4)

4. **Cycles 1 & 2 Resolution**
   - Implement event-driven user/balance/trading separation
   - Create saga orchestration pattern
   - Add integration tests

5. **Cycles 8 & 9 Resolution**
   - Implement reward event sourcing
   - Update balance aggregate
   - Add event handlers

### Phase 1C: Advanced Patterns (Weeks 5-6)

6. **Cycles 3, 4, 7 Resolution**
   - Implement CQRS read models
   - Set up event sourcing for complex domains
   - Add observability/monitoring

7. **Cycles 5 & 11 Resolution**
   - Implement strategy pattern
   - Abstract factory for queue operations
   - Final integration testing

### Phase 1D: Validation (Week 7)

8. **Comprehensive Testing**
   - Unit tests for each resolution
   - Integration tests across modules
   - Performance validation
   - Run dependency analysis tool to verify cycles resolved

---

## Success Criteria

- [ ] All 11 cycles documented with resolution strategies
- [ ] Zero circular dependencies in dependency analysis
- [ ] 100% of ESLint boundary rules passing
- [ ] All TypeScript compilation errors resolved
- [ ] 90%+ unit test coverage maintained
- [ ] No breaking changes to public APIs
- [ ] All teams trained on new patterns
- [ ] CI/CD pipeline validates architecture on every commit

---

## Risks & Mitigation

| Risk | Probability | Mitigation |
|------|-------------|-----------|
| Event-driven pattern complexity | Medium | Comprehensive training + pair programming |
| Performance regression from async | Low | Load testing + optimization during Phase 1C |
| Breaking changes to APIs | Low | Deprecation period + backwards compatibility layer |
| Team skill gaps | Medium | Spike stories + documentation + workshops |

---

## Next Steps

1. ✅ Complete Phase 0 Task 2: This document (CIRCULAR_DEPENDENCIES_RESOLUTION.md)
2. ⏳ Phase 0 Task 3: MODULE_CLARIFICATION.md - Clarify ambiguous modules
3. ⏳ Phase 0 Task 4: MODULE_OWNERSHIP.md - Assign team ownership
4. ⏳ Phase 0 Tasks 5-8: Complete governance setup
5. ▶️ Phase 1A: Begin cycle resolution starting with Cycles 10 & 6

---

**References:**
- [ADR-001: Domain-Driven Design Adoption](ADR-001-domain-driven-design-adoption.md)
- [ADR-003: Dependency Hierarchy](ADR-003-dependency-hierarchy.md)
- [PHASE_0_GOVERNANCE.md](PHASE_0_GOVERNANCE.md)

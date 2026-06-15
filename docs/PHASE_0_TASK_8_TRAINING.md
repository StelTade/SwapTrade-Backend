# Phase 0 Task 8: Team Training & Sign-Offs

**Generated:** 2026-06-15  
**Phase:** 0 - Governance  
**Task:** 8 - Team Training & Sign-Offs  
**Status:** Ready for Rollout

---

## Overview

This document provides:
1. Training materials for all teams
2. Quick reference guides for developers
3. Sign-off tracking for governance approval

---

## Training Module 1: Architecture Overview (30 min)

### What is DDD (Domain-Driven Design)?

Domain-Driven Design is an approach to architecture that organizes code around business domains rather than technical concerns.

**Before (Current State):**
```
src/
  auth/              # Authentication
  trading/          # Trading engine
  insurance/        # Insurance features
  database/         # Database layer
  config/           # Configuration
  ... 50+ modules
```

**After (Target State):**
```
src/
  shared/           # Level 0: Shared types, enums, constants
  infrastructure/   # Level 1: Infrastructure services
  identity/         # Level 2: Authentication & Identity
  accounts/         # Level 3: Business - Accounts
  market/           # Level 4: Business - Market
  ... 11 levels total
```

### 11-Level Hierarchy

```
Level 0: SHARED
├─ Types, Enums, Interfaces, Constants, Utilities
└─ CAN be imported by: All levels

Level 1: INFRASTRUCTURE
├─ config, database, cache, queue, websocket, graphql
├─ events, logging, monitoring, scheduler, rate-limiter
├─ audit-log, security, api-gateway, edge-computing
└─ CAN import: Only from shared or infrastructure
└─ CANNOT import: From identity or business domains

Level 2: IDENTITY
├─ auth, user, kyc, compliance, privacy, admin, did
├─ roles, permissions, quantum-crypto
└─ CAN import: From shared, infrastructure, or identity
└─ CANNOT import: From business domains

Levels 3-11: BUSINESS DOMAINS
├─ accounts (Level 3)
├─ market (Level 4)
├─ exchange (Level 5)
├─ protection (Level 6)
├─ settlement (Level 7)
├─ blockchain (Level 8)
├─ communications (Level 9)
├─ analytics (Level 10)
├─ intelligence (Level 11)
└─ CAN import: From all lower levels
└─ CANNOT import: From higher business levels (except same level)
```

### Why This Matters

**Problem with current flat structure:**
- Tight coupling between modules
- 11 circular dependencies
- Hard to test in isolation
- Difficult to scale independent teams
- Confusing ownership

**Benefits of DDD:**
- Clear separation of concerns
- Independent module teams
- Easier testing and debugging
- Clear dependency flow
- Scalable architecture

---

## Training Module 2: The 4 Architecture Decision Records (45 min)

### ADR-001: Domain-Driven Design Adoption

**What:** We're adopting DDD with 11-level hierarchy  
**When:** Phase 1 (after Phase 0 completes)  
**How:** Gradual refactoring, module by module

**Your Action:** Understand which level your modules belong to

---

### ADR-002: Infrastructure Isolation

**Rule:** Infrastructure modules CANNOT import from Identity or Business

**Examples:**

✅ CORRECT:
```typescript
// infrastructure/database/database.module.ts
import { CacheModule } from '../cache/cache.module'; // ✓ Other infrastructure
import { LoggingModule } from '../logging/logging.module'; // ✓ Other infrastructure
```

❌ INCORRECT:
```typescript
// infrastructure/database/database.module.ts
import { TradeService } from '../../trading/trade.service'; // ✗ Business!
import { AuthService } from '../../identity/auth/auth.service'; // ✗ Identity!
```

**Your Action:** If in infrastructure team, ensure your modules only import from infrastructure or shared

---

### ADR-003: Dependency Hierarchy

**The Rule:** Dependencies must follow the hierarchy - never import from higher levels

```
Higher (More Specific)
        ▲
        │
    Business Domains ← Can import from anything below
        ▲
        │
    Identity ← Can import from shared + infrastructure
        ▲
        │
    Infrastructure ← Can import from shared + infrastructure
        ▲
        │
    Shared ← Can only import from shared
        │
        └─ Nothing imports shared
```

**ESLint Enforcement:**
- Boundary rules prevent importing across levels
- CI/CD validates on every PR
- Build fails if rules violated

**Your Action:** Run ESLint before committing: `npm run lint`

---

### ADR-004: Shared Layer Guidelines

**What Goes in shared/:**
- ✅ Types: `shared/types/user.interface.ts`
- ✅ Enums: `shared/enums/status.enum.ts`
- ✅ Interfaces: `shared/interfaces/service.interface.ts`
- ✅ Constants: `shared/constants/limits.const.ts`
- ✅ Utilities: `shared/utils/format.util.ts`

**What DOESN'T go in shared/:**
- ❌ Services: Don't put business logic here
- ❌ Repositories: Database access doesn't belong
- ❌ Controllers: HTTP handling is not shared
- ❌ Guards: Authorization logic is specific

**Your Action:** Before adding to shared, ask: "Is this reused by 3+ modules?" and "Is it just a type/constant/utility?"

---

## Training Module 3: Working with the New Architecture (60 min)

### Pattern 1: Event-Driven Communication (Breaking Circular Dependencies)

**Problem:** Module A needs Module B, Module B needs Module A = Circular dependency

**Solution:** Use events instead

**Before (WRONG):**
```typescript
// balance/balance.service.ts
import { TradingService } from '../trading/trading.service';

export class BalanceService {
  constructor(private tradingService: TradingService) {}
  
  async getBalance(userId: string) {
    const trades = this.tradingService.getUserTrades(userId); // Direct import!
    return this.calculateBalance(trades);
  }
}

// trading/trading.service.ts
import { BalanceService } from '../balance/balance.service'; // Circular!

export class TradingService {
  constructor(private balanceService: BalanceService) {}
}
```

**After (CORRECT):**
```typescript
// balance/events/balance-updated.event.ts
export class BalanceUpdatedEvent {
  constructor(public userId: string, public newBalance: Decimal) {}
}

// balance/balance.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

export class BalanceService {
  constructor(private eventEmitter: EventEmitter2) {}
  
  async updateBalance(userId: string, delta: Decimal) {
    // Update balance
    const newBalance = await this.calculateNewBalance(userId, delta);
    
    // EMIT event instead of importing
    this.eventEmitter.emit('balance.updated', 
      new BalanceUpdatedEvent(userId, newBalance)
    );
  }
}

// trading/trading.service.ts
import { OnEvent } from '@nestjs/event-emitter';

export class TradingService {
  @OnEvent('balance.updated')
  async handleBalanceUpdated(event: BalanceUpdatedEvent) {
    // React to balance change, no import needed!
  }
}
```

**Your Action:** When you find a circular dependency, think "events" not "imports"

---

### Pattern 2: Dependency Injection via Interfaces

**Problem:** Module A needs specific method from Module B

**Solution:** Inject interface, not concrete service

**Before (WRONG):**
```typescript
// portfolio/portfolio.service.ts
import { RiskService } from '../risk/risk.service'; // Tight coupling!

export class PortfolioService {
  constructor(private riskService: RiskService) {}
}
```

**After (CORRECT):**
```typescript
// shared/interfaces/risk-assessment.interface.ts
export interface IRiskAssessment {
  assessPortfolioRisk(portfolio: Portfolio): Promise<RiskScore>;
}

// portfolio/portfolio.service.ts
export class PortfolioService {
  constructor(@Inject('IRiskAssessment') private risk: IRiskAssessment) {}
}

// risk/risk.module.ts
@Module({
  providers: [
    RiskService,
    {
      provide: 'IRiskAssessment',
      useClass: RiskService,
    },
  ],
  exports: ['IRiskAssessment'],
})
export class RiskModule {}
```

**Your Action:** For cross-module dependencies, define interfaces in shared/ and inject them

---

### Pattern 3: Data Transfer Objects (DTOs)

**Problem:** Sharing domain models between modules couples them

**Solution:** Use DTOs for cross-module communication

**Before (WRONG):**
```typescript
// trading/entities/trade.entity.ts
export class Trade {
  id: string;
  userId: string;
  // ... 20 properties
}

// portfolio/portfolio.service.ts
import { Trade } from '../trading/entities/trade.entity'; // Coupling!

export class PortfolioService {
  async calculateValue(trades: Trade[]) {
    // Use trades
  }
}
```

**After (CORRECT):**
```typescript
// shared/dto/trade-snapshot.dto.ts
export class TradeSnapshotDto {
  id: string;
  userId: string;
  // Only public properties needed for cross-module
}

// trading/trading.service.ts
async getUserTrades(userId: string): Promise<TradeSnapshotDto[]> {
  const trades = await this.tradeRepository.find(userId);
  return trades.map(t => ({
    id: t.id,
    userId: t.userId,
    // Map only needed fields
  }));
}

// portfolio/portfolio.service.ts
import { TradeSnapshotDto } from '../../shared/dto/trade-snapshot.dto';

async calculateValue(trades: TradeSnapshotDto[]) {
  // Use snapshot, not full entity
}
```

**Your Action:** For cross-module communication, use DTOs not entities

---

## Developer Quick Reference

### Pre-Commit Checklist

- [ ] `npm run lint` passes (no ESLint errors)
- [ ] `npm run build` succeeds (TypeScript compiles)
- [ ] `npm run test` passes (unit tests green)
- [ ] Check imports don't violate hierarchy (use boundary rules)
- [ ] No circular imports within module
- [ ] Shared layer only has types/enums/interfaces/constants

### Common ESLint Errors & Fixes

**Error:** `Module ./X cannot import from ./Y`  
**Cause:** Importing from higher level in hierarchy  
**Fix:** Use dependency injection or events instead

**Error:** `Shared module contains business logic`  
**Cause:** Put service/repository in shared/  
**Fix:** Move to appropriate domain module

**Error:** `Circular dependency detected`  
**Cause:** Module A imports B, B imports A  
**Fix:** Use event-driven pattern or extract common code to shared/

### Commands Reference

```bash
# Check architecture compliance
npm run lint

# Run dependency analysis
node tools/analyze-simple.js

# Build and compile
npm run build

# Run tests
npm run test

# Watch mode during development
npm run start:dev
```

---

## Team Sign-Off Tracking

### Infrastructure Team

**Responsibility:**
- Maintain isolation rules for infrastructure modules
- Ensure no infrastructure module imports from business/identity
- Support other teams with infrastructure patterns

**Training Checklist:**
- [ ] Understand ADR-002 (Infrastructure Isolation)
- [ ] Can identify violations in code review
- [ ] Can guide teams on infrastructure usage
- [ ] Committed to zero violations in PRs

**Sign-Off:** _________________________ (Infrastructure Lead)  
**Date:** _______________

---

### Auth/Security Team

**Responsibility:**
- Maintain identity module boundaries
- Ensure proper authentication flow
- Support teams with auth integration

**Training Checklist:**
- [ ] Understand identity module placement (Level 2)
- [ ] Can identify unauthorized imports
- [ ] Know how other modules should consume auth
- [ ] Can guide on encryption and security patterns

**Sign-Off:** _________________________ (Auth Lead)  
**Date:** _______________

---

### Trading/Exchange Team

**Responsibility:**
- Organize trading and market data modules
- Work with circular dependency resolutions
- Support integration patterns

**Training Checklist:**
- [ ] Understand domain organization
- [ ] Know circular dependency patterns (Cycles 1, 2, 5)
- [ ] Can work with event-driven pattern
- [ ] Can implement saga patterns for settlements

**Sign-Off:** _________________________ (Trading Lead)  
**Date:** _______________

---

### Product/Platform Team

**Responsibility:**
- Maintain business domain module boundaries
- Ensure consistent API design across domains
- Support cross-domain integrations

**Training Checklist:**
- [ ] Understand 11-level hierarchy
- [ ] Know dependency hierarchy rules
- [ ] Can identify cross-domain violations
- [ ] Know how to structure new features

**Sign-Off:** _________________________ (Product Lead)  
**Date:** _______________

---

### Finance/Risk Team

**Responsibility:**
- Maintain financial domain integrity
- Ensure proper data isolation for sensitive operations
- Support compliance requirements

**Training Checklist:**
- [ ] Understand risk module placement
- [ ] Know financial domain dependencies
- [ ] Can identify compliance violations
- [ ] Know pattern for balance updates

**Sign-Off:** _________________________ (Finance Lead)  
**Date:** _______________

---

### DevOps/Platform Team

**Responsibility:**
- Set up and maintain CI/CD architecture checks
- Monitor ESLint and Madge execution
- Support teams with tooling issues

**Training Checklist:**
- [ ] Understand CI/CD validation pipeline
- [ ] Can interpret ESLint boundary violations
- [ ] Can run dependency analysis locally
- [ ] Can support teams with tooling questions

**Sign-Off:** _________________________ (DevOps Lead)  
**Date:** _______________

---

## Training Schedule

### Week 1: Foundation
- **Day 1:** Architecture Overview (Module 1) - All teams
- **Day 2:** ADRs Overview (Module 2) - All teams
- **Day 3:** Working with New Architecture (Module 3) - All teams

### Week 2: Deep Dives
- **Day 1:** Infrastructure Team Training - Infrastructure specifics
- **Day 2:** Identity Team Training - Auth/security specifics
- **Day 3:** Business Domain Training - Domain-specific patterns
- **Day 4:** Q&A Session - Open discussion

### Week 3: Preparation
- **Day 1-2:** Practice with new patterns
- **Day 3-4:** Code review training
- **Day 5:** Final Q&A and sign-off

---

## Resources

### Documentation
- [ADR-001: Domain-Driven Design](../../docs/adr/ADR-001-domain-driven-design-adoption.md)
- [ADR-002: Infrastructure Isolation](../../docs/adr/ADR-002-infrastructure-isolation.md)
- [ADR-003: Dependency Hierarchy](../../docs/adr/ADR-003-dependency-hierarchy.md)
- [ADR-004: Shared Layer Guidelines](../../docs/adr/ADR-004-shared-layer-guidelines.md)
- [MODULE_OWNERSHIP.md](../../docs/MODULE_OWNERSHIP.md)

### Tools
- ESLint: `npm run lint`
- Dependency Analysis: `node tools/analyze-simple.js`
- Madge (Circular Deps): `npx madge --circular --extensions ts src/`

### Support
- **Architecture Questions:** Architecture Lead
- **Tooling Issues:** DevOps Team
- **Domain-Specific:** Module Owner Team

---

## All-Hands Sign-Off

This confirms that your team has completed Phase 0 training and is ready for Phase 1 implementation.

| Team | Lead | Date | Signature |
|------|------|------|-----------|
| Infrastructure | _________ | _____ | _________ |
| Auth/Security | _________ | _____ | _________ |
| Trading/Exchange | _________ | _____ | _________ |
| Product/Platform | _________ | _____ | _________ |
| Finance/Risk | _________ | _____ | _________ |
| DevOps/Platform | _________ | _____ | _________ |
| Blockchain/DeFi | _________ | _____ | _________ |
| Analytics | _________ | _____ | _________ |

**Approved By:** _________________________ (VP Engineering)  
**Date:** _______________  
**Status:** Ready for Phase 1 ✓

---

**All Phase 0 Tasks Complete!** ✅

Proceed to Phase 1: Infrastructure Modernization once all sign-offs are collected.


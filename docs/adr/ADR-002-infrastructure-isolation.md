# ADR-002: Infrastructure Module Isolation

**Status**: APPROVED  
**Date**: 2026-06-15  
**Author**: Architecture Team  
**Affected Scope**: Infrastructure domain, all domains that depend on infrastructure  

---

## Problem Statement

Infrastructure services (database, cache, logging, monitoring, etc.) are **foundation layers** that should be:

- **Reusable** across all domains without modification
- **Stable** - minimal changes after initial implementation
- **Independent** - not aware of business logic details
- **Testable** - infrastructure tests don't depend on domain tests

However, in the current codebase, infrastructure modules sometimes import business domain modules, creating:

- **Tight coupling** - Infrastructure becomes aware of business rules
- **Circular dependencies** - Business modules import infrastructure, which imports business
- **Reusability issues** - Hard to use infrastructure in new contexts
- **Testing problems** - Infrastructure tests fail when business logic changes

**Example (Current Problem)**:
```typescript
// src/cache/redis.service.ts
import { TradeService } from '../trading/services/trade.service'; // ❌ WRONG!

// This is infrastructure being aware of business logic
```

---

## Decision

**Infrastructure modules MUST NOT import from business domains.**

### Dependency Rules

#### Infrastructure Module Can Import From:
- ✅ Other infrastructure modules
- ✅ `shared/` (types, constants, utilities)
- ✅ External npm packages

#### Infrastructure Module CANNOT Import From:
- ❌ Identity modules
- ❌ Business domain modules (accounts, market, exchange, protection, etc.)

#### All Other Modules CAN Import From:
- ✅ Infrastructure modules
- ✅ `shared/`
- ✅ Other modules at same level or below in hierarchy

---

## Rationale

1. **Separation of Concerns** - Infrastructure knows HOW to cache/log; domains know WHAT to cache/log
2. **Reusability** - Same infrastructure services used by all domains
3. **Stability** - Infrastructure changes don't ripple through business logic
4. **Testing** - Infrastructure can be tested independently
5. **Onboarding** - Clear contract between layers

---

## Implementation

### 1. Directory Structure

```
src/
├── infrastructure/              # NO business logic allowed
│   ├── config/                  # Environment configuration
│   ├── database/                # ORM, migrations, data access
│   ├── cache/                   # Redis, cache management
│   ├── queue/                   # Job queues, workers
│   ├── websocket/               # Socket.IO configuration
│   ├── graphql/                 # GraphQL setup
│   ├── events/                  # Event bus abstraction
│   ├── logging/                 # Structured logging
│   ├── monitoring/              # Health checks, metrics
│   ├── scheduler/               # Cron jobs, scheduling
│   ├── rate-limiter/            # API throttling
│   ├── audit-log/               # Immutable audit records
│   ├── common/                  # Shared decorators, guards, filters
│   └── infrastructure.module.ts
│
├── shared/                      # Shared types, enums, utilities
│   ├── constants/
│   ├── enums/
│   ├── interfaces/
│   ├── types/
│   └── utils/
│
├── identity/                    # Can import infrastructure
│   ├── auth/
│   ├── user/
│   └── identity.module.ts
│
└── [future domains]/            # Can import infrastructure + lower-level domains
```

### 2. ESLint Enforcement

Add boundary rules to prevent violations:

```json
{
  "overrides": [
    {
      "files": ["src/infrastructure/**/*.ts"],
      "rules": {
        "@nrwl/nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBoundaryConstraints": true,
            "depConstraints": [
              {
                "sourceTag": "scope:infrastructure",
                "onlyDependOnLibsWithTags": [
                  "scope:infrastructure",
                  "scope:shared"
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

### 3. Example: Cache Service

**Correct ✅**:
```typescript
// src/infrastructure/cache/redis.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheStore } from '@shared/interfaces/cache.interface';

@Injectable()
export class RedisCacheService implements CacheStore {
  constructor(private configService: ConfigService) {}

  async get<T>(key: string): Promise<T | null> {
    // Generic cache logic, no business knowledge
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Generic cache logic
  }
}
```

**Incorrect ❌**:
```typescript
// src/infrastructure/cache/redis.service.ts
import { TradeService } from '../../trading/services/trade.service'; // ❌ VIOLATION!

// Don't do this:
export class RedisCacheService {
  constructor(private tradeService: TradeService) {}
  
  async cacheTrade(tradeId: string): Promise<void> {
    const trade = await this.tradeService.getTradeById(tradeId);
    // ❌ Infrastructure shouldn't know about trades
  }
}
```

### 4. Example: How Business Domains Use Infrastructure

**Correct ✅**:
```typescript
// src/identity/auth/services/auth.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { CacheService } from '@infrastructure/cache/cache.service';
import { LoggerService } from '@infrastructure/logging/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private cacheService: CacheService,
    private logger: LoggerService,
  ) {}

  async login(email: string, password: string): Promise<AuthToken> {
    // Business logic uses infrastructure services
    await this.cacheService.set(`session:${email}`, token);
    this.logger.info(`User logged in: ${email}`);
  }
}
```

---

## Violations to Fix

### Current Violations (Examples)

Based on codebase analysis, likely violations:

1. **Notifications importing trading logic**
   - Fix: Use event emitters instead of direct imports
   
2. **Cache warming importing business services**
   - Fix: Use dependency injection of generic providers

3. **Queue workers importing multiple domains**
   - Fix: Use event-driven pattern with pub/sub

---

## Enforcement Mechanisms

### 1. **Linting** (Runtime)
```bash
npm run lint:architecture
```

### 2. **CI Checks** (Pre-commit)
```bash
# .github/workflows/architecture-check.yml
- name: Check Architecture Boundaries
  run: npx eslint src/infrastructure --no-eslintignore
```

### 3. **Code Review Checklist**
```markdown
- [ ] Infrastructure modules only import from infrastructure/ and shared/
- [ ] No business logic in infrastructure/
- [ ] No business domain imports in infrastructure files
```

---

## Exceptions & Justifications

If an exception is absolutely necessary:

1. Document it with a comment:
   ```typescript
   // EXCEPTION: Temporarily importing UserService for audit logging
   // TODO: Refactor to use domain events instead
   // Issue: https://github.com/StelTade/SwapTrade-Backend/issues/XXX
   import { UserService } from '../../identity/user/user.service';
   ```

2. Create a GitHub issue for eventual resolution

3. Discuss in architecture review

**Do not accumulate exceptions.**

---

## Success Criteria

- ✅ No infrastructure files import from business domains
- ✅ ESLint rules enforce this automatically
- ✅ All existing imports follow the rule
- ✅ CI fails if boundaries are violated
- ✅ Team understands and applies the rule

---

## Related ADRs

- ADR-001: Domain-Driven Design Adoption
- ADR-003: Dependency Hierarchy & Enforcement
- ADR-004: Shared Layer Guidelines

---

## References

- [The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- [NestJS Best Practices](https://docs.nestjs.com/architecture)

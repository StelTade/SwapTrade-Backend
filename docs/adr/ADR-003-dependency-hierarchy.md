# ADR-003: Dependency Hierarchy & Enforcement

**Status**: APPROVED  
**Date**: 2026-06-15  
**Author**: Architecture Team  
**Affected Scope**: All domains, all imports  

---

## Problem Statement

Without explicit dependency rules:

- **Developers don't know which modules can depend on which**
- **Circular dependencies emerge gradually** - hard to detect until too late
- **Refactoring becomes risky** - unclear impact of changes
- **Cross-cutting concerns** - notifications might import trading logic
- **Testing becomes complex** - unclear dependencies make mocking difficult

**Example of Problem**:
```
trading/ → risk/
risk/ → portfolio/
portfolio/ → trading/  // ❌ CIRCULAR!
```

---

## Decision

Establish an explicit **unidirectional dependency hierarchy** with enforcement via:

1. **ESLint rules** with `@nrwl/nx/enforce-module-boundaries`
2. **TypeScript path aliases** to make dependencies explicit
3. **CI/CD checks** to prevent violations
4. **Code review checklist** for manual verification

---

## Dependency Hierarchy

```
┌─────────────────────────────────────────────┐
│         Shared Layer (Level 0)              │
│  • constants/  • enums/  • interfaces/      │
│  • types/      • utils/                     │
│  (No business logic, no runtime modules)    │
└─────────────────────────────────────────────┘
                    ↑
        ┌───────────┴───────────┐
        ↑                       ↑
┌──────────────────┐    ┌──────────────────┐
│ Infrastructure   │    │ (Not Used Yet)   │
│ Domain (Level 1) │    │                  │
│                  │    │                  │
│ • config         │    │                  │
│ • database       │    │                  │
│ • cache          │    │                  │
│ • queue          │    │                  │
│ • websocket      │    │                  │
│ • graphql        │    │                  │
│ • events         │    │                  │
│ • logging        │    │                  │
│ • monitoring     │    │                  │
│ • scheduler      │    │                  │
│ • rate-limiter   │    │                  │
│ • audit-log      │    │                  │
└──────────────────┘    └──────────────────┘
        ↑
        │ Can only depend on:
        │ • infrastructure/*
        │ • shared/*
        │
┌──────────────────────────────────────────┐
│ Identity Domain (Level 2)                │
│                                          │
│ • auth          • user       • roles     │
│ • permissions   • admin      • kyc       │
│ • compliance    • privacy    • did       │
└──────────────────────────────────────────┘
        ↑
        │ Can only depend on:
        │ • identity/*
        │ • infrastructure/*
        │ • shared/*
        │
┌──────────────────────────────────────────┐
│ Accounts Domain (Level 3) — FUTURE       │
│ (Can depend on: accounts, identity, ...)│
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Market Domain (Level 4) — FUTURE         │
│ (Can depend on: market, accounts, ...)   │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Exchange Domain (Level 5) — FUTURE       │
│ (Trading matching engine)                │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Protection Domain (Level 6) — FUTURE     │
│ (Risk, Insurance, Liquidation)           │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Settlement Domain (Level 7) — FUTURE     │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Blockchain Domain (Level 8) — FUTURE     │
│ (Stellar, Ethereum, etc.)                │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Communications Domain (Level 9) — FUTURE │
│ (Email, SMS, Notifications)              │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Analytics Domain (Level 10) — FUTURE     │
│ (Reporting, Dashboards)                  │
└──────────────────────────────────────────┘
        ↑
┌──────────────────────────────────────────┐
│ Intelligence Domain (Level 11) — FUTURE  │
│ (ML, Price Prediction, AI)               │
└──────────────────────────────────────────┘
```

---

## Dependency Rules by Level

| Level | Domain | Can Depend On | Cannot Depend On |
|-------|--------|--------------|-----------------|
| 0 | Shared | (nothing) | All |
| 1 | Infrastructure | shared | identity, accounts, market, ... |
| 2 | Identity | infrastructure, shared | accounts, market, exchange, ... |
| 3 | Accounts | identity, infrastructure, shared | market, exchange, protection, ... |
| 4 | Market | accounts, identity, infrastructure, shared | exchange, protection, settlement, ... |
| 5 | Exchange | market, accounts, identity, infrastructure, shared | protection, settlement, blockchain, ... |
| 6 | Protection | exchange, market, accounts, identity, infrastructure, shared | settlement, blockchain, ... |
| 7 | Settlement | protection, exchange, market, accounts, identity, infrastructure, shared | blockchain, ... |
| 8 | Blockchain | all levels below it | communications, analytics, intelligence |
| 9 | Communications | all levels below it | analytics, intelligence |
| 10 | Analytics | all levels below it | intelligence |
| 11 | Intelligence | all levels below it | (nothing above) |

### Key Rules

1. **Dependencies flow downward only** - higher levels depend on lower levels
2. **No sideways dependencies** - Exchange cannot depend on Analytics
3. **No upward dependencies** - Infrastructure cannot depend on Business domains
4. **Shared layer is independent** - defines interfaces all domains implement

---

## Implementation

### 1. TypeScript Path Aliases

**File**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@infrastructure/*": ["src/infrastructure/*"],
      "@identity/*": ["src/identity/*"],
      "@accounts/*": ["src/accounts/*"],
      "@market/*": ["src/market/*"],
      "@exchange/*": ["src/exchange/*"],
      "@protection/*": ["src/protection/*"],
      "@settlement/*": ["src/settlement/*"],
      "@blockchain/*": ["src/blockchain/*"],
      "@communications/*": ["src/communications/*"],
      "@analytics/*": ["src/analytics/*"],
      "@intelligence/*": ["src/intelligence/*"]
    }
  }
}
```

**Benefits**:
- Explicit imports: `import { AuthService } from '@identity/auth/services'`
- Easy to detect violations: if path doesn't match domain, it's wrong
- Better IDE autocomplete

### 2. ESLint Configuration

**File**: `.eslintrc.json`

```json
{
  "overrides": [
    {
      "files": ["src/**/*.ts"],
      "rules": {
        "@nrwl/nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBoundaryConstraints": true,
            "depConstraints": [
              {
                "sourceTag": "scope:shared",
                "onlyDependOnLibsWithTags": ["scope:shared"]
              },
              {
                "sourceTag": "scope:infrastructure",
                "onlyDependOnLibsWithTags": ["scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:identity",
                "onlyDependOnLibsWithTags": ["scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:accounts",
                "onlyDependOnLibsWithTags": ["scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:market",
                "onlyDependOnLibsWithTags": ["scope:market", "scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:exchange",
                "onlyDependOnLibsWithTags": ["scope:exchange", "scope:market", "scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:protection",
                "onlyDependOnLibsWithTags": ["scope:protection", "scope:exchange", "scope:market", "scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:settlement",
                "onlyDependOnLibsWithTags": ["scope:settlement", "scope:protection", "scope:exchange", "scope:market", "scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              },
              {
                "sourceTag": "scope:blockchain",
                "onlyDependOnLibsWithTags": ["scope:blockchain", "scope:settlement", "scope:protection", "scope:exchange", "scope:market", "scope:accounts", "scope:identity", "scope:infrastructure", "scope:shared"]
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**File**: `nx.json` (tag modules)

```json
{
  "projectNameAndRootFormat": "derived",
  "plugins": [
    {
      "plugin": "@nrwl/nx/enforce-module-boundaries"
    }
  ],
  "targetDefaults": {}
}
```

### 3. Module Tags

Each module needs a tag indicating its scope:

**File**: `src/infrastructure/.nxignore`
```
tags:
  - scope:infrastructure
```

Repeat for all domains.

### 4. CI/CD Check

**File**: `.github/workflows/architecture.yml`

```yaml
name: Architecture Validation

on: [pull_request]

jobs:
  check-boundaries:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - name: Check Module Boundaries
        run: npx eslint src --no-eslintignore
      - name: Check for Circular Dependencies
        run: npx madge --circular src/
      - name: Run Dependency Analysis
        run: npx ts-node tools/analyze-dependencies.ts
```

---

## Example: Correct vs. Incorrect Imports

### ✅ Correct

```typescript
// File: src/identity/auth/services/auth.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@infrastructure/config/config.service';
import { DatabaseService } from '@infrastructure/database/database.service';
import { LoggerService } from '@infrastructure/logging/logger.service';
import { UserRepository } from '@identity/user/repositories/user.repository';
import { AppConfig } from '@shared/interfaces/config.interface';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private databaseService: DatabaseService,
    private loggerService: LoggerService,
    private userRepository: UserRepository,
    private appConfig: AppConfig,
  ) {}
}
```

All imports are level-appropriate (Identity can import Infrastructure + Shared).

### ❌ Incorrect

```typescript
// File: src/infrastructure/logging/logger.service.ts
import { Injectable } from '@nestjs/common';
import { TradeService } from '@exchange/trading/services/trade.service'; // ❌ VIOLATION!

// Infrastructure cannot import business domains!
```

---

## Validation Process

### Step 1: Automatic Detection
```bash
npm run lint:architecture
# ESLint will report violations
```

### Step 2: Fix Violations
Address each violation:
- Move business logic to appropriate domain
- Use dependency injection instead of direct imports
- Use pub/sub pattern for cross-domain communication

### Step 3: Circular Dependency Check
```bash
npx madge --circular src/
```

### Step 4: Full Audit
```bash
npx ts-node tools/analyze-dependencies.ts
```

---

## Handling Cross-Domain Communication

When Domain A needs something from Domain B:

### Option 1: Event-Driven (Preferred)
```typescript
// Domain B publishes an event
@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}
  
  async updateUser(id: string, data: any) {
    const user = await this.repository.update(id, data);
    this.eventEmitter.emit('user.updated', { user });
  }
}

// Domain C subscribes to event
@Injectable()
export class AuditLogger {
  @OnEvent('user.updated')
  handleUserUpdate(payload: any) {
    this.log(`User updated: ${payload.user.id}`);
  }
}
```

### Option 2: Shared Interface
```typescript
// In @shared/interfaces/user.interface.ts
export interface IUserService {
  getUser(id: string): Promise<User>;
}

// Domain B implements it
@Injectable()
export class UserService implements IUserService {
  async getUser(id: string): Promise<User> { ... }
}

// Domain C depends on the interface, not the implementation
constructor(@Inject('IUserService') private userService: IUserService) {}
```

### Option 3: HTTP/GraphQL (Microservices-Ready)
When domains are fully separated, use HTTP or GraphQL queries instead of direct imports.

---

## Success Criteria

- ✅ All imports use path aliases (`@domain/...`)
- ✅ ESLint passes with no boundary violations
- ✅ No circular dependencies detected
- ✅ Dependency analysis script completes successfully
- ✅ All tests pass
- ✅ Team understands and applies rules

---

## Related ADRs

- ADR-001: Domain-Driven Design Adoption
- ADR-002: Infrastructure Module Isolation
- ADR-004: Shared Layer Guidelines

---

## References

- [Module Boundary Rules in Nx](https://nx.dev/packages/nx/documents/enforce-module-boundaries)
- [Madge - Detect Circular Dependencies](https://github.com/pahen/madge)
- [TypeScript Path Aliases](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)

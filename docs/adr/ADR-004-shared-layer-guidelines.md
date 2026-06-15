# ADR-004: Shared Layer Guidelines

**Status**: APPROVED  
**Date**: 2026-06-15  
**Author**: Architecture Team  
**Affected Scope**: src/shared directory and all imports from it  

---

## Problem Statement

A `shared/` folder without clear guidelines becomes a dumping ground for:

- Business logic that doesn't fit elsewhere
- Duplicate code across domains
- Circular dependency workarounds
- Untested utility functions
- Unclear ownership and maintenance

**Example of Problems**:
```
src/shared/
├── services/            // ❌ Business logic, not shared types!
├── business-logic/      // ❌ Where did this come from?
├── helpers/             // ❌ Too broad, unclear purpose
└── utils/               // 🤔 Maybe okay, maybe not
```

---

## Decision

Establish explicit guidelines for `src/shared/`:

**The Shared Layer contains ONLY:**
1. **Type definitions** - Interfaces, types, generics
2. **Enums** - Constants with multiple values
3. **Constants** - Immutable values used across domains
4. **Utilities** - Pure functions (no side effects, no dependencies)

**The Shared Layer does NOT contain:**
- ❌ Services (business logic)
- ❌ Controllers
- ❌ Repositories
- ❌ Entities
- ❌ Domain logic
- ❌ Any NestJS decorators (@Injectable, @Module, etc.)

---

## Structure

```
src/shared/
│
├── constants/
│   ├── app.constants.ts         # App-wide constants (timeouts, limits)
│   ├── errors.constants.ts      # Error codes, messages
│   ├── messages.constants.ts    # Success messages, notifications
│   └── index.ts
│
├── enums/
│   ├── trade-status.enum.ts     # TradeStatus enum
│   ├── user-role.enum.ts        # UserRole enum
│   ├── order-type.enum.ts       # OrderType enum
│   └── index.ts
│
├── interfaces/
│   ├── cache.interface.ts       # CacheStore interface (for cache services)
│   ├── event.interface.ts       # IDomainEvent interface
│   ├── repository.interface.ts  # Generic IRepository<T>
│   ├── logger.interface.ts      # ILogger interface
│   ├── config.interface.ts      # IAppConfig, IDatabaseConfig, etc.
│   └── index.ts
│
├── types/
│   ├── pagination.types.ts      # PaginatedResult<T>, PageOptions
│   ├── api-response.types.ts    # ApiResponse<T>, ApiError
│   ├── common.types.ts          # Nullable, Optional, Awaitable, etc.
│   └── index.ts
│
├── utils/
│   ├── date.utils.ts            # Date manipulation functions
│   ├── string.utils.ts          # String manipulation functions
│   ├── math.utils.ts            # Math utility functions
│   ├── array.utils.ts           # Array manipulation functions
│   ├── hash.utils.ts            # Hashing utilities (no secrets!)
│   └── index.ts
│
└── index.ts                     # Main export file
```

---

## Guidelines by Category

### 1. Constants

**Purpose**: Immutable values that don't change  
**Examples**:
```typescript
// ✅ GOOD: Immutable constants
export const MAX_LOGIN_ATTEMPTS = 5;
export const JWT_EXPIRATION_SECONDS = 3600;
export const MIN_PASSWORD_LENGTH = 8;
export const CACHE_TTL_DEFAULT = 300;

// ❌ BAD: Mutable values, or business logic
export let currentUser: User;  // Mutable!
export const calculateDiscount = (amount) => amount * 0.1;  // Business logic!
```

**File**: `src/shared/constants/app.constants.ts`

```typescript
/**
 * Application-wide constants
 * These values should not change at runtime
 */

// Timeouts
export const REQUEST_TIMEOUT_MS = 30000;
export const DB_CONNECTION_TIMEOUT_MS = 5000;

// Limits
export const MAX_PAGE_SIZE = 100;
export const MAX_EXPORT_ROWS = 10000;
export const MAX_CONCURRENT_JOBS = 10;

// Thresholds
export const MIN_TRADE_AMOUNT = 0.01;
export const MAX_TRADE_LEVERAGE = 10;

export const DEFAULT_CACHE_TTL_SECONDS = 300;
export const DEFAULT_PAGE_SIZE = 20;
```

### 2. Enums

**Purpose**: Typed constants representing choices  
**Examples**:
```typescript
// ✅ GOOD: Clear enum values
export enum TradeStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// ❌ BAD: Magic strings scattered in code
if (trade.status === 'pending') {}  // Use enum instead!
```

**File**: `src/shared/enums/trade.enums.ts`

```typescript
export enum TradeStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
  SWAP = 'SWAP',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP_LOSS = 'STOP_LOSS',
}
```

### 3. Interfaces

**Purpose**: Define contracts that implementations satisfy  
**Key Rule**: Interfaces should be **technology-agnostic**

**Examples**:
```typescript
// ✅ GOOD: Generic cache interface, any service can implement
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

// ✅ GOOD: Repository pattern interface
export interface IRepository<T> {
  find(id: any): Promise<T | null>;
  findAll(options?: any): Promise<T[]>;
  save(entity: T): Promise<T>;
  delete(id: any): Promise<void>;
}

// ❌ BAD: Technology-specific interface (Redis shouldn't be in shared!)
export interface IRedisService {
  hset(key, field, value);
  hget(key, field);
}

// ❌ BAD: Business logic interface
export interface ITradeEngine {
  calculateProfit(trade: Trade): number;  // This is business logic!
}
```

**File**: `src/shared/interfaces/repository.interface.ts`

```typescript
/**
 * Generic repository pattern interface
 * All repositories should implement this
 */
export interface IRepository<T> {
  find(id: any): Promise<T | null>;
  findAll(options?: FindOptions): Promise<T[]>;
  findBy(query: Partial<T>): Promise<T[]>;
  save(entity: T): Promise<T>;
  saveMany(entities: T[]): Promise<T[]>;
  update(id: any, data: Partial<T>): Promise<T>;
  delete(id: any): Promise<void>;
  deleteMany(ids: any[]): Promise<void>;
  count(): Promise<number>;
}

export interface FindOptions {
  skip?: number;
  take?: number;
  order?: Record<string, 'ASC' | 'DESC'>;
}
```

### 4. Types

**Purpose**: Complex type definitions, type utilities  
**Examples**:
```typescript
// ✅ GOOD: Utility types for common patterns
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Awaitable<T> = T | Promise<T>;

// ✅ GOOD: Generic API response type
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// ✅ GOOD: Pagination type
export type PaginatedResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ❌ BAD: Business logic types
export type TradeCalculation = {
  profit: number;  // This should be in trade domain!
};
```

**File**: `src/shared/types/common.types.ts`

```typescript
/**
 * Common type utilities
 */

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Awaitable<T> = T | Promise<T>;
export type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export type Constructor<T = {}> = new (...args: any[]) => T;
```

### 5. Utils

**Purpose**: Pure functions, no side effects  
**Key Rule**: Utils should have **NO dependencies** (except other utils)

**Examples**:
```typescript
// ✅ GOOD: Pure function, no dependencies
export function formatDate(date: Date, format: string): string {
  // ... date formatting logic
}

// ✅ GOOD: Array manipulation
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ❌ BAD: Has dependencies, should be in a service
export async function fetchUserData(userId: string) {
  return await userService.getUser(userId);  // ❌ WRONG!
}

// ❌ BAD: Side effects
export function logMessage(msg: string) {
  console.log(msg);  // Side effect! Put in logging service
}
```

**File**: `src/shared/utils/date.utils.ts`

```typescript
/**
 * Pure date utility functions
 * No dependencies, no side effects
 */

export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function formatDate(date: Date, format: string): string {
  // ISO 8601 format
  return date.toISOString();
}
```

---

## What NOT to Put in Shared

### ❌ Services

```typescript
// ❌ WRONG: Services belong in domains
// src/shared/services/user.service.ts
export class UserService {
  constructor(private repository: UserRepository) {}
  async getUser(id: string) { ... }
}

// ✅ RIGHT: Services belong in their domain
// src/identity/user/services/user.service.ts
export class UserService {
  constructor(private repository: UserRepository) {}
  async getUser(id: string) { ... }
}
```

### ❌ Repositories

```typescript
// ❌ WRONG
// src/shared/repositories/user.repository.ts

// ✅ RIGHT
// src/identity/user/repositories/user.repository.ts
```

### ❌ Business Logic

```typescript
// ❌ WRONG
// src/shared/utils/trade.calculator.ts
export function calculateProfit(trade: Trade): number {
  return (trade.exitPrice - trade.entryPrice) * trade.quantity;
}

// ✅ RIGHT: This belongs in the exchange domain
// src/exchange/trading/services/trade.calculator.ts
```

### ❌ NestJS Modules/Decorators

```typescript
// ❌ WRONG
// src/shared/shared.module.ts
@Module({
  imports: [...],
  exports: [...],
})
export class SharedModule {}

// ✅ RIGHT: Shared is types/constants only, no runtime module
```

---

## Importing from Shared

### ✅ Do This

```typescript
// From identity/auth/services/auth.service.ts
import { TradeStatus } from '@shared/enums/trade.enums';
import { ApiResponse } from '@shared/types/api-response.types';
import { formatDate } from '@shared/utils/date.utils';
import { IRepository } from '@shared/interfaces/repository.interface';

// These are all types/constants/utilities - zero runtime cost
```

### ❌ Don't Do This

```typescript
// ❌ WRONG: Importing services from shared
import { UserService } from '@shared/services/user.service';

// ❌ WRONG: Importing modules
import { SharedModule } from '@shared/shared.module';

// ❌ WRONG: Circular imports
// shared/utils needs identity/user → won't work
```

---

## Maintenance & Governance

### Who Owns Shared?

- **Constants**: Platform/DevOps team
- **Enums**: Domain teams (each enum owned by its domain)
- **Interfaces**: Domain teams + architects
- **Types**: Full-stack developers
- **Utils**: Shared across all teams (consensus required for new utils)

### Adding to Shared

**Process**:
1. Assess if it's truly needed across multiple domains
2. Check if it should be in a specific domain instead
3. Document its purpose and usage
4. Get code review from architecture team
5. Add tests if it's a utility function

**Question to Ask**: "Does this belong in multiple domains?"
- If NO → Put it in the appropriate single domain
- If YES → It's a candidate for shared

---

## Export Strategy

**File**: `src/shared/index.ts`

```typescript
/**
 * Central export point for shared types
 * Usage: import { TradeStatus, formatDate } from '@shared';
 */

// Constants
export * from './constants/app.constants';
export * from './constants/errors.constants';

// Enums
export * from './enums/trade.enums';
export * from './enums/user.enums';

// Interfaces
export * from './interfaces/cache.interface';
export * from './interfaces/repository.interface';

// Types
export * from './types/common.types';
export * from './types/api-response.types';

// Utils
export * from './utils/date.utils';
export * from './utils/string.utils';
```

---

## Examples: Correct Shared Usage

### Example 1: Enum Shared Across Domains

```typescript
// src/shared/enums/trade.enums.ts
export enum TradeStatus {
  PENDING = 'PENDING',
  MATCHED = 'MATCHED',
  COMPLETED = 'COMPLETED',
}

// src/exchange/trading/entities/trade.entity.ts
import { TradeStatus } from '@shared/enums/trade.enums';

export class TradeEntity {
  @Column()
  status: TradeStatus;
}

// src/protection/risk/services/risk.service.ts
import { TradeStatus } from '@shared/enums/trade.enums';

export class RiskService {
  assessRisk(trade: Trade) {
    if (trade.status === TradeStatus.COMPLETED) { ... }
  }
}
```

### Example 2: Interface Shared Across Domains

```typescript
// src/shared/interfaces/repository.interface.ts
export interface IRepository<T> {
  find(id: any): Promise<T | null>;
  save(entity: T): Promise<T>;
}

// src/identity/user/repositories/user.repository.ts
import { IRepository } from '@shared/interfaces/repository.interface';

export class UserRepository implements IRepository<User> {
  async find(id: string): Promise<User | null> { ... }
  async save(entity: User): Promise<User> { ... }
}

// src/exchange/trading/repositories/trade.repository.ts
import { IRepository } from '@shared/interfaces/repository.interface';

export class TradeRepository implements IRepository<Trade> {
  async find(id: string): Promise<Trade | null> { ... }
  async save(entity: Trade): Promise<Trade> { ... }
}
```

---

## Success Criteria

- ✅ `src/shared/` contains only types, enums, constants, interfaces, utilities
- ✅ No services, controllers, entities in shared
- ✅ No NestJS modules or decorators in shared
- ✅ All utils are pure functions (no side effects, no dependencies)
- ✅ All enums are used consistently across domains
- ✅ Shared exports are documented in central index.ts
- ✅ Team understands and follows guidelines

---

## Related ADRs

- ADR-001: Domain-Driven Design Adoption
- ADR-002: Infrastructure Module Isolation
- ADR-003: Dependency Hierarchy & Enforcement

---

## References

- [DDD Shared Kernel](https://www.domainlanguage.com/ddd/)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [NestJS Shared Modules](https://docs.nestjs.com/techniques/database#multiple-databases)

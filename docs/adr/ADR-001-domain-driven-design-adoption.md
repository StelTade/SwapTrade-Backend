# ADR-001: Adopt Domain-Driven Design Architecture

**Status**: APPROVED  
**Date**: 2026-06-15  
**Author**: Architecture Team  
**Affected Scope**: Entire codebase refactor  

---

## Problem Statement

The current codebase has grown to **50+ modules organized by feature** rather than business domains. This structure creates:

- **Unclear module ownership** - Multiple teams modifying the same feature areas
- **Tangled dependencies** - Circular dependencies and cross-cutting concerns
- **Difficult scaling** - Hard to add new domains without architectural refactoring
- **Business logic mixed with infrastructure** - Cache, database, and queue logic intermingled with trading logic
- **Onboarding friction** - New developers struggle to understand module boundaries

**Consequence**: The system has become increasingly difficult to maintain, test, and extend.

---

## Decision

Reorganize the codebase from **feature-based modules** to **domain-driven bounded contexts**.

### New Top-Level Domains

```
src/
├── infrastructure/        # Infrastructure services (no business logic)
├── identity/              # User identity, auth, roles, permissions
├── accounts/              # Account management, balances (future)
├── market/                # Market data, price feeds (future)
├── exchange/              # Trading matching engine (future)
├── protection/            # Risk management, insurance (future)
├── settlement/            # Trade settlement (future)
├── blockchain/            # Blockchain integrations (future)
├── communications/        # Notifications, alerts (future)
├── analytics/             # Data analysis, reporting (future)
├── intelligence/          # ML, price prediction (future)
└── shared/                # Shared types, constants, utilities
```

### Dependency Hierarchy

```
Infrastructure
    ↓
Identity
    ↓
Accounts
    ↓
Market
    ↓
Exchange
    ↓
Protection
    ↓
Settlement
    ↓
Blockchain
    ↓
Communications
    ↓
Analytics
    ↓
Intelligence
```

**Key Rule**: Dependencies can only flow downward. Reverse dependencies are strictly forbidden.

---

## Rationale

1. **Clear Ownership** - Each domain has a dedicated team responsible for it
2. **Reduced Complexity** - Smaller, focused modules are easier to understand
3. **Scalability** - New domains can be added without refactoring existing code
4. **Testing** - Domain boundaries make unit and integration testing clearer
5. **Maintainability** - Less interdependency means less risk of breaking changes
6. **Evolutionary Architecture** - Supports transitioning to microservices if needed

---

## Consequences

### Positive
- ✅ Clear boundaries prevent scope creep
- ✅ Easier to parallelize development across teams
- ✅ Reduced cognitive load per module
- ✅ Better code reusability within domains
- ✅ Simpler deployment and scaling strategies

### Negative
- ❌ Major refactoring effort (~2-4 weeks of focused work)
- ❌ Temporary disruption to development velocity
- ❌ Requires team training on new structure
- ❌ Build time may increase if not optimized
- ❌ Breaking changes to module imports

---

## Implementation Strategy

### Phase 0: Governance & Planning
- Audit all 50+ modules and their dependencies
- Identify and resolve circular dependencies
- Clarify ambiguous modules (platform, metrics, edge)
- Document all architectural decisions
- Set up enforcement rules (ESLint, CI checks)

### Phase 1: Infrastructure Domain
- Move all infrastructure modules (config, database, cache, queue, etc.)
- Create `InfrastructureModule` aggregate
- Ensure no business logic is present

### Phase 2: Identity Domain
- Move all identity modules (auth, user, roles, permissions, etc.)
- Create `IdentityModule` aggregate
- Verify dependency rules

### Phase 3+: Business Domains (Future)
- Gradually introduce remaining domains
- Maintain dependency hierarchy

---

## Timeline

- **Phase 0**: 1 week (governance, planning, analysis)
- **Phase 1**: 1 week (infrastructure migration)
- **Phase 2**: 1 week (identity migration)
- **Total**: ~3 weeks for foundational work

---

## Alternatives Considered

### 1. Keep Current Structure
**Rejected** - Does not address growing complexity; unsustainable long-term.

### 2. Hybrid Approach (Partial DDD)
**Rejected** - Half measures create confusion; full commitment needed for benefits.

### 3. Microservices from Day One
**Rejected** - Too aggressive; operational overhead not justified yet.

---

## Success Criteria

- ✅ All 50+ modules mapped to new structure
- ✅ Zero circular dependencies
- ✅ All architecture rules enforced via ESLint
- ✅ 100% test pass rate post-migration
- ✅ Clear ownership assigned to each domain
- ✅ Documentation updated and reviewed
- ✅ Team trained on new structure

---

## Related ADRs

- ADR-002: Infrastructure Module Isolation
- ADR-003: Dependency Hierarchy & Enforcement
- ADR-004: Shared Layer Guidelines

---

## References

- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Bounded Contexts](https://martinfowler.com/bliki/BoundedContext.html)
- [NestJS Module Patterns](https://docs.nestjs.com/modules)

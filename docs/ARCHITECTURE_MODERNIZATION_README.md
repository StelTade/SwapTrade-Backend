# Architecture Modernization: Quick Start Guide

## 🎯 What is This?

This is a **Phase 0 (Governance)** initiative to establish domain-driven architecture foundations for SwapTrade Backend. The goal is to organize 50+ modules into clear, maintainable domains with enforced dependency rules.

## 📚 Documentation (Read in Order)

1. **[PHASE_0_GOVERNANCE.md](./PHASE_0_GOVERNANCE.md)** - Complete Phase 0 roadmap (start here)
2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Architecture overview (coming after Phase 0)
3. **ADRs** (Architecture Decision Records):
   - [ADR-001: Domain-Driven Design Adoption](./adr/ADR-001-domain-driven-design-adoption.md)
   - [ADR-002: Infrastructure Module Isolation](./adr/ADR-002-infrastructure-isolation.md)
   - [ADR-003: Dependency Hierarchy & Enforcement](./adr/ADR-003-dependency-hierarchy.md)
   - [ADR-004: Shared Layer Guidelines](./adr/ADR-004-shared-layer-guidelines.md)

## 🚀 Getting Started

### Run the Dependency Analysis

```bash
# Install required tools
npm install -D glob ts-node typescript @nrwl/eslint-plugin-nx

# Run dependency analysis
npx ts-node tools/analyze-dependencies.ts

# Output: docs/DEPENDENCY_AUDIT.md
```

### Review the Output

```bash
# Open the generated report
cat docs/DEPENDENCY_AUDIT.md

# Look for:
# - Circular dependencies (⚠️ must fix)
# - Rule violations (❌ must address)
# - Unknown modules (❓ must clarify)
```

### Follow the Phase 0 Checklist

Open [PHASE_0_GOVERNANCE.md](./PHASE_0_GOVERNANCE.md) and work through:

1. Task 1: Run Dependency Analysis ✓
2. Task 2: Resolve Circular Dependencies
3. Task 3: Clarify Ambiguous Modules
4. Task 4: Create Module Ownership Matrix
5. Task 5: Create/Review ADRs (✓ Done)
6. Task 6: Set Up ESLint
7. Task 7: Set Up CI/CD
8. Task 8: Team Training

## 📖 Understanding the New Architecture

### Current Structure (Problems)
```
src/
├── auth/
├── trading/
├── insurance/
├── cache/
├── database/
├── config/
├── ... (50+ modules mixed together)
```

**Issues**:
- Hard to understand ownership
- Circular dependencies
- Business logic mixed with infrastructure
- Unclear boundaries

### New Structure (Solution)
```
src/
├── infrastructure/       (Database, Cache, Queues, etc.)
├── identity/            (Auth, Users, Permissions)
├── accounts/            (Future - Account Management)
├── market/              (Future - Market Data)
├── exchange/            (Future - Trading Engine)
├── protection/          (Future - Risk, Insurance)
├── settlement/          (Future - Settlement)
├── blockchain/          (Future - Blockchain Integration)
├── communications/      (Future - Notifications)
├── analytics/           (Future - Analytics)
├── intelligence/        (Future - ML, AI)
└── shared/              (Types, Enums, Constants)
```

**Benefits**:
- Clear ownership per domain
- Explicit dependency rules
- Easier to scale
- Better testing

## 🔑 Key Rules

### Dependency Hierarchy

```
Shared (Types, Constants)
    ↓
Infrastructure (Database, Cache, Logging, etc.)
    ↓
Identity (Auth, Users, Permissions)
    ↓
Accounts (Future)
    ↓
Market (Future)
    ↓
[... more domains ...]
```

**Golden Rule**: Dependencies flow **downward only**. No upward or sideways dependencies.

### Infrastructure Module Isolation

**Infrastructure CANNOT import from**:
- ❌ Identity modules
- ❌ Business domain modules
- ❌ Future domains

**Infrastructure CAN import from**:
- ✅ Other infrastructure modules
- ✅ Shared layer (types, constants)
- ✅ External npm packages

### Shared Layer

**Shared MUST contain only**:
- ✅ Type definitions
- ✅ Enums
- ✅ Constants
- ✅ Interfaces
- ✅ Pure utility functions

**Shared MUST NOT contain**:
- ❌ Services
- ❌ Repositories
- ❌ Business logic
- ❌ NestJS modules

## 🛠️ Tools & Scripts

### Dependency Analysis
```bash
npx ts-node tools/analyze-dependencies.ts
```
Generates `docs/DEPENDENCY_AUDIT.md` with:
- Dependency matrix
- Circular dependencies
- Rule violations
- Recommendations

### ESLint Architecture Check
```bash
npm run lint:architecture
```
Validates boundary rules are followed.

### Circular Dependency Detection
```bash
npx madge --circular src/
```
Finds circular imports.

## ❓ FAQ

### Q: When does Phase 1 start?
**A**: After Phase 0 is 100% complete and team is trained. Estimated: 2-3 weeks from now.

### Q: Will this break existing code?
**A**: Phase 0 is **analysis only** - no code changes. Phase 1 will migrate modules but we'll maintain tests and functionality throughout.

### Q: What if I have questions?
**A**: 
1. Check [PHASE_0_GOVERNANCE.md](./PHASE_0_GOVERNANCE.md)
2. Review relevant ADR
3. Ask in architecture review

### Q: Can I add new modules now?
**A**: Yes, but follow the new structure:
1. Put in appropriate domain folder
2. Follow module pattern
3. Export from domain module
4. Update architecture docs

### Q: What about legacy modules?
**A**: They'll be migrated to new structure during Phase 1. Don't refactor them yet.

## 📞 Contact & Support

- **Architecture Lead**: [TBD]
- **Documentation**: [PHASE_0_GOVERNANCE.md](./PHASE_0_GOVERNANCE.md)
- **Issues**: Create with `[ARCH]` label in GitHub

---

## Timeline

| Phase | Duration | What | Status |
|-------|----------|------|--------|
| **0** | 1-2 weeks | Governance, Planning, Setup | 🔄 In Progress |
| **1** | 1-2 weeks | Infrastructure Domain | ⏳ Next |
| **2** | 1-2 weeks | Identity Domain | 📅 After Phase 1 |
| **3+** | Ongoing | Business Domains | 📅 Future |

---

**Last Updated**: June 2026  
**Status**: Phase 0 - Governance & Planning  
**Approved By**: [TBD]

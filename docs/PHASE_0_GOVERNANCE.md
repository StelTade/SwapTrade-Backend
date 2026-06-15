# PHASE 0: Architecture Governance & Planning

## Overview

Phase 0 is the **foundation for all subsequent architectural work**. Do not skip this phase.

**Duration**: 1-2 weeks (depending on team size and codebase complexity)  
**Effort**: 1 senior engineer + code reviews  
**Goal**: Complete mapping of dependencies, resolve conflicts, establish governance  

---

## Tasks

### Task 1: Run Dependency Analysis [1 day]

**Objective**: Generate complete dependency map of all 50+ modules

**Steps**:

```bash
# 1. Install dependencies
npm install -D glob ts-node typescript

# 2. Run analysis script
npx ts-node tools/analyze-dependencies.ts
```

**Output**: 
- `docs/DEPENDENCY_AUDIT.md` - Complete dependency matrix
- Console report with summary

**Acceptance Criteria**:
- [ ] All modules identified and classified
- [ ] Dependency matrix complete
- [ ] Circular dependencies found (if any)
- [ ] Rule violations identified

**Example Output**:
```markdown
# Dependency Analysis Report

## Summary
- Total Modules: 52
- Infrastructure Modules: 8 (config, database, cache, queue, websocket, graphql, events, logging)
- Identity Modules: 6 (auth, user, roles, permissions, admin, kyc)
- Business Modules: 28 (trading, risk, insurance, etc.)
- Unknown Modules: 10 (platform, metrics, edge, etc.)
- Circular Dependencies: 3
- Rule Violations: 12

## Circular Dependencies Found

### Cycle 1: trading ↔ risk
- trading → risk.calculateMetrics()
- risk → trading.getOpenPositions()

### Cycle 2: portfolio ↔ trading ↔ risk
- portfolio → trading.getMetrics()
- trading → risk.assess()
- risk → portfolio.getValue()
```

**Next**: Fix the identified issues before moving forward.

---

### Task 2: Resolve Circular Dependencies [1-2 days]

**Objective**: Document and plan fixes for all circular dependencies

**Steps**:

1. **Analyze each cycle**:
   ```markdown
   ## Circular Dependency: trading ↔ risk
   
   Current Problem:
   - trading/ imports: risk.RiskService.calculateMetrics()
   - risk/ imports: trading.TradeService.getOpenPositions()
   
   Root Cause: Both need data from each other
   
   Resolution Strategy: Event-Based Communication
   - trading emits "trade.created" event
   - risk subscribes to event (no import needed)
   - Breaks the cycle
   ```

2. **Document resolution**:
   Create: `docs/CIRCULAR_DEPENDENCIES_RESOLUTION.md`

3. **Plan refactoring**:
   Create GitHub issues for each cycle:
   ```
   Issue: [ARCH-1] Fix Circular: trading ↔ risk
   Priority: HIGH
   Effort: 1-2 days
   Resolution: Use event-driven pattern
   Phase: Phase 1B (after infrastructure)
   ```

**Acceptance Criteria**:
- [ ] All cycles documented with root causes
- [ ] Resolution strategies defined for each
- [ ] GitHub issues created for Phase 1B work
- [ ] Team agreed on resolutions

**Output**: `docs/CIRCULAR_DEPENDENCIES_RESOLUTION.md`

---

### Task 3: Clarify Ambiguous Modules [1 day]

**Objective**: Determine the purpose and classification of unclear modules

**Ambiguous Modules** (from current codebase):

| Module | Questions | Classification | Action |
|--------|-----------|-----------------|--------|
| `platform/` | Generic platform logic? Core services? | ❓ UNKNOWN | Investigate use cases |
| `metrics/` | Metrics ≠ Monitoring. Difference? | ❓ UNKNOWN | Review code |
| `edge/` | Edge computing? Edge cases? Edge API? | ❓ UNKNOWN | Ask team |
| `scripts/` | Build scripts or domain scripts? | 🤔 MAYBE | Move to root |
| `performance/` | Performance monitoring or perf tricks? | 🤔 MAYBE | Review code |
| `mobile/` | Mobile-specific features? | 🤔 MAYBE | Review code |
| `advanced-analytics/` | Analytics or ML? | 🤔 MAYBE | Clarify scope |

**Steps**:

1. **Review code**:
   ```bash
   # For each ambiguous module:
   find src/MODULENAME -name "*.ts" | head -10
   # Read 5 key files to understand purpose
   ```

2. **Classify**:
   - Infrastructure: Database, cache, queues, monitoring, logging, etc.
   - Identity: Auth, users, roles, permissions, compliance, etc.
   - Business: Everything else

3. **Document decision**:
   ```markdown
   ## Module: platform
   
   **Current State**: Contains audit-entry, generic platform entities
   
   **Purpose**: Appears to be misnamed catch-all for core platform features
   
   **Decision**: RENAME to "system"
   - system/audit-log/ → infrastructure/audit-log/
   - system/admin/ → identity/admin/
   - system/other/ → [clarify each item]
   
   **Rationale**: platform is ambiguous; system is clearer
   **Owner**: [Team name]
   **Phase**: Phase 0 (Governance)
   ```

**Acceptance Criteria**:
- [ ] All ambiguous modules reviewed
- [ ] Each one classified or renamed
- [ ] Decisions documented
- [ ] Team consensus reached

**Output**: `docs/MODULE_CLARIFICATION.md`

---

### Task 4: Module Ownership Matrix [1 day]

**Objective**: Assign ownership to each module for maintenance

**File**: `docs/MODULE_OWNERSHIP.md`

```markdown
# Module Ownership Matrix

| Domain | Module | Owner (Team/Individual) | Primary Languages | Status | Notes |
|--------|--------|------------------------|--------------------|--------|-------|
| Infrastructure | config | DevOps Team | TypeScript, YAML | Active | Env config, validation |
| Infrastructure | database | Data Team | TypeScript, SQL | Active | ORM, migrations |
| Infrastructure | cache | DevOps Team | TypeScript | Active | Redis integration |
| Infrastructure | queue | DevOps Team | TypeScript | Active | Bull/BullMQ |
| Identity | auth | Auth Team | TypeScript | Active | JWT, 2FA, sessions |
| Identity | user | User Team | TypeScript | Active | User profiles, lifecycle |
| Exchange | trading | Trading Team | TypeScript | Planned | Matching engine |
| Protection | risk | Risk Team | TypeScript | Planned | Risk calculations |
| Protection | insurance | Insurance Team | TypeScript | Planned | Insurance fund |
| ... | ... | ... | ... | ... | ... |
```

**Steps**:

1. List all modules (from audit)
2. Identify primary team/owner for each
3. Note any shared ownership
4. Document rationale

**Acceptance Criteria**:
- [ ] All modules have an owner
- [ ] No module is orphaned
- [ ] Owners agree to their assignments
- [ ] Clear escalation path defined

---

### Task 5: Create ADRs & Architecture Documentation [1-2 days]

**Objective**: Document all architectural decisions and enforce them going forward

**ADRs Created** (already in place):
- ✅ ADR-001: Domain-Driven Design Adoption
- ✅ ADR-002: Infrastructure Module Isolation
- ✅ ADR-003: Dependency Hierarchy & Enforcement
- ✅ ADR-004: Shared Layer Guidelines

**Additional Documentation**:

**File**: `docs/ARCHITECTURE.md`

```markdown
# SwapTrade Backend Architecture

## Overview
[Visual dependency diagram]
[Domain descriptions]
[Module ownership]

## Domains
### Infrastructure Domain
### Identity Domain
### [Future domains]

## Dependency Rules
[Detailed rules]

## Development Guidelines
[How to follow the architecture]

## Escalation & Changes
[How to propose architectural changes]
```

**File**: `docs/ARCHITECTURE_QUICK_REFERENCE.md`

```markdown
# Architecture Quick Reference

## Can I depend on...?

- Infrastructure → Identity? NO
- Identity → Business? NO
- Business → Analytics? NO
- Infrastructure → Shared? YES
- Everything → Shared? YES

## How do I...?

### Add a new module?
1. Determine its domain
2. Create src/DOMAIN/MODULE/ directory
3. Follow module structure (entities, services, controllers, dtos)
4. Add to appropriate domain module
5. Update architecture docs

### Cross-domain communication?
1. Prefer events (pub/sub)
2. Use shared interfaces if needed
3. HTTP/GraphQL if fully separated
4. NEVER direct imports if it violates hierarchy

### Break the rules?
1. Document why (issue/PR)
2. Get architecture review approval
3. Create plan to fix it
4. Track it in backlog
```

**Acceptance Criteria**:
- [ ] ADR-001 through ADR-004 exist and are reviewed
- [ ] ARCHITECTURE.md complete with diagrams
- [ ] QUICK_REFERENCE.md accessible to all teams
- [ ] All decisions documented
- [ ] Team trained on documents

---

### Task 6: Set Up ESLint Boundary Enforcement [1 day]

**Objective**: Automated enforcement of dependency rules

**What to Install**:
```bash
npm install -D @nrwl/eslint-plugin-nx eslint-import-resolver-typescript
```

**Files to Create**:

1. **File**: `.eslintrc.json`

See: [docs/adr/ADR-003-dependency-hierarchy.md#eslint-configuration](../adr/ADR-003-dependency-hierarchy.md#eslint-configuration)

2. **File**: `eslint-rules.config.json`

```json
{
  "domains": {
    "shared": {
      "level": 0,
      "canImportFrom": ["shared"]
    },
    "infrastructure": {
      "level": 1,
      "canImportFrom": ["infrastructure", "shared"]
    },
    "identity": {
      "level": 2,
      "canImportFrom": ["identity", "infrastructure", "shared"]
    },
    "accounts": {
      "level": 3,
      "canImportFrom": ["accounts", "identity", "infrastructure", "shared"]
    }
  }
}
```

**File**: `tsconfig.json` - Add path aliases

```json
{
  "compilerOptions": {
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

**Validation**:
```bash
# Run ESLint
npm run lint

# Should report any boundary violations
```

**Acceptance Criteria**:
- [ ] ESLint installed and configured
- [ ] Path aliases in tsconfig.json
- [ ] Boundary rules define correctly
- [ ] Lint commands work

---

### Task 7: Set Up CI/CD Architecture Checks [1 day]

**Objective**: Prevent violations in pull requests

**File**: `.github/workflows/architecture-check.yml`

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
      
      - name: Lint Architecture Boundaries
        run: npm run lint -- --select-projects=architecture
      
      - name: Detect Circular Dependencies
        run: npm run check:circular
      
      - name: Run Dependency Analysis
        run: npm run analyze:dependencies
```

**Add to `package.json`**:
```json
{
  "scripts": {
    "lint": "eslint src --ext .ts",
    "check:circular": "madge --circular src/",
    "analyze:dependencies": "ts-node tools/analyze-dependencies.ts"
  }
}
```

**Acceptance Criteria**:
- [ ] CI workflow created
- [ ] Workflow runs on each PR
- [ ] Fails on boundary violations
- [ ] Team notified of failures

---

### Task 8: Team Training & Review [1 day]

**Objective**: Ensure all developers understand new architecture

**Steps**:

1. **Team Meeting** (1 hour):
   - Overview of domain-driven design
   - Explanation of 4 ADRs
   - Q&A

2. **Workshop** (2-3 hours, optional):
   - Live demo: Adding a new module
   - Live demo: How to use shared layer
   - Practice: Identifying violations in sample code

3. **Documentation Review**:
   - Each team reviews relevant docs
   - Infrastructure team reviews Infrastructure ADR
   - Identity team reviews Identity ADR
   - etc.

4. **Sign-Off**:
   - Each team lead signs off understanding
   - Link to training videos/slides in repo

**Acceptance Criteria**:
- [ ] Team meeting completed
- [ ] All developers understand hierarchy
- [ ] Questions answered
- [ ] Sign-offs collected

---

## Phase 0 Acceptance Criteria Checklist

### Documentation
- [ ] Dependency audit complete: `docs/DEPENDENCY_AUDIT.md`
- [ ] Circular dependencies documented: `docs/CIRCULAR_DEPENDENCIES_RESOLUTION.md`
- [ ] Module clarifications done: `docs/MODULE_CLARIFICATION.md`
- [ ] Module ownership matrix: `docs/MODULE_OWNERSHIP.md`
- [ ] ADR-001 through ADR-004 approved and reviewed
- [ ] ARCHITECTURE.md created with diagrams
- [ ] QUICK_REFERENCE.md accessible

### Technical Setup
- [ ] ESLint boundary rules configured
- [ ] TypeScript path aliases set up
- [ ] Dependency analysis script working
- [ ] CI/CD architecture checks in place
- [ ] Circular dependency detection tool (madge) working

### Team & Process
- [ ] All modules classified (Infrastructure, Identity, Business, Unknown → clarified)
- [ ] Module ownership assigned
- [ ] No unresolved circular dependencies (planned for Phase 1B)
- [ ] Architecture decisions documented in ADRs
- [ ] Team training completed
- [ ] Team sign-offs collected

### Ready for Phase 1?
- [ ] All acceptance criteria met
- [ ] Team consensus on architecture
- [ ] Circular dependency fixes planned (Phase 1B)
- [ ] Ambiguous modules classified
- [ ] Dependencies mapped
- [ ] Enforcement rules active
- [ ] Go/no-go decision made

---

## Output Files

At completion of Phase 0, you should have:

```
docs/
├── adr/
│   ├── ADR-001-domain-driven-design-adoption.md
│   ├── ADR-002-infrastructure-isolation.md
│   ├── ADR-003-dependency-hierarchy.md
│   └── ADR-004-shared-layer-guidelines.md
│
├── ARCHITECTURE.md                          # Main architecture guide
├── ARCHITECTURE_QUICK_REFERENCE.md          # Developer quick reference
├── DEPENDENCY_AUDIT.md                      # Complete module mapping
├── CIRCULAR_DEPENDENCIES_RESOLUTION.md      # Cycle resolution plans
├── MODULE_CLARIFICATION.md                  # Ambiguous module decisions
└── MODULE_OWNERSHIP.md                      # Team ownership matrix

tools/
└── analyze-dependencies.ts                  # Dependency analysis script

config/
└── eslint-rules.config.json                 # ESLint boundary config
```

---

## Timeline

| Day | Task | Effort | Owner |
|-----|------|--------|-------|
| 1 | Run dependency analysis | 1 day | 1 senior eng |
| 2-3 | Resolve circular dependencies | 1-2 days | Architecture team |
| 4 | Clarify ambiguous modules | 1 day | Architecture team |
| 4 | Create ownership matrix | 1 day | Team leads |
| 5 | Create/review ADRs | 1 day | Architecture team |
| 5 | Set up ESLint | 1 day | DevOps/Backend lead |
| 6 | Set up CI/CD | 1 day | DevOps |
| 7 | Team training | 1 day | All devs |
| **TOTAL** | | **~1 week** | |

---

## Success

**Phase 0 is complete when**:
- ✅ All modules understood and classified
- ✅ All circular dependencies documented with resolution plans
- ✅ All ownership assigned
- ✅ All rules automated via ESLint
- ✅ Team trained and aligned
- ✅ Ready to begin Phase 1 infrastructure migration

**Failure cases** (don't proceed if):
- ❌ Circular dependencies unresolved
- ❌ Modules still unclear
- ❌ Team not trained
- ❌ ESLint not working
- ❌ No consensus on architecture

---

## Next: Phase 1 — Infrastructure Domain

Once Phase 0 is approved and complete:

1. Create directory structure
2. Migrate modules one by one
3. Validate tests and imports
4. Review and merge

[See PHASE_1_INFRASTRUCTURE.md for details]

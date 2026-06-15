# Module Ownership Matrix

**Generated:** 2026-06-15  
**Phase:** 0 - Governance  
**Task:** 4 - Module Ownership  
**Status:** Requires Team Confirmation

---

## Executive Summary

This matrix defines ownership, status, and responsibility for all 55 modules in the SwapTrade Backend. Each module is assigned to a team that:
1. **Owns** the design and implementation
2. **Maintains** the code and tests
3. **Enforces** architecture rules
4. **Responds** to incidents

---

## Module Ownership Matrix

### Level 1: Infrastructure Modules (Current: 6 modules → Target: 15+ after Phase 0 Task 3)

| Module | Team | Status | Scope | Notes | Migration |
|--------|------|--------|-------|-------|-----------|
| config | DevOps/Platform | Active | Configuration management, environment setup, schema validation | Uses Joi for validation | No change needed |
| database | Infrastructure | Active | TypeORM setup, entity management, query optimization, caching | Critical path dependency | No change needed |
| cache | Infrastructure | Active | Redis integration, cache-manager, multi-level caching | High priority for optimization | No change needed |
| queue | Infrastructure | Active | Bull job queue, worker management, horizontal scaling, dead-letter handling | Requires monitoring setup | No change needed |
| websocket | Infrastructure | Active | Socket.io integration, real-time updates, gateway pattern | Performance critical | No change needed |
| graphql | Infrastructure | Active | Apollo server, schema composition, resolvers, dataloader | Integration with business domains | No change needed |
| events | Infrastructure | Planned | Event bus, event sourcing, publish-subscribe patterns | Needed for circular dependency resolution | Create new |
| logging | Infrastructure | Planned | Centralized logging, structured logs, observability | Consolidate from current scattered logging | Create new |
| monitoring | Infrastructure/DevOps | Planned | Prometheus metrics, Grafana dashboards, health checks, alerts | Move metrics/ and platform/ modules here | Consolidate 2 |
| scheduler | Infrastructure | Planned | Job scheduling, cron jobs, distributed scheduling | Move scheduler-related logic from queue | Extract from queue |
| rate-limiter | Infrastructure | Planned | Rate limiting, DDoS protection, quota management | Currently in ratelimit/ module | Rename ratelimit→rate-limiter |
| audit-log | Infrastructure | Planned | Audit trail, compliance logging, security events | Move from platform/ | Consolidate 1 |
| api-gateway | Infrastructure | Planned | Mobile API support, version management, request routing | Move mobile/ and add versioning | Create new |
| edge-computing | Infrastructure | Planned | CDN integration, edge caching, geographic distribution | Move edge/ module | Move/Rename 1 |
| security | Infrastructure | Planned | TLS/SSL, encryption, key management, certificate handling | Consolidate security concerns | Create new |

### Level 2: Identity & Access Modules (Current: 7 modules)

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| auth | Auth/Security Team | Active | JWT authentication, TOTP 2FA, session management, token validation | Core security module | No change needed |
| user | User Mgmt Team | Active | User profiles, user metadata, preferences, status management | Core business object | No change needed |
| kyc | Compliance Team | Active | Know-Your-Customer verification, KYC state machine, identity validation | Regulatory requirement | No change needed |
| compliance | Compliance Team | Active | Compliance rules, regulatory checks, audit compliance | Regulatory requirement | No change needed |
| roles | Auth/Security Team | Active | Role-based access control (RBAC), role hierarchy, permissions | Part of auth system | No change needed |
| permissions | Auth/Security Team | Active | Permission definitions, permission checks, authorization | Part of auth system | No change needed |
| privacy | Privacy Team | Active | Data privacy, encryption, GDPR compliance, data export, anonymization | Privacy requirement | No change needed |
| admin | Admin Team | Active | Administrative functions, system admin dashboard, user management | Requires careful access control | No change needed |
| did | Identity Team | Planned | Decentralized identifiers, digital identity, self-sovereign identity | Blockchain-based identity | Keep separate |
| quantum-crypto | Security Team | Planned | Quantum-resistant cryptography, post-quantum algorithms | Future security enhancement | New module |

### Level 3: Business Domain - Accounts & Balances

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| user | User Mgmt Team | Active | User accounts, profiles, data | Core entity | No change |
| balance | Trading Finance | Active | Account balances, balance history, multi-asset support | Core business object | No change |
| account-hierarchy | Finance/Admin | Planned | Sub-accounts, account relationships, master-slave accounts | Planned feature | Create new |
| wallets | Trading Finance | Planned | Wallet management, multi-sig wallets, HD wallets | Currently in portfolio/ | Extract/Consolidate |

### Level 4: Business Domain - Market & Exchange

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| trading | Trading/Exchange | Active | Core trading engine, order matching, trade execution | Critical path | No change |
| market-data | Market Data Team | Active | Market data feeds, price aggregation, historical data | Data ingestion | No change |
| market-data-exchange | Market Data Team | Active | Exchange-specific data, order book snapshots | Data management | Consolidate with market-data |
| market-surveillance | Compliance Team | Active | Market surveillance, anomaly detection, suspicious patterns | Regulatory requirement | No change |
| price-prediction | Analytics/ML Team | Planned | Price prediction, time-series forecasting, ML models | Advanced analytics | Keep separate |
| ml-pipeline | Analytics/ML Team | Planned | ML training, model versions, performance tracking | Model management | Keep separate |

### Level 5: Business Domain - Settlements & Execution

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| settlement | Finance/Trading | Active | Trade settlement, batch processing, multi-currency settlement | Critical for compliance | No change |
| swap | Exchange/DeFi Team | Active | Token swaps, AMM integration, swap pricing, settlement | DeFi feature | No change |
| liquidity | DeFi/Exchange | Active | Liquidity pools, DEX integration, liquidity provision | DeFi infrastructure | No change |
| liquidity-mining | Incentives Team | Active | Liquidity mining rewards, incentive programs | Incentive mechanism | No change |

### Level 6: Business Domain - Cross-Chain & Blockchain

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| cross-chain | Blockchain Team | Active | Cross-chain bridging, multi-chain support, asset wrapping | Blockchain infrastructure | No change |
| blockchain-settlement | Blockchain Team | Planned | On-chain settlement, smart contracts, blockchain finality | Blockchain operations | Create new |
| stellar | Blockchain/Payments | Active | Stellar network integration, Stellar SDK | Blockchain ecosystem | No change |
| defi | DeFi Team | Active | DeFi protocol integration, yield optimization, risk assessment | DeFi protocols | No change |
| nft | NFT Team | Planned | NFT marketplace, fractional NFTs, NFT lending | NFT platform features | New module |

### Level 7: Business Domain - Risk & Insurance

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| insurance | Risk/Insurance Team | Active | Insurance fund, claims processing, fund health monitoring | Risk mitigation | No change |
| risk | Risk Management Team | Active | Risk assessment, portfolio risk, counterparty risk | Risk analytics | No change |
| options | Options Trading Team | Planned | Options trading, derivatives, options strategies | Financial instruments | Keep separate |

### Level 8: Business Domain - Analytics & Intelligence

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| analytics | Business Analytics | Active | Trading analytics, reporting, dashboards | Business intelligence | No change |
| advanced-analytics | Analytics/ML Team | Active | Portfolio analytics, compute bridge, advanced metrics | Advanced analytics | Rename to business/analytics |
| portfolio-analytics | Portfolio Team | Active | Portfolio composition analytics, rebalancing analysis | Portfolio analytics | Consolidate with portfolio/ |
| learning-leaderboard | Product/Gamification | Planned | Learning platform, leaderboards, achievement tracking | Engagement feature | New module |

### Level 9: Business Domain - Portfolio Management

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| portfolio | Portfolio Team | Active | Portfolio management, asset allocation, portfolio services | Core business | No change |
| rewards | Incentives Team | Active | Reward distribution, loyalty programs, bonus system | User engagement | No change |
| bidding | Auction/Exchange Team | Active | Auction system, bidding engine, presence tracking | Market mechanism | No change |

### Level 10: Business Domain - Referrals & Social

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| referral | Partnerships/Marketing | Active | Referral program, affiliate system, referral tracking | Growth mechanism | No change |
| social-trading | Social Team | Planned | Social trading, trader following, signal sharing | Social features | Create new |

### Level 11: Business Domain - Governance & Platform

| Module | Team | Status | Scope | Notes | Action |
|--------|------|--------|-------|-------|--------|
| governance | Platform Team | Active | Governance parameters, protocol settings, voting | Protocol governance | No change |
| notification | Product/Platform | Active | Notifications, alerts, user communications (email, SMS) | User engagement | No change |
| alerts | Platform/Trading | Active | Price alerts, trade alerts, custom alerts | User feature | No change |
| export | Platform/Compliance | Active | Data export, trading history export, CSV/XLSX generation | Data access | No change |
| tutorial | Product/Learning | Planned | Interactive tutorials, onboarding, learning content | User onboarding | Create new |
| tasks | DevOps/Platform | Planned | Background tasks, scheduled jobs, system maintenance | System operations | Create new |
| bot-trading | Automation Team | Planned | Trading bots, bot strategies, bot automation | Automation feature | Extract from trading/ |

### Legacy/Unclear Modules (To be reorganized in Phase 1)

| Module | Team | Status | Action | Notes |
|--------|------|--------|--------|-------|
| platform | Infrastructure | Phase Out | Move to infrastructure + business/core | Consolidate into infrastructure |
| metrics | Infrastructure/DevOps | Phase Out | Move to infrastructure/monitoring | Consolidate |
| edge | Infrastructure | Phase Out | Move to infrastructure/edge-computing | Move and reorganize |
| performance | Infrastructure | Phase Out | Split between infrastructure and business | Separate concerns |
| mobile | Infrastructure | Phase Out | Move to infrastructure/api-gateway | Consolidate |

---

## Team Responsibility Matrix

### DevOps/Platform Team
- **Modules:** config, database, monitoring/metrics
- **Responsibility:** Infrastructure provisioning, deployment, monitoring, configuration management
- **SLA:** 99.9% uptime, < 5min incident response
- **Escalation:** VP Engineering → CTO

### Infrastructure Team
- **Modules:** cache, queue, websocket, graphql, events, logging, scheduler, rate-limiter, security, edge-computing, api-gateway
- **Responsibility:** Core infrastructure, scalability, performance, reliability
- **SLA:** 99.95% uptime, < 10min P1 response
- **Escalation:** VP Engineering → CTO

### Auth/Security Team
- **Modules:** auth, roles, permissions, quantum-crypto
- **Responsibility:** Authentication, authorization, security, compliance
- **SLA:** Zero security incidents, < 2hr P1 response
- **Escalation:** CISO → CTO

### Compliance Team
- **Modules:** kyc, compliance, market-surveillance
- **Responsibility:** Regulatory compliance, KYC/AML, audit trails
- **SLA:** All regulatory deadlines met, zero violations
- **Escalation:** Compliance Officer → CEO

### Trading/Exchange Team
- **Modules:** trading, settlement, market-data
- **Responsibility:** Order execution, settlement, market connectivity
- **SLA:** 99.99% uptime (trading critical), < 1min P1 response
- **Escalation:** VP Trading → CTO

### Portfolio/Finance Team
- **Modules:** portfolio, balance, rewards, risk
- **Responsibility:** Portfolio management, balance tracking, financial analytics
- **SLA:** 99.9% uptime, < 10min P1 response
- **Escalation:** CFO → CTO

### Business Analytics Team
- **Modules:** analytics, advanced-analytics, portfolio-analytics
- **Responsibility:** Business intelligence, reporting, data analysis
- **SLA:** Data freshness < 1hr, < 24hr P1 response
- **Escalation:** VP Product → CTO

### DeFi/Blockchain Team
- **Modules:** defi, swap, liquidity, cross-chain, stellar, nft
- **Responsibility:** DeFi protocols, blockchain integration, smart contracts
- **SLA:** 99.9% uptime, < 10min P1 response
- **Escalation:** VP DeFi → CTO

### Platform/Product Team
- **Modules:** notification, alerts, export, governance, tutorial, tasks
- **Responsibility:** User-facing features, product experience, automation
- **SLA:** 99.5% uptime, < 1hr P2 response
- **Escalation:** VP Product → CTO

### Privacy/Identity Team
- **Modules:** privacy, user, did
- **Responsibility:** Data privacy, identity management, GDPR/regulatory compliance
- **SLA:** 100% compliance, < 24hr incident response
- **Escalation:** Privacy Officer → CEO

---

## Governance Policies

### Module Creation
1. **Prerequisite:** Proposal document approved by Architecture & affected teams
2. **Template:** Must follow ADR-004 (Shared Layer Guidelines)
3. **Review:** Architecture review before first PR
4. **Ownership:** Team assigned in this matrix

### Module Changes
1. **Small Changes:** Team owner approves + 1 peer review
2. **Large Refactoring:** Architecture review required
3. **Cross-Module Changes:** Review from both teams + Architecture
4. **Dependency Changes:** Must validate with dependency analysis tool

### Module Deprecation
1. **Announcement:** 2-week notice to all teams
2. **Migration:** Alternative module or deprecation path provided
3. **Removal:** Only after all dependent code migrated
4. **Archive:** Old module moved to `archive/` for historical reference

---

## Accountability Framework

### Code Quality
- **Test Coverage:** 80%+ for new code
- **Linting:** 100% compliance with ESLint rules
- **Type Safety:** No `any` types without justification
- **Documentation:** All public APIs documented

### Architecture Compliance
- **Dependency Rules:** 100% compliance with ADR-003
- **Circular Dependencies:** Zero in production
- **Module Boundaries:** Enforced by ESLint + CI/CD
- **API Versioning:** Semantic versioning for breaking changes

### Performance
- **Response Time:** < 200ms P95 for API endpoints
- **Memory Usage:** No leaks, < 1GB per pod
- **Database:** Query optimization, < 500ms P95
- **Cache Hit Rate:** > 80% for hot paths

### Security
- **Authentication:** All endpoints require auth (except public)
- **Authorization:** Enforce RBAC on all operations
- **Data Encryption:** TLS in transit, AES-256 at rest
- **Audit Logging:** All sensitive operations logged

---

## Next Steps

1. ✅ Phase 0 Task 1: DEPENDENCY_AUDIT.md (Complete)
2. ✅ Phase 0 Task 2: CIRCULAR_DEPENDENCIES_RESOLUTION.md (Complete)
3. ✅ Phase 0 Task 3: MODULE_CLARIFICATION.md (Complete)
4. ✅ Phase 0 Task 4: MODULE_OWNERSHIP.md (THIS DOCUMENT)
5. ⏳ Phase 0 Task 5: Review ADRs with teams
6. ⏳ Phase 0 Task 6: Set up ESLint enforcement
7. ⏳ Phase 0 Task 7: Set up CI/CD architecture checks
8. ⏳ Phase 0 Task 8: Team training and sign-offs

---

## Approval Tracking

**Requires Sign-Off From:**

- [ ] VP Engineering (Infrastructure & Overall)
- [ ] VP Trading (Trading/Exchange)
- [ ] VP Product (Product/Platform)
- [ ] VP DeFi (Blockchain/DeFi)
- [ ] CFO (Finance/Risk)
- [ ] CISO (Security)
- [ ] Compliance Officer (Compliance)

**When all boxes are checked:** Proceed to Phase 0 Task 5

---

**Version:** 1.0  
**Last Updated:** 2026-06-15  
**Status:** DRAFT - Awaiting Team Confirmation

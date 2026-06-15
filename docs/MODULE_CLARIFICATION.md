# Module Clarification Report

**Generated:** 2026-06-15T21:17:04.310Z
**Phase:** 0 - Governance
**Task:** 3 - Module Clarification

## Executive Summary

Investigating purpose and correct placement of 6 ambiguous modules.

## Module Analyses

### platform

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\platform`
**Files:** 5 TypeScript files
```
audit.service.ts
mobile-cache.service.ts
mobile-metrics.service.ts
platform.controller.ts
platform.module.ts
```

**Service Class:** `AuditService`
**Public Methods:** constructor
**API Routes:** health, metrics/mobile, audit
**Imports:** TypeOrmModule.forFeature([AuditEntry

### metrics

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\metrics`
**Files:** 5 TypeScript files
```
metrics.controller.ts
metrics.interceptor.ts
metrics.module.ts
metrics.service.ts
typeorm-logger.ts
```

**Service Class:** `MetricsService`
**Public Methods:** constructor, collectDefaultMetrics, getContentType, recordHttpRequest, recordDbQuery...
**API Routes:** metrics

### edge

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\edge`
**Files:** 9 TypeScript files
```
cdn-integration.service.ts
edge-cache.service.ts
edge-computing.service.ts
edge-metrics.service.ts
edge.controller.ts
edge.module.ts
geographic-distribution.service.ts
request-deduplication.service.ts
response-optimization.service.ts
```

**Service Class:** `CdnIntegrationService`
**Public Methods:** constructor, if, getCacheControl, getCacheHeaders, switch...
**API Routes:** status, metrics, metrics/latest...
**Imports:** ConfigModule.forFeature(edgeConfig)

### performance

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\performance`
**Files:** 6 TypeScript files
```
caching.service.ts
performance-dashboard.controller.ts
performance.controller.ts
performance.module.ts
performance.service.spec.ts
performance.service.ts
```

**Service Class:** `CachingService`
**Public Methods:** constructor, if
**API Routes:** dashboard, metrics, database...
**Imports:** TypeOrmModule.forFeature([
      UserBalance, Trade, Bid...

### mobile

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\mobile`
**Files:** 3 TypeScript files
```
mobile.controller.ts
mobile.module.ts
mobile.service.ts
```

**Service Class:** `MobileService`
**Public Methods:** constructor, if, createEtag
**API Routes:** dashboard/:userId, options
**Imports:** GovernanceModule, OptionsModule, LiquidityMiningModule

### advanced-analytics

**Location:** `C:\Users\u-adamu\Desktop\akargi\SwapTrade-Backend\src\advanced-analytics`
**Files:** 3 TypeScript files
```
advanced-analytics.module.ts
advanced-analytics.service.ts
compute-bridge.service.ts
```

**Service Class:** `AdvancedAnalyticsService`
**Public Methods:** constructor, onModuleInit, onModuleDestroy, if, clearInterval...

## Recommended Decisions

### 1. `platform/` Module

**Finding:** Contains mobile metrics, caching, and audit services.
**Current Issue:** Unclear purpose - unclear if platform abstraction or mobile-specific.
**Recommendation:** MOVE to Infrastructure
- `platform/audit-service` → `infrastructure/audit-log/`
- `platform/mobile-metrics` → `infrastructure/monitoring/mobile-metrics`
- `platform/mobile-cache` → `infrastructure/cache/mobile-extensions`
**Rationale:** All services are infrastructure-level concerns, not business domain.
**Timeline:** 1 day
**Owner:** Infrastructure Team

### 2. `metrics/` Module

**Finding:** Express server, Prometheus metrics, interceptors.
**Current Issue:** Could be infrastructure/monitoring OR business analytics.
**Analysis:**
- `metrics.service` uses `prom-client` (Prometheus)
- `metrics.controller` exposes `/metrics` endpoint
- Used for system monitoring, not business analytics
**Recommendation:** MOVE to Infrastructure as `infrastructure/monitoring/`
**Rationale:** System-level metrics collection, not business domain.
**Timeline:** 1 day
**Owner:** DevOps/Infrastructure Team

### 3. `edge/` Module

**Finding:** CDN integration, edge computing, geographic distribution, caching.
**Current Issue:** Purpose unclear - could be infrastructure or content delivery.
**Analysis:**
- `edge-computing.service` - distributed computation
- `cdn-integration.service` - CDN connectivity
- `geographic-distribution.service` - location-based routing
- `response-optimization.service` - compression and optimization
**Recommendation:** MOVE to Infrastructure as `infrastructure/edge-computing/`
**Rationale:** Edge computing is infrastructure service for performance optimization.
**Timeline:** 1-2 days
**Owner:** Infrastructure Team

### 4. `performance/` Module

**Finding:** Caching, optimization, performance monitoring services.
**Current Issue:** Mixed concerns - caching is infrastructure, performance analysis is cross-cutting.
**Analysis:**
- `caching.service` - cache management
- `performance.service` - performance metrics and monitoring
- Depends on: database, graphql, balance, trading, bidding, user
**Recommendation:** SPLIT
- Performance monitoring → `infrastructure/monitoring/performance`
- Caching optimization utilities → `infrastructure/cache/optimization`
- Cross-module optimization logic → Merge into `advanced-analytics` or create `business/optimization`
**Rationale:** Clear separation of infrastructure vs. business analytics.
**Timeline:** 2 days
**Owner:** Architecture Team + Infrastructure Team

### 5. `mobile/` Module

**Finding:** Mobile-specific services for Express server, compression, platform integration.
**Current Issue:** Unclear if this is API gateway layer or mobile business logic.
**Analysis:**
- Uses `express`, `zlib`, `platform` module
- Imports from governance, liquidity-mining, mobile services
**Recommendation:** MOVE to Infrastructure as `infrastructure/api-gateway/mobile-support`
**Rationale:** Mobile-specific API handling and optimization belongs in infrastructure layer.
**Timeline:** 1 day
**Owner:** Infrastructure Team

### 6. `advanced-analytics/` Module

**Finding:** Portfolio analytics, compute-bridge, crypto services, ML inference.
**Current Issue:** Purpose is clearer but scope is very large - multiple concerns.
**Analysis:**
- `compute-bridge.service` - external computation
- `portfolio-analytics` - specific business domain
- Depends on: controllers, services, portfolio, trading, advanced-analytics
**Recommendation:** KEEP in Business Domain, but refactor:
- Rename to `business/analytics/` (moved from root to business domain)
- Split into clear sub-services:
  - `portfolio-analytics.service`
  - `compute-bridge.service`
  - `crypto-analysis.service`
- Create separate `business/ml-inference/` if ML is significant enough
**Rationale:** Analytics is business domain, not infrastructure.
**Timeline:** 2-3 days (refactoring)
**Owner:** Analytics Team


## Clarification Summary

| Module | Current Location | Decision | New Location | Days | Owner |
|--------|------------------|----------|--------------|------|-------|
| platform | Root | MOVE | infrastructure/platform | 1 | Infrastructure |
| metrics | Root | MOVE | infrastructure/monitoring | 1 | DevOps/Infrastructure |
| edge | Root | MOVE | infrastructure/edge-computing | 1-2 | Infrastructure |
| performance | Root | SPLIT | infrastructure/ + business/ | 2 | Architecture + Infrastructure |
| mobile | Root | MOVE | infrastructure/api-gateway | 1 | Infrastructure |
| advanced-analytics | Root | REFACTOR | business/analytics | 2-3 | Analytics |

**Total Timeline:** 8-10 days
**Can run in parallel:** Yes, most modules are independent

## Priority Order

1. (Day 1-2) `platform/`, `metrics/`, `mobile/` - Move to infrastructure (parallel)
2. (Day 3-4) `edge/` - Move to infrastructure
3. (Day 5-6) `performance/` - Split between infrastructure and business
4. (Day 7-10) `advanced-analytics/` - Refactor and reorganize

**Go/No-Go Decision:** After these 6 modules are clarified, proceed to Phase 1.

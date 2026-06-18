# Dependency Analysis Report

Generated: 2026-06-17T21:54:03.006Z

## Summary

- Total Modules: 19
- Infrastructure Modules: 6
- Identity Modules: 8
- Business Modules: 0
- Unknown Modules: 5
- Circular Dependencies: 29
- Rule Violations: 4

## Dependency Matrix

| Module | Type | Dependencies | Module File |
|--------|------|--------------|-------------|
| admin | identity | dto, admin.controller, admin.service, user, identity | ✓ |
| audit-log | infrastructure | dto, audit-log.service, audit-log.controller, create-audit-log.dto | ✓ |
| auth | identity | entities, mfa.service, dto, auth.controller, auth.service, mfa.controller | ✓ |
| compliance | identity | entities, controller, services, did, audit-log, user, compliance-rule.entity | ✓ |
| config | infrastructure | configuration, config.service, config.module, config.schema, config-documentation.generator, config-audit.service | ✓ |
| database | infrastructure | entities, services, database.controller, database.service, user, multi-level-cache.service, database-sharding.service, query-optimization.service, performance-monitoring.service, optimized-query.service, database-load-balancer.service, virtual-asset.entity | ✓ |
| did | identity | entities, services, controllers | ✓ |
| error | unknown | errors, exceptions, filters, constants, enums, error-code.registry, registries, services, error.module, error.controller, error.service, error-codes | ✓ |
| graphql | infrastructure | scalars, user, trading, portfolio, loaders, advanced-analytics | ✓ |
| i18n | unknown | _none_ | ✗ |
| identity | unknown | identity.module, auth, user, admin, kyc, compliance, privacy, did, permissions, user.module, services, enums, constants, role-metadata, role.service, user-role.enum, role-hierarchy, privacy.module, roles, guards, decorators, permissions.module, kyc.module, did.module, compliance.module, auth.module, admin.module, admin.controller, dto | ✓ |
| infrastructure | unknown | config, database, cache, queue, websocket, graphql, events, logging, monitoring, scheduler, rate-limiter, audit-log, infrastructure.module, websocket.module, scheduler.module, ratelimit, rate-limiter.module, queue.module, monitoring.module, metrics, logging.module, graphql.module, events.module, domain.events, events.constants, database.module, config.module, common.module, cache.module, audit-log.module | ✓ |
| kyc | identity | enum, kyc-state-machine.service, entities, kyc.service, guards, kyc.controller, roles.decorator, create-kyc.dto | ✓ |
| permissions | identity | action.enum, guards, decorators | ✓ |
| privacy | identity | services, entities, privacy.controller, privacy.module, dto, privacy-encryption.service, user | ✓ |
| queue | infrastructure | horizontal-scaling.config, queue.service, queue-monitoring.service, queue-analytics.service, queue.constants, scheduler.service, scheduler-failover.service, dead-letter-queue.service, processors, scheduler.controller, exponential-backoff.service, queue.controller, queue-admin.controller, user, auth, queue.config, queue-worker-manager.service, queue-load-balancer.service, queue-fault-tolerance.service, message-deduplication.service, message-ordering.service, dynamic-scaling.service, horizontal-scaling-monitoring.service, zero-loss-message.service, load-testing.service, horizontal-scaling.controller | ✓ |
| ratelimit | unknown | ratelimit.config, ratelimit.service, rate-limit.service, rate-limit.guard, config, rate-limit.decorator | ✓ |
| user | identity | database, entities, dto, user.service, user.controller | ✓ |
| websocket | infrastructure | services, gateway, guards, events, middleware, interfaces, stream-manager.service | ✓ |

## ⚠️ Circular Dependencies Found

### Cycle 1
```
user → database → user
```

### Cycle 2
```
user → entities
```

### Cycle 3
```
user → dto
```

### Cycle 4
```
auth → entities
```

### Cycle 5
```
auth → dto
```

### Cycle 6
```
admin → identity → admin
```

### Cycle 7
```
kyc → entities
```

### Cycle 8
```
compliance → entities
```

### Cycle 9
```
compliance → services
```

### Cycle 10
```
did → entities
```

### Cycle 11
```
did → services
```

### Cycle 12
```
audit-log → dto
```

### Cycle 13
```
privacy → services
```

### Cycle 14
```
privacy → entities
```

### Cycle 15
```
privacy → dto
```

### Cycle 16
```
permissions → guards
```

### Cycle 17
```
identity → services
```

### Cycle 18
```
identity → privacy.module
```

### Cycle 19
```
identity → guards
```

### Cycle 20
```
identity → decorators
```

### Cycle 21
```
identity → admin.controller
```

### Cycle 22
```
identity → dto
```

### Cycle 23
```
error → constants
```

### Cycle 24
```
error → enums
```

### Cycle 25
```
error → services
```

### Cycle 26
```
websocket → services
```

### Cycle 27
```
websocket → guards
```

### Cycle 28
```
infrastructure → events
```

### Cycle 29
```
infrastructure → config.module
```

## 🚨 Architecture Rule Violations

- **database** → **user**: Infrastructure module cannot depend on identity module
- **graphql** → **user**: Infrastructure module cannot depend on identity module
- **queue** → **user**: Infrastructure module cannot depend on identity module
- **queue** → **auth**: Infrastructure module cannot depend on identity module

## Recommendations

### Clarify Unknown Modules
The following modules have unclear classification:
- **error**: Determine if this is infrastructure, identity, or business logic
- **i18n**: Determine if this is infrastructure, identity, or business logic
- **identity**: Determine if this is infrastructure, identity, or business logic
- **infrastructure**: Determine if this is infrastructure, identity, or business logic
- **ratelimit**: Determine if this is infrastructure, identity, or business logic

### Next Steps
1. Review and resolve circular dependencies
2. Fix architecture rule violations
3. Clarify unknown modules
4. Update module classifications as needed

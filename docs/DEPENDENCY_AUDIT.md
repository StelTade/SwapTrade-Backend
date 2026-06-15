# Dependency Analysis Report

Generated: 2026-06-15T21:13:23.554Z

## Summary

- Total Modules: 55
- Infrastructure: 6
- Identity: 7
- Business/Other: 42
- Circular Dependencies: 11

## Dependency Matrix

| Module | Dependencies | Module File |
|--------|--------------|-------------|
| admin | admin.service, waitlist, dto, admin.controller, typeorm, class-validator, class-transformer | ✓ |
| advanced-analytics | controllers, advanced-analytics.service, compute-bridge.service, crypto, axios, rxjs, interfaces, dto, portfolio-analytics, express, class-validator, class-transformer | ✓ |
| alerts | bull, entities, alert.service, notification, websocket, queue, dto, alert-evaluation.service, alert.processor, alert.controller, price-prediction, predictive-alert.service, typeorm, class-validator, create-alert.dto | ✗ |
| analytics | controllers, services, user, trading, auth, interfaces, class-validator, typeorm | ✓ |
| audit-log | audit-log.controller, audit-log.service, dto, notification, src, typeorm, crypto, class-validator, class-transformer, create-audit-log.dto | ✓ |
| auth | auth.service, dto, auth.controller, mfa.controller, mfa.service, entities, typeorm, bcryptjs, speakeasy, class-validator, otplib, qrcode | ✓ |
| balance | typeorm, balance.controller, balance.service, dto, service, entities, trading, balance-audit.entity, balance.entity, user-balance.entity, class-validator, user | ✓ |
| bidding | typeorm, entities, auction-timer.service, balance, dto, bidding.service, bidding.controller, bidding.gateway, auction, presence, replay, redis, errors, class-validator, user, ioredis, config, socket.io | ✓ |
| compliance | entities, controller, services, did, audit-log, auth, typeorm, user, compliance-rule.entity | ✓ |
| config | config.service, fs, path, config.schema, config-documentation.generator, config-audit.service, joi, config.module, configuration, class-validator, class-transformer | ✓ |
| cross-chain | bridge.service, cross-chain-routing.service, cross-chain.controller | ✓ |
| database | typeorm, trading, balance, user, portfolio, rewards, notification, bidding, referral, waitlist, social-trading, database.service, services, market-surveillance, database.controller, rxjs, optimized-query.service, multi-level-cache.service, database-load-balancer.service, database-sharding.service, performance-monitoring.service, ioredis, cache-manager, query-optimization.service | ✓ |
| defi | services, dto, class-validator, typeorm, protocol.interface, base.adapter, interfaces, ethers, protocol-factory.service, risk-assessment.service, yield-optimizer.service, smart-contract.service, transaction-simulator.service, entities, aave.adapter, compound.adapter | ✗ |
| did | services, typeorm, entities, controllers, ethers, crypto | ✓ |
| edge | edge-computing.service, cdn-integration.service, response-optimization.service, edge-cache.service, request-deduplication.service, geographic-distribution.service, edge-metrics.service, edge.controller, uuid, zlib, util | ✓ |
| error | error-codes, error.service, error.controller, error-code.registry, errors, constants, express, nestjs-i18n, exceptions, filters, enums, registries, services, error.module, uuid, async_hooks | ✓ |
| export | class-validator, class-transformer, express, export.service, dto, trading, balance, export.controller, typeorm, services, xlsx, csv-writer, path, fs | ✓ |
| governance | class-validator, entities, typeorm, dto, governance-parameter.service, platform, governance-parameter-definitions, governance.service, governance-parameter.controller, governance.controller | ✓ |
| graphql | path, scalars, user, trading, portfolio, advanced-analytics, resolvers, dataloader, loaders | ✓ |
| i18n | _none_ | ✗ |
| insurance | class-validator, entities, typeorm, insurance-fund.entity, services, dto, insurance.controller, insurance-claim.service, fund-health-monitoring.service | ✓ |
| kyc | create-kyc.dto, class-validator, typeorm, enum, roles.decorator, entities, kyc.controller, kyc.service, guards, kyc-state-machine.service | ✓ |
| liquidity-mining | class-validator, typeorm, dto, liquidity-mining.service, entities, liquidity-mining.controller, platform | ✓ |
| market-data | class-validator, class-transformer, services, exchange-rate.service, axios, market-data.service, trading, dto, market-data.controller, exchange-rate.controller, stellar.service, typeorm, interfaces, providers, websocket, ws, cache-manager, config, stellar-sdk | ✓ |
| market-data-exchange | typeorm, services, market-data-exchange.controller, entities | ✓ |
| market-surveillance | class-validator, class-transformer, entities, typeorm, anomaly-alert.entity, order-book-snapshot.entity, suspicious-actor.entity, violation-event.entity, heatmap-metric.entity, pattern-template.entity, services, dto, market-surveillance.controller, supertest, market-surveillance.module, pattern-detection.service, ml-inference.service, alerting.service, actor-throttling.service, visualization.service, backtest.service | ✓ |
| metrics | express, metrics.service, rxjs, metrics.controller, metrics.interceptor, prom-client, typeorm | ✓ |
| ml-pipeline | model-version.entity, performance-metrics.entity, training-job.entity, typeorm, services, ml-pipeline.controller, entities, uuid | ✓ |
| mobile | express, zlib, platform, mobile.service, governance, liquidity-mining, options, mobile.controller, crypto | ✓ |
| nft | nft-marketplace.service, fractional-nft.service, nft-lending.service, nft.controller | ✓ |
| notification | class-validator, class-transformer, entities, typeorm, notification.entity, notification.service, dto, notification.controller, nodemailer, twilio, handlebars, src | ✓ |
| options | class-validator, entities, typeorm, dto, options.service, options.controller, platform | ✓ |
| performance | cache-manager, services, database, graphql, performance.service, performance.controller, caching.service, balance, trading, bidding, user, typeorm | ✓ |
| platform | typeorm, entities, audit.service, mobile-metrics.service, mobile-cache.service, platform.controller | ✓ |
| portfolio | entities, controller, services, auth, dto, class-validator, class-transformer, typeorm, user, crypto, logging, interceptors, rxjs, decorators, controllers, web3.service, wallet.service, ethers, portfolio.service, ai-optimization, portfolio.repository, balance, trading, cache-manager, risk, src | ✓ |
| portfolio-analytics | class-validator, class-transformer, entities, typeorm, express, services, portfolio-analytics.controller, portfolio, trading, portfolio-analytics.service, dto | ✓ |
| price-prediction | price-prediction.service, dto, class-transformer, class-validator, interfaces, controllers, models, services, price-prediction.constants, backtesting.service, axios, simple-statistics | ✓ |
| privacy | class-validator, entities, typeorm, user, services, dto, privacy.module, privacy.controller, uuid, privacy-encryption.service, crypto, libsodium-wrappers | ✓ |
| quantum-crypto | auth, services, entities, typeorm, user, quantum-key.entity, controller, quantum-key-service, crypto | ✓ |
| queue | bull, queue.constants, queue.config, horizontal-scaling.config, queue-worker-manager.service, queue-load-balancer.service, queue-fault-tolerance.service, message-deduplication.service, message-ordering.service, dynamic-scaling.service, horizontal-scaling-monitoring.service, zero-loss-message.service, load-testing.service, horizontal-scaling.controller, crypto, queue.service, exponential-backoff.service, dead-letter-queue.service, queue-analytics.service, queue-monitoring.service, scheduler.service, auth, processors, scheduler-failover.service, scheduler.controller, queue.controller, queue-admin.controller, notification, user, trading, swap | ✓ |
| ratelimit | config, express, rate-limit.decorator, rate-limit.service, ratelimit.config, ratelimit.service, rate-limit.guard | ✓ |
| referral | affiliate.service, entities, typeorm, user, notification, crypto, class-validator, class-transformer, affiliate.entity, dto, referral.entity, referral.service.extended, referral-admin.service, audit-log, qrcode, referral.service, referral-code.service, referral.controller, referral-admin.controller, src, leaderboard.controller, referral.tracking.middleware, affiliate.controller, balance, express, ioredis | ✓ |
| rewards | bug-bonus.service, entities, typeorm, user, balance, notification, services, class-validator, rewards.controller, rewards.service, controllers, bug-bonus.controller, user-badge.service, src | ✓ |
| risk | services, portfolio, entities, typeorm, controllers, trading, options, notification, risk.service | ✓ |
| settlement | class-validator, entities, typeorm, settlement.entity, settlement-batch.entity, dto, decimal.js, fx-rate.service, currency-compliance.service, uuid, services, settlement.controller | ✓ |
| social-trading | class-validator, typeorm, social-trading.service, interfaces, dto, user, trading, social-trading.controller, social-trading-sync.service, entities | ✓ |
| stellar | stellar.service, stellar-sdk, stellar.controller, config | ✓ |
| swap | typeorm, class-validator, class-transformer, entities, bull, queue, swap-settlement.service, swap-saga.service, swap-pricing.service, trading, uuid, balance, swap.service, dto, swap.controller, swap-batch.processor, amm.service, liquidity.service | ✓ |
| tasks | typeorm | ✗ |
| trading | metrics, price-prediction, class-validator, entities, typeorm, user, machine-engine.service, core, services, balance, uuid, order-book, worker_threads, events, order-book-level, advanced-matching.service, matching-engine.module, matching-engine.controller, os, path, multisig-wallet.service, dto, ethers, portfolio, src, amm.service, trading.service, rewards, trading.controller, bot-trading.controller, settlement.service, matching-engine.service, notification, matching-engine, multisig-wallet.controller | ✓ |
| trading-bonuses | class-validator, class-transformer, typeorm, trading-bonuses.service, dto, entities, trading, trading-bonuses.controller | ✓ |
| tutorial | services, dto, class-validator, class-transformer, entities, create-tutorial.dto, typeorm, tutorial.entity, controllers, learning-leaderboard.service, tutorial.controller, tutorial.service, learning-leaderboard.module | ✓ |
| user | class-validator, class-transformer, typeorm, user.service, dto, user.controller, entities, balance | ✓ |
| waitlist | class-validator, waitlist-query.dto, class-transformer, typeorm, waitlist-user.entity, waitlist.service, entities, user, notification, dto, waitlist.controller, crypto | ✓ |
| websocket | services, interfaces, socket.io, guards, express, express-rate-limit, events, stream-manager.service, uuid, gateway, middleware | ✓ |

## ⚠️ Circular Dependencies

### Cycle 1
```
user → balance → trading → user
```

### Cycle 2
```
balance → trading → balance
```

### Cycle 3
```
user → balance → trading → portfolio → user
```

### Cycle 4
```
balance → trading → portfolio → balance
```

### Cycle 5
```
trading → portfolio → trading
```

### Cycle 6
```
portfolio → risk → portfolio
```

### Cycle 7
```
trading → portfolio → risk → trading
```

### Cycle 8
```
user → balance → trading → rewards → user
```

### Cycle 9
```
balance → trading → rewards → balance
```

### Cycle 10
```
user → balance → user
```

### Cycle 11
```
queue → swap → queue
```


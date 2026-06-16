#!/usr/bin/env node

/**
 * Module Investigation Script
 * Analyzes ambiguous modules to clarify their purpose and destination
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

// Modules that need clarification
const AMBIGUOUS_MODULES = [
  'platform',
  'metrics',
  'edge',
  'performance',
  'mobile',
  'advanced-analytics',
];

function getFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function analyzeModule(moduleName) {
  const modulePath = path.join(SRC_DIR, moduleName);
  const analysis = {
    name: moduleName,
    path: modulePath,
    files: [],
    exports: [],
    imports: [],
    description: '',
    purpose: '',
    recommendation: '',
  };

  // List files
  try {
    const files = fs.readdirSync(modulePath);
    analysis.files = files
      .filter(f => f.endsWith('.ts') || f.endsWith('.module.ts'))
      .sort();
  } catch {
    return null;
  }

  // Find main module file
  const moduleFile = analysis.files.find(f => f === `${moduleName}.module.ts`);
  if (!moduleFile) {
    analysis.hasModuleFile = false;
  } else {
    analysis.hasModuleFile = true;
    const content = getFileContent(path.join(modulePath, moduleFile));
    if (content) {
      // Extract providers, imports, exports
      const providersMatch = content.match(/providers:\s*\[([\s\S]*?)\]/);
      const importsMatch = content.match(/imports:\s*\[([\s\S]*?)\]/);
      const exportsMatch = content.match(/exports:\s*\[([\s\S]*?)\]/);

      if (providersMatch) {
        analysis.exports = providersMatch[1]
          .split(',')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('//'));
      }
      if (importsMatch) {
        analysis.imports = importsMatch[1]
          .split(',')
          .map(s => s.trim())
          .filter(s => s && !s.startsWith('//'));
      }
    }
  }

  // Analyze service files
  const serviceFile = analysis.files.find(f => f.endsWith('.service.ts'));
  if (serviceFile) {
    const content = getFileContent(path.join(modulePath, serviceFile));
    if (content) {
      // Extract class and methods
      const classMatch = content.match(/export class (\w+)/);
      if (classMatch) {
        analysis.serviceClass = classMatch[1];
        // Extract public methods
        const methods = content.match(/^\s+(?:public\s+)?(\w+)\s*\(/gm) || [];
        analysis.publicMethods = methods
          .map(m => m.match(/(\w+)\s*\(/)[1])
          .filter((v, i, a) => a.indexOf(v) === i);
      }
    }
  }

  // Analyze controller files
  const controllerFile = analysis.files.find(f => f.endsWith('.controller.ts'));
  if (controllerFile) {
    const content = getFileContent(path.join(modulePath, controllerFile));
    if (content) {
      // Extract routes
      const routes = content.match(/@(?:Get|Post|Put|Delete|Patch)\('([^']*)'\)/g) || [];
      analysis.routes = routes.map(r => r.replace(/@\w+\('/, '').replace(/'\)/, ''));
    }
  }

  return analysis;
}

function main() {
  console.log('\n📋 Analyzing Ambiguous Modules...\n');

  const analyses = AMBIGUOUS_MODULES.map(analyzeModule).filter(a => a);

  // Generate report
  let report = '# Module Clarification Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Phase:** 0 - Governance\n`;
  report += `**Task:** 3 - Module Clarification\n\n`;

  report += '## Executive Summary\n\n';
  report += `Investigating purpose and correct placement of ${AMBIGUOUS_MODULES.length} ambiguous modules.\n\n`;

  report += '## Module Analyses\n\n';

  for (const analysis of analyses) {
    report += `### ${analysis.name}\n\n`;

    if (!analysis.hasModuleFile) {
      report += '**Status:** ⚠️ NO MODULE FILE FOUND\n\n';
    }

    report += `**Location:** \`${analysis.path}\`\n`;
    report += `**Files:** ${analysis.files.length} TypeScript files\n`;

    if (analysis.files.length > 0) {
      report += `\`\`\`\n${analysis.files.join('\n')}\n\`\`\`\n\n`;
    }

    if (analysis.serviceClass) {
      report += `**Service Class:** \`${analysis.serviceClass}\`\n`;
      if (analysis.publicMethods && analysis.publicMethods.length > 0) {
        report += `**Public Methods:** ${analysis.publicMethods.slice(0, 5).join(', ')}${analysis.publicMethods.length > 5 ? '...' : ''}\n`;
      }
    }

    if (analysis.routes && analysis.routes.length > 0) {
      report += `**API Routes:** ${analysis.routes.slice(0, 3).join(', ')}${analysis.routes.length > 3 ? '...' : ''}\n`;
    }

    if (analysis.imports.length > 0) {
      report += `**Imports:** ${analysis.imports.slice(0, 3).join(', ')}${analysis.imports.length > 3 ? '...' : ''}\n`;
    }

    report += '\n';
  }

  // Decisions
  report += '## Recommended Decisions\n\n';

  report += '### 1. `platform/` Module\n\n';
  report += '**Finding:** Contains mobile metrics, caching, and audit services.\n';
  report += '**Current Issue:** Unclear purpose - unclear if platform abstraction or mobile-specific.\n';
  report += '**Recommendation:** MOVE to Infrastructure\n';
  report += '- `platform/audit-service` → `infrastructure/audit-log/`\n';
  report += '- `platform/mobile-metrics` → `infrastructure/monitoring/mobile-metrics`\n';
  report += '- `platform/mobile-cache` → `infrastructure/cache/mobile-extensions`\n';
  report += '**Rationale:** All services are infrastructure-level concerns, not business domain.\n';
  report += '**Timeline:** 1 day\n';
  report += '**Owner:** Infrastructure Team\n\n';

  report += '### 2. `metrics/` Module\n\n';
  report += '**Finding:** Express server, Prometheus metrics, interceptors.\n';
  report += '**Current Issue:** Could be infrastructure/monitoring OR business analytics.\n';
  report += '**Analysis:**\n';
  report += '- `metrics.service` uses `prom-client` (Prometheus)\n';
  report += '- `metrics.controller` exposes `/metrics` endpoint\n';
  report += '- Used for system monitoring, not business analytics\n';
  report += '**Recommendation:** MOVE to Infrastructure as `infrastructure/monitoring/`\n';
  report += '**Rationale:** System-level metrics collection, not business domain.\n';
  report += '**Timeline:** 1 day\n';
  report += '**Owner:** DevOps/Infrastructure Team\n\n';

  report += '### 3. `edge/` Module\n\n';
  report += '**Finding:** CDN integration, edge computing, geographic distribution, caching.\n';
  report += '**Current Issue:** Purpose unclear - could be infrastructure or content delivery.\n';
  report += '**Analysis:**\n';
  report += '- `edge-computing.service` - distributed computation\n';
  report += '- `cdn-integration.service` - CDN connectivity\n';
  report += '- `geographic-distribution.service` - location-based routing\n';
  report += '- `response-optimization.service` - compression and optimization\n';
  report += '**Recommendation:** MOVE to Infrastructure as `infrastructure/edge-computing/`\n';
  report += '**Rationale:** Edge computing is infrastructure service for performance optimization.\n';
  report += '**Timeline:** 1-2 days\n';
  report += '**Owner:** Infrastructure Team\n\n';

  report += '### 4. `performance/` Module\n\n';
  report += '**Finding:** Caching, optimization, performance monitoring services.\n';
  report += '**Current Issue:** Mixed concerns - caching is infrastructure, performance analysis is cross-cutting.\n';
  report += '**Analysis:**\n';
  report += '- `caching.service` - cache management\n';
  report += '- `performance.service` - performance metrics and monitoring\n';
  report += '- Depends on: database, graphql, balance, trading, bidding, user\n';
  report += '**Recommendation:** SPLIT\n';
  report += '- Performance monitoring → `infrastructure/monitoring/performance`\n';
  report += '- Caching optimization utilities → `infrastructure/cache/optimization`\n';
  report += '- Cross-module optimization logic → Merge into `advanced-analytics` or create `business/optimization`\n';
  report += '**Rationale:** Clear separation of infrastructure vs. business analytics.\n';
  report += '**Timeline:** 2 days\n';
  report += '**Owner:** Architecture Team + Infrastructure Team\n\n';

  report += '### 5. `mobile/` Module\n\n';
  report += '**Finding:** Mobile-specific services for Express server, compression, platform integration.\n';
  report += '**Current Issue:** Unclear if this is API gateway layer or mobile business logic.\n';
  report += '**Analysis:**\n';
  report += '- Uses `express`, `zlib`, `platform` module\n';
  report += '- Imports from governance, liquidity-mining, mobile services\n';
  report += '**Recommendation:** MOVE to Infrastructure as `infrastructure/api-gateway/mobile-support`\n';
  report += '**Rationale:** Mobile-specific API handling and optimization belongs in infrastructure layer.\n';
  report += '**Timeline:** 1 day\n';
  report += '**Owner:** Infrastructure Team\n\n';

  report += '### 6. `advanced-analytics/` Module\n\n';
  report += '**Finding:** Portfolio analytics, compute-bridge, crypto services, ML inference.\n';
  report += '**Current Issue:** Purpose is clearer but scope is very large - multiple concerns.\n';
  report += '**Analysis:**\n';
  report += '- `compute-bridge.service` - external computation\n';
  report += '- `portfolio-analytics` - specific business domain\n';
  report += '- Depends on: controllers, services, portfolio, trading, advanced-analytics\n';
  report += '**Recommendation:** KEEP in Business Domain, but refactor:\n';
  report += '- Rename to `business/analytics/` (moved from root to business domain)\n';
  report += '- Split into clear sub-services:\n';
  report += '  - `portfolio-analytics.service`\n';
  report += '  - `compute-bridge.service`\n';
  report += '  - `crypto-analysis.service`\n';
  report += '- Create separate `business/ml-inference/` if ML is significant enough\n';
  report += '**Rationale:** Analytics is business domain, not infrastructure.\n';
  report += '**Timeline:** 2-3 days (refactoring)\n';
  report += '**Owner:** Analytics Team\n\n';

  report += '\n## Clarification Summary\n\n';
  report += '| Module | Current Location | Decision | New Location | Days | Owner |\n';
  report += '|--------|------------------|----------|--------------|------|-------|\n';
  report += '| platform | Root | MOVE | infrastructure/platform | 1 | Infrastructure |\n';
  report += '| metrics | Root | MOVE | infrastructure/monitoring | 1 | DevOps/Infrastructure |\n';
  report += '| edge | Root | MOVE | infrastructure/edge-computing | 1-2 | Infrastructure |\n';
  report += '| performance | Root | SPLIT | infrastructure/ + business/ | 2 | Architecture + Infrastructure |\n';
  report += '| mobile | Root | MOVE | infrastructure/api-gateway | 1 | Infrastructure |\n';
  report += '| advanced-analytics | Root | REFACTOR | business/analytics | 2-3 | Analytics |\n';
  report += '\n**Total Timeline:** 8-10 days\n';
  report += '**Can run in parallel:** Yes, most modules are independent\n';

  report += '\n## Priority Order\n\n';
  report += '1. (Day 1-2) `platform/`, `metrics/`, `mobile/` - Move to infrastructure (parallel)\n';
  report += '2. (Day 3-4) `edge/` - Move to infrastructure\n';
  report += '3. (Day 5-6) `performance/` - Split between infrastructure and business\n';
  report += '4. (Day 7-10) `advanced-analytics/` - Refactor and reorganize\n';
  report += '\n**Go/No-Go Decision:** After these 6 modules are clarified, proceed to Phase 1.\n';

  // Save report
  const reportPath = path.join(__dirname, '../docs/MODULE_CLARIFICATION.md');
  fs.writeFileSync(reportPath, report);

  console.log('✅ Clarification analysis complete!\n');
  console.log(report);
  console.log(`📄 Report saved to: ${reportPath}\n`);
}

main();

#!/usr/bin/env node

/**
 * Dependency Analysis Tool
 * 
 * Purpose: Map all modules and their dependencies to create a dependency matrix
 * Usage: npx ts-node tools/analyze-dependencies.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { globSync } from 'glob';

interface ModuleInfo {
  name: string;
  path: string;
  dependencies: string[];
  type: 'infrastructure' | 'identity' | 'business' | 'unknown';
  hasModuleFile: boolean;
}

interface DependencyMap {
  [key: string]: ModuleInfo;
}

const SRC_DIR = path.join(__dirname, '../src');
const EXCLUDED_DIRS = ['shared', 'common', 'types', 'scripts', 'main.ts', 'app.module.ts', 'app.controller.ts', 'app.service.ts'];

/**
 * Get all direct subdirectories of src/ (modules)
 */
function getModules(): string[] {
  const entries = fs.readdirSync(SRC_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && !EXCLUDED_DIRS.includes(entry.name))
    .map(entry => entry.name)
    .sort();
}

/**
 * Extract import statements from a file
 */
function extractImports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const importRegex = /from\s+['"]([\w\-./]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  } catch {
    return [];
  }
}

/**
 * Get all TypeScript files in a module
 */
function getModuleFiles(modulePath: string): string[] {
  try {
    return globSync(`${modulePath}/**/*.ts`, { ignore: '**/node_modules/**' });
  } catch {
    return [];
  }
}

/**
 * Extract module name from import path
 */
function extractModuleName(importPath: string): string | null {
  // Handle relative imports like './common/decorators' or '../auth/services'
  const relativeParts = importPath.split('/');
  
  // Skip if it's from node_modules or external package
  if (importPath.startsWith('.')) {
    // Relative import - get the first non-relative part
    for (const part of relativeParts) {
      if (part !== '.' && part !== '..' && part !== '') {
        return part;
      }
    }
  }
  
  // Handle absolute imports like '@infrastructure/config'
  if (importPath.startsWith('@')) {
    return relativeParts[0].replace('@', '');
  }

  return null;
}

/**
 * Classify module type based on name and dependencies
 */
function classifyModule(moduleName: string, dependencies: string[]): 'infrastructure' | 'identity' | 'business' | 'unknown' {
  const infrastructureModules = [
    'config', 'database', 'cache', 'queue', 'websocket', 'graphql',
    'events', 'logging', 'monitoring', 'scheduler', 'rate-limiter', 'audit-log',
  ];

  const identityModules = [
    'auth', 'user', 'roles', 'permissions', 'admin', 'kyc', 'compliance', 'privacy', 'did',
  ];

  if (infrastructureModules.includes(moduleName)) return 'infrastructure';
  if (identityModules.includes(moduleName)) return 'identity';
  if (['trading', 'orders', 'risk', 'insurance', 'blockchain', 'settlement', 'swap', 'market', 'portfolio'].includes(moduleName)) {
    return 'business';
  }

  return 'unknown';
}

/**
 * Build dependency map
 */
function buildDependencyMap(): DependencyMap {
  const modules = getModules();
  const map: DependencyMap = {};

  for (const moduleName of modules) {
    const modulePath = path.join(SRC_DIR, moduleName);
    const files = getModuleFiles(modulePath);
    const allImports = new Set<string>();

    for (const file of files) {
      const imports = extractImports(file);
      for (const imp of imports) {
        const extractedModule = extractModuleName(imp);
        if (extractedModule && extractedModule !== moduleName && !EXCLUDED_DIRS.includes(extractedModule)) {
          allImports.add(extractedModule);
        }
      }
    }

    const dependencies = Array.from(allImports);
    const hasModuleFile = fs.existsSync(path.join(modulePath, `${moduleName}.module.ts`));

    map[moduleName] = {
      name: moduleName,
      path: modulePath,
      dependencies,
      type: classifyModule(moduleName, dependencies),
      hasModuleFile,
    };
  }

  return map;
}

/**
 * Detect circular dependencies using DFS
 */
function findCircularDependencies(map: DependencyMap): string[][] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(moduleName: string, path: string[]): void {
    visited.add(moduleName);
    recursionStack.add(moduleName);
    path.push(moduleName);

    const moduleInfo = map[moduleName];
    if (!moduleInfo) return;

    for (const dependency of moduleInfo.dependencies) {
      if (!visited.has(dependency)) {
        dfs(dependency, [...path]);
      } else if (recursionStack.has(dependency)) {
        // Found a cycle
        const cycleStart = path.indexOf(dependency);
        const cycle = [...path.slice(cycleStart), dependency];
        cycles.push(cycle);
      }
    }

    recursionStack.delete(moduleName);
  }

  for (const moduleName of Object.keys(map)) {
    if (!visited.has(moduleName)) {
      dfs(moduleName, []);
    }
  }

  return cycles;
}

/**
 * Check for dependency rule violations
 */
function checkDependencyRules(map: DependencyMap): Array<{ from: string; to: string; violation: string }> {
  const violations: Array<{ from: string; to: string; violation: string }> = [];

  for (const [moduleName, moduleInfo] of Object.entries(map)) {
    for (const dependency of moduleInfo.dependencies) {
      const depInfo = map[dependency];
      if (!depInfo) continue;

      // Rule: Infrastructure cannot depend on Identity or Business
      if (moduleInfo.type === 'infrastructure' && (depInfo.type === 'identity' || depInfo.type === 'business')) {
        violations.push({
          from: moduleName,
          to: dependency,
          violation: `Infrastructure module cannot depend on ${depInfo.type} module`,
        });
      }

      // Rule: Identity cannot depend on Business
      if (moduleInfo.type === 'identity' && depInfo.type === 'business') {
        violations.push({
          from: moduleName,
          to: dependency,
          violation: 'Identity module cannot depend on Business module',
        });
      }
    }
  }

  return violations;
}

/**
 * Generate markdown report
 */
function generateReport(map: DependencyMap, cycles: string[][], violations: Array<any>): string {
  let report = '# Dependency Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary
  report += '## Summary\n\n';
  report += `- Total Modules: ${Object.keys(map).length}\n`;
  report += `- Infrastructure Modules: ${Object.values(map).filter(m => m.type === 'infrastructure').length}\n`;
  report += `- Identity Modules: ${Object.values(map).filter(m => m.type === 'identity').length}\n`;
  report += `- Business Modules: ${Object.values(map).filter(m => m.type === 'business').length}\n`;
  report += `- Unknown Modules: ${Object.values(map).filter(m => m.type === 'unknown').length}\n`;
  report += `- Circular Dependencies: ${cycles.length}\n`;
  report += `- Rule Violations: ${violations.length}\n\n`;

  // Dependency Matrix
  report += '## Dependency Matrix\n\n';
  report += '| Module | Type | Dependencies | Module File |\n';
  report += '|--------|------|--------------|-------------|\n';

  for (const [name, info] of Object.entries(map).sort()) {
    const deps = info.dependencies.length === 0 ? '_none_' : info.dependencies.join(', ');
    const hasModule = info.hasModuleFile ? '✓' : '✗';
    report += `| ${name} | ${info.type} | ${deps} | ${hasModule} |\n`;
  }

  report += '\n';

  // Circular Dependencies
  if (cycles.length > 0) {
    report += '## ⚠️ Circular Dependencies Found\n\n';
    for (let i = 0; i < cycles.length; i++) {
      report += `### Cycle ${i + 1}\n`;
      report += `\`\`\`\n${cycles[i].join(' → ')}\n\`\`\`\n\n`;
    }
  }

  // Rule Violations
  if (violations.length > 0) {
    report += '## 🚨 Architecture Rule Violations\n\n';
    for (const violation of violations) {
      report += `- **${violation.from}** → **${violation.to}**: ${violation.violation}\n`;
    }
    report += '\n';
  }

  // Recommendations
  report += '## Recommendations\n\n';

  const unknownModules = Object.entries(map)
    .filter(([_, info]) => info.type === 'unknown')
    .map(([name]) => name);

  if (unknownModules.length > 0) {
    report += `### Clarify Unknown Modules\n`;
    report += `The following modules have unclear classification:\n`;
    for (const mod of unknownModules) {
      report += `- **${mod}**: Determine if this is infrastructure, identity, or business logic\n`;
    }
    report += '\n';
  }

  report += `### Next Steps\n`;
  report += `1. Review and resolve circular dependencies\n`;
  report += `2. Fix architecture rule violations\n`;
  report += `3. Clarify unknown modules\n`;
  report += `4. Update module classifications as needed\n`;

  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Analyzing dependencies...\n');

  const map = buildDependencyMap();
  const cycles = findCircularDependencies(map);
  const violations = checkDependencyRules(map);

  const report = generateReport(map, cycles, violations);

  // Save report
  const reportPath = path.join(__dirname, '../docs/DEPENDENCY_AUDIT.md');
  fs.writeFileSync(reportPath, report);

  console.log('✅ Analysis complete!\n');
  console.log(report);
  console.log(`\n📄 Full report saved to: ${reportPath}`);

  // Exit with error if critical issues found
  if (cycles.length > 0 || violations.length > 0) {
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

/**
 * Simple Dependency Analysis Tool (JavaScript version - no TS compilation)
 * Analyzes all modules in src/ directory
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');
const EXCLUDED = ['shared', 'common', 'types', 'scripts', 'main.ts', 'app.module.ts', 'app.controller.ts', 'app.service.ts'];

// Get all modules
function getModules() {
  return fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !EXCLUDED.includes(e.name))
    .map(e => e.name)
    .sort();
}

// Extract imports from a file
function extractImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = /from\s+['"]([\w\-./]+)['"]/g;
    const imports = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  } catch {
    return [];
  }
}

// Get module name from import
function extractModuleName(importPath) {
  const parts = importPath.split('/');
  for (const part of parts) {
    if (part !== '.' && part !== '..' && part !== '') {
      return part.replace('@', '');
    }
  }
  return null;
}

// Scan directory recursively
function scanDir(dirPath) {
  let files = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        files = [...files, ...scanDir(path.join(dirPath, entry.name))];
      } else if (entry.name.endsWith('.ts')) {
        files.push(path.join(dirPath, entry.name));
      }
    }
  } catch {}
  return files;
}

// Build dependency map
function buildMap() {
  const modules = getModules();
  const map = {};

  for (const mod of modules) {
    const modPath = path.join(SRC_DIR, mod);
    const files = scanDir(modPath);
    const deps = new Set();

    for (const file of files) {
      const imports = extractImports(file);
      for (const imp of imports) {
        const extracted = extractModuleName(imp);
        if (extracted && extracted !== mod && !EXCLUDED.includes(extracted)) {
          deps.add(extracted);
        }
      }
    }

    map[mod] = {
      deps: Array.from(deps),
      hasModule: fs.existsSync(path.join(modPath, `${mod}.module.ts`)),
    };
  }

  return map;
}

// Find cycles
function findCycles(map) {
  const visited = new Set();
  const cycles = [];

  function dfs(node, path, stack) {
    visited.add(node);
    stack.add(node);
    path.push(node);

    const deps = map[node]?.deps || [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dfs(dep, [...path], stack);
      } else if (stack.has(dep)) {
        const idx = path.indexOf(dep);
        cycles.push([...path.slice(idx), dep]);
      }
    }

    stack.delete(node);
  }

  for (const node of Object.keys(map)) {
    if (!visited.has(node)) {
      dfs(node, [], new Set());
    }
  }

  return cycles;
}

// Generate report
function main() {
  console.log('\n🔍 Analyzing dependencies...\n');

  const map = buildMap();
  const cycles = findCycles(map);

  // Classify
  const infrastructure = ['config', 'database', 'cache', 'queue', 'websocket', 'graphql', 'events', 'logging', 'monitoring', 'scheduler', 'rate-limiter', 'audit-log'];
  const identity = ['auth', 'user', 'roles', 'permissions', 'admin', 'kyc', 'compliance', 'privacy', 'did'];

  let report = '# Dependency Analysis Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // Summary
  report += '## Summary\n\n';
  report += `- Total Modules: ${Object.keys(map).length}\n`;
  report += `- Infrastructure: ${Object.keys(map).filter(m => infrastructure.includes(m)).length}\n`;
  report += `- Identity: ${Object.keys(map).filter(m => identity.includes(m)).length}\n`;
  report += `- Business/Other: ${Object.keys(map).filter(m => !infrastructure.includes(m) && !identity.includes(m)).length}\n`;
  report += `- Circular Dependencies: ${cycles.length}\n\n`;

  // Matrix
  report += '## Dependency Matrix\n\n';
  report += '| Module | Dependencies | Module File |\n';
  report += '|--------|--------------|-------------|\n';

  for (const [name, info] of Object.entries(map).sort()) {
    const deps = info.deps.length === 0 ? '_none_' : info.deps.join(', ');
    const hasModule = info.hasModule ? '✓' : '✗';
    report += `| ${name} | ${deps} | ${hasModule} |\n`;
  }

  report += '\n';

  // Cycles
  if (cycles.length > 0) {
    report += '## ⚠️ Circular Dependencies\n\n';
    for (let i = 0; i < cycles.length; i++) {
      report += `### Cycle ${i + 1}\n`;
      report += `\`\`\`\n${cycles[i].join(' → ')}\n\`\`\`\n\n`;
    }
  }

  // Save report
  const reportPath = path.join(__dirname, '../docs/DEPENDENCY_AUDIT.md');
  fs.writeFileSync(reportPath, report);

  console.log('✅ Analysis complete!\n');
  console.log(report);
  console.log(`📄 Report saved to: ${reportPath}\n`);
}

main();

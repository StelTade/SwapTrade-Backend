#!/usr/bin/env node

/**
 * Architecture Validation Script
 * 
 * Purpose: Run all architecture checks (lint, circular deps, analysis)
 * Usage: npm run validate:architecture
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

interface CheckResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: CheckResult[] = [];

function log(color: string, message: string) {
  console.log(`${color}${message}${RESET}`);
}

function runCheck(name: string, command: string): CheckResult {
  const start = Date.now();
  try {
    log(BLUE, `\n🔍 Checking: ${name}...`);
    execSync(command, { stdio: 'pipe' });
    const duration = Date.now() - start;
    log(GREEN, `✅ PASS: ${name} (${duration}ms)`);
    return { name, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(RED, `❌ FAIL: ${name} (${duration}ms)`);
    log(RED, `   Error: ${errorMsg.split('\n')[0]}`);
    return { name, passed: false, duration, error: errorMsg };
  }
}

function main() {
  log(BLUE, '\n╔════════════════════════════════════════╗');
  log(BLUE, '║  SwapTrade Architecture Validation     ║');
  log(BLUE, '╚════════════════════════════════════════╝');

  // Check 1: ESLint
  results.push(runCheck(
    'ESLint - Module Boundaries',
    'npx eslint src --ext .ts --format json --no-eslintignore | grep -q "problems" && exit 1 || exit 0'
  ));

  // Check 2: Circular Dependencies
  results.push(runCheck(
    'Madge - Circular Dependencies',
    'npx madge --circular --extensions ts src/ --ignore-pattern "node_modules"'
  ));

  // Check 3: TypeScript Compilation
  results.push(runCheck(
    'TypeScript - Compilation',
    'npx tsc --noEmit --skipLibCheck'
  ));

  // Check 4: Dependency Analysis
  results.push(runCheck(
    'Dependency Analysis',
    'npx ts-node tools/analyze-dependencies.ts'
  ));

  // Summary
  log(BLUE, '\n╔════════════════════════════════════════╗');
  log(BLUE, '║  Summary                               ║');
  log(BLUE, '╚════════════════════════════════════════╝');

  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name.padEnd(40)} ${result.duration}ms`);
  });

  log(BLUE, `\nTotal: ${passed}/${total} checks passed (${totalDuration}ms)`);

  if (passed === total) {
    log(GREEN, '\n🎉 All architecture checks passed!');
    process.exit(0);
  } else {
    log(RED, '\n⚠️  Some checks failed. Please review above.');
    process.exit(1);
  }
}

main();

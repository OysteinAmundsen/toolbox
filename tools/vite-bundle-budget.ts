import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

export interface BudgetEntry {
  /** Path pattern relative to outDir. Use `*` for single-level directory wildcard. */
  path: string;
  /** Maximum raw file size in bytes (hard fail) */
  maxSize?: number;
  /** Maximum gzip compressed size in bytes (hard fail) */
  maxGzip?: number;
  /** Soft raw size threshold — emits a warning but does not fail the build */
  warnSize?: number;
  /** Soft gzip size threshold — emits a warning but does not fail the build */
  warnGzip?: number;
}

export interface BundleBudgetOptions {
  /** Absolute path to the build output directory */
  outDir: string;
  /** Budget definitions to enforce */
  budgets: BudgetEntry[];
  /** 'error' (default) fails the build; 'warn' logs a warning */
  severity?: 'error' | 'warn';
}

export interface BudgetCheckResult {
  /** Hard-fail messages (maxSize/maxGzip exceeded) */
  violations: string[];
  /** Soft-warn messages (warnSize/warnGzip exceeded but under hard limit) */
  warnings: string[];
}

/**
 * Check bundle sizes against configured budgets.
 * Returns hard violations and soft warnings separately.
 */
export function checkBudgets(options: BundleBudgetOptions): BudgetCheckResult {
  const { outDir, budgets } = options;
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const budget of budgets) {
    const files = resolveGlob(outDir, budget.path);
    if (files.length === 0) {
      violations.push(`No files matched pattern "${budget.path}"`);
      continue;
    }

    for (const filePath of files) {
      const rel = relative(outDir, filePath).replace(/\\/g, '/');
      const content = readFileSync(filePath);
      const rawSize = content.length;
      const needsGzip = budget.maxGzip != null || budget.warnGzip != null;
      const gz = needsGzip ? gzipSync(content).length : 0;

      if (budget.maxSize != null && rawSize > budget.maxSize) {
        violations.push(`${rel}: ${fmt(rawSize)} exceeds budget of ${fmt(budget.maxSize)}`);
      } else if (budget.warnSize != null && rawSize > budget.warnSize) {
        warnings.push(`${rel}: ${fmt(rawSize)} approaching budget (warn at ${fmt(budget.warnSize)})`);
      }

      if (budget.maxGzip != null && gz > budget.maxGzip) {
        violations.push(`${rel}: ${fmt(gz)} gzipped exceeds budget of ${fmt(budget.maxGzip)}`);
      } else if (budget.warnGzip != null && gz > budget.warnGzip) {
        warnings.push(`${rel}: ${fmt(gz)} gzipped approaching budget (warn at ${fmt(budget.warnGzip)})`);
      }
    }
  }

  return { violations, warnings };
}

/**
 * Vite plugin that validates bundle sizes against configured budgets.
 * Runs in closeBundle so all sub-builds (plugins, features, UMD) are complete.
 */
export function bundleBudget(options: BundleBudgetOptions): Plugin {
  return {
    name: 'bundle-budget',
    apply: 'build',
    closeBundle() {
      const { violations, warnings } = checkBudgets(options);
      const severity = options.severity ?? 'error';

      if (warnings.length > 0) {
        const msg = `\nBundle budget warnings:\n${warnings.map((w) => `  ⚠ ${w}`).join('\n')}\n`;
        console.warn(`\x1b[33m${msg}\x1b[0m`);
      }

      if (violations.length > 0) {
        const msg = `\nBundle budget exceeded:\n${violations.map((v) => `  ✗ ${v}`).join('\n')}\n`;
        if (severity === 'warn') {
          console.warn(`\x1b[33m${msg}\x1b[0m`);
        } else {
          throw new Error(msg);
        }
      } else if (warnings.length === 0) {
        console.log('\n\x1b[32m✓ All bundle budgets passed\x1b[0m');
      }
    },
  };
}

// #region Helpers

const KB = 1024;

/** Format bytes as a human-readable string */
function fmt(bytes: number): string {
  return bytes < KB ? `${bytes} B` : `${(bytes / KB).toFixed(1)} kB`;
}

/**
 * Resolve a path pattern with `*` wildcards against the filesystem.
 * Only supports `*` as a single directory-level wildcard (not `**`).
 */
function resolveGlob(baseDir: string, pattern: string): string[] {
  return walk(baseDir, pattern.split('/'));
}

function walk(dir: string, parts: string[]): string[] {
  if (parts.length === 0) return [];

  const [current, ...rest] = parts;

  if (current === '*') {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      if (rest.length === 0) {
        return entries.filter((e) => e.isFile()).map((e) => resolve(dir, e.name));
      }
      return entries.filter((e) => e.isDirectory()).flatMap((e) => walk(resolve(dir, e.name), rest));
    } catch {
      return [];
    }
  }

  const target = resolve(dir, current);
  if (rest.length === 0) {
    try {
      statSync(target);
      return [target];
    } catch {
      return [];
    }
  }

  return walk(target, rest);
}

// #endregion

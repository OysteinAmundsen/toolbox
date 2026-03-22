#!/usr/bin/env bun
/**
 * Validate that the CSS Variable Registry covers every --tbw-* variable
 * found in the grid library's CSS source files.
 *
 * Usage: bun apps/docs/scripts/validate-css-variables.ts
 *
 * Exits with code 1 if any user-customizable variables are missing.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ALL_VARIABLE_NAMES } from '../src/data/css-variable-registry.js';

// Variables that are computed/internal — not user-customizable
const IGNORED_VARIABLES = new Set([
  '--tbw-column-template', // JS-set grid-template-columns
  '--tbw-tree-depth', // JS-set per row
  '--tbw-group-depth', // JS-set per group row
  '--tbw-pivot-depth', // CSS depth indicator (data-attr driven)
  '--tbw-color-danger', // alias for --tbw-color-error
  '--tbw-base-radius', // internal base token, use --tbw-border-radius
]);

const SCAN_DIRS = ['libs/grid/src', 'libs/themes'];

function collectCSSFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectCSSFiles(full));
    } else if (full.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

function extractVariables(filePath: string): Map<string, string[]> {
  const content = readFileSync(filePath, 'utf8');
  const vars = new Map<string, string[]>();

  // Match explicit definitions:  --tbw-xyz: value;
  for (const m of content.matchAll(/^\s*(--tbw-[\w-]+)\s*:/gm)) {
    const name = m[1];
    const locations = vars.get(name) ?? [];
    locations.push(`defined in ${relative('.', filePath)}`);
    vars.set(name, locations);
  }

  // Match var() references:  var(--tbw-xyz, ...)  or  var(--tbw-xyz)
  for (const m of content.matchAll(/var\((--tbw-[\w-]+)/g)) {
    const name = m[1];
    if (!vars.has(name)) {
      const locations = vars.get(name) ?? [];
      locations.push(`referenced in ${relative('.', filePath)}`);
      vars.set(name, locations);
    }
  }

  return vars;
}

// ── Main ─────────────────────────────────────────────────────────────────

const root = process.cwd();
const allCSSSources = SCAN_DIRS.flatMap((dir) => collectCSSFiles(join(root, dir)));

const foundVars = new Map<string, string[]>();
for (const file of allCSSSources) {
  for (const [name, locations] of extractVariables(file)) {
    const existing = foundVars.get(name) ?? [];
    existing.push(...locations);
    foundVars.set(name, existing);
  }
}

const registrySet = new Set(ALL_VARIABLE_NAMES);

// Variables in CSS but not in registry
const missing: [string, string[]][] = [];
for (const [name, locations] of foundVars) {
  if (!registrySet.has(name) && !IGNORED_VARIABLES.has(name)) {
    missing.push([name, locations]);
  }
}

// Variables in registry but not found in any CSS
const extra: string[] = ALL_VARIABLE_NAMES.filter((name) => !foundVars.has(name));

// ── Report ───────────────────────────────────────────────────────────────

console.log(`Scanned ${allCSSSources.length} CSS files, found ${foundVars.size} unique --tbw-* variables.`);
console.log(`Registry contains ${ALL_VARIABLE_NAMES.length} variables.\n`);

if (missing.length > 0) {
  console.error(`❌ ${missing.length} variable(s) found in CSS but MISSING from registry:\n`);
  for (const [name, locations] of missing.sort()) {
    console.error(`  ${name}`);
    for (const loc of locations) {
      console.error(`    └ ${loc}`);
    }
  }
  console.error('');
}

if (extra.length > 0) {
  console.warn(`⚠️  ${extra.length} variable(s) in registry but not found in any CSS file:\n`);
  for (const name of extra.sort()) {
    console.warn(`  ${name}`);
  }
  console.warn('(These may be implicit override variables consumed via var() fallbacks — verify manually.)\n');
}

if (missing.length === 0 && extra.length === 0) {
  console.log('✅ Registry is complete and matches all CSS sources.');
}

process.exit(missing.length > 0 ? 1 : 0);

#!/usr/bin/env node

/**
 * update-perf-baseline.mjs
 *
 * Records a new performance baseline from one or more result files.
 * This should be run on CI (or locally for development) to update
 * the committed baseline after intentional performance changes.
 *
 * Usage:
 *   node scripts/update-perf-baseline.mjs <results-dir>
 *
 * Where <results-dir> contains perf-metrics-*.json files from test runs.
 * If multiple files exist, the median of each metric is used.
 */

import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const BASELINE_PATH = resolve(import.meta.dirname, '..', 'e2e', 'perf-baseline.json');

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const resultsDir = process.argv[2];
if (!resultsDir) {
  console.error('Usage: node scripts/update-perf-baseline.mjs <results-dir>');
  process.exit(1);
}

const resolvedDir = resolve(resultsDir);
const files = readdirSync(resolvedDir).filter((f) => f.startsWith('perf-metrics-') && f.endsWith('.json'));

if (files.length === 0) {
  console.error(`❌ No perf-metrics-*.json files found in ${resolvedDir}`);
  process.exit(1);
}

console.log(`📊 Found ${files.length} result file(s)`);

// Collect all metric values across runs
const allMetrics = {};
for (const file of files) {
  const data = JSON.parse(readFileSync(join(resolvedDir, file), 'utf-8'));
  for (const [key, value] of Object.entries(data)) {
    if (typeof value !== 'number') continue;
    if (!allMetrics[key]) allMetrics[key] = [];
    allMetrics[key].push(value);
  }
}

// Compute medians
const medians = {};
for (const [key, values] of Object.entries(allMetrics)) {
  medians[key] = Math.round(median(values) * 100) / 100;
}

const runner = process.env.GITHUB_ACTIONS ? 'github-actions-ubuntu-latest' : 'local';
const date = new Date().toISOString().split('T')[0];

const baselineData = {
  $schema: './perf-baseline.schema.json',
  baseline: {
    runner,
    date,
    metrics: medians,
  },
};

writeFileSync(BASELINE_PATH, JSON.stringify(baselineData, null, 2) + '\n');

console.log(`\n✅ Baseline updated (${date}, ${runner})`);
console.log(`   Metrics: ${Object.keys(medians).length}`);
for (const [key, value] of Object.entries(medians)) {
  console.log(`   ${key}: ${value}ms`);
}
console.log(`\n   Written to: ${BASELINE_PATH}`);
console.log('   Remember to commit the updated baseline!');

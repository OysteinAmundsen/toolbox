#!/usr/bin/env node

/**
 * compare-perf-baseline.mjs
 *
 * Compares performance test results against a committed baseline.
 * Exits non-zero if any metric regresses beyond the threshold.
 *
 * Usage:
 *   node scripts/compare-perf-baseline.mjs <results-dir>
 *
 * Where <results-dir> contains one or more perf-metrics-*.json files
 * (one per run). When multiple files exist, the median of each metric
 * is used to reduce noise.
 *
 * If no baseline exists (baseline is null), the script warns and exits
 * with code 0. Bootstrap the baseline via workflow_dispatch.
 */

import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const THRESHOLD = 0.5; // 50% regression threshold
const BASELINE_PATH = resolve(import.meta.dirname, '..', 'e2e', 'perf-baseline.json');

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadResults(resultsDir) {
  const files = readdirSync(resultsDir).filter((f) => f.startsWith('perf-metrics-') && f.endsWith('.json'));

  if (files.length === 0) {
    console.error(`❌ No perf-metrics-*.json files found in ${resultsDir}`);
    process.exit(1);
  }

  console.log(`📊 Found ${files.length} result file(s) in ${resultsDir}`);

  // Collect all metric values across runs: { metricName: [val1, val2, ...] }
  const allMetrics = {};

  for (const file of files) {
    const data = JSON.parse(readFileSync(join(resultsDir, file), 'utf-8'));
    for (const [key, value] of Object.entries(data)) {
      if (typeof value !== 'number') continue;
      if (!allMetrics[key]) allMetrics[key] = [];
      allMetrics[key].push(value);
    }
  }

  // Compute median for each metric
  const medians = {};
  for (const [key, values] of Object.entries(allMetrics)) {
    medians[key] = Math.round(median(values) * 100) / 100;
  }

  return medians;
}

function compare(baselineMetrics, currentMetrics) {
  let hasRegression = false;
  const results = [];

  for (const [key, currentValue] of Object.entries(currentMetrics)) {
    const baselineValue = baselineMetrics[key];

    if (baselineValue === undefined) {
      results.push({ key, status: 'new', current: currentValue });
      continue;
    }

    // Skip comparison for very small baselines (< 1ms) — noise dominates
    if (baselineValue < 1) {
      results.push({ key, status: 'skip', current: currentValue, baseline: baselineValue });
      continue;
    }

    const thresholdValue = baselineValue * (1 + THRESHOLD);
    const regressionPct = ((currentValue - baselineValue) / baselineValue) * 100;

    if (currentValue > thresholdValue) {
      hasRegression = true;
      results.push({
        key,
        status: 'FAIL',
        current: currentValue,
        baseline: baselineValue,
        threshold: Math.round(thresholdValue * 100) / 100,
        regression: Math.round(regressionPct),
      });
    } else {
      results.push({
        key,
        status: 'pass',
        current: currentValue,
        baseline: baselineValue,
        regression: Math.round(regressionPct),
      });
    }
  }

  // Check for metrics that disappeared
  for (const key of Object.keys(baselineMetrics)) {
    if (!(key in currentMetrics)) {
      results.push({ key, status: 'missing', baseline: baselineMetrics[key] });
    }
  }

  return { hasRegression, results };
}

function printResults(results) {
  console.log('\n📋 Performance Comparison Results\n');
  console.log(
    '%-50s %-8s %10s %10s %10s %8s'.replace(/%/g, ''),
    'Metric',
    'Status',
    'Current',
    'Baseline',
    'Threshold',
    'Change',
  );
  console.log('-'.repeat(100));

  // Use simple formatting since padEnd isn't supported in template strings above
  for (const r of results) {
    const metric = r.key ?? '';
    const status = r.status ?? '';
    const current = r.current !== undefined ? `${r.current}ms` : '-';
    const baseline = r.baseline !== undefined ? `${r.baseline}ms` : '-';
    const threshold = r.threshold !== undefined ? `${r.threshold}ms` : '-';
    const change = r.regression !== undefined ? `${r.regression > 0 ? '+' : ''}${r.regression}%` : '-';

    const icon = r.status === 'FAIL' ? '❌' : r.status === 'pass' ? '✅' : r.status === 'new' ? '🆕' : '⚠️';
    console.log(
      `${icon} ${metric.padEnd(48)} ${status.padEnd(8)} ${current.padStart(10)} ${baseline.padStart(10)} ${threshold.padStart(10)} ${change.padStart(8)}`,
    );
  }

  console.log('');
}

// Main
const resultsDir = process.argv[2];
if (!resultsDir) {
  console.error('Usage: node scripts/compare-perf-baseline.mjs <results-dir>');
  process.exit(1);
}

const resolvedDir = resolve(resultsDir);
const currentMetrics = loadResults(resolvedDir);
console.log(`📊 Computed medians for ${Object.keys(currentMetrics).length} metrics`);

const baselineData = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));

if (!baselineData.baseline) {
  // No baseline committed — can't compare, just report the current metrics
  console.log('\n⚠️  No baseline recorded yet. Skipping comparison.');
  console.log('    To bootstrap the baseline, trigger the CI workflow manually');
  console.log('    with "Record new performance baseline from CI runner" enabled.');
  console.log('\n    Current run metrics (not saved — ephemeral CI runner):');
  for (const [key, value] of Object.entries(currentMetrics)) {
    console.log(`      ${key}: ${value}ms`);
  }
  console.log('');
  process.exit(0);
}

// Compare against existing baseline
const { hasRegression, results } = compare(baselineData.baseline.metrics, currentMetrics);
printResults(results);

console.log(`Baseline recorded: ${baselineData.baseline.date} on ${baselineData.baseline.runner}`);

if (hasRegression) {
  console.error('\n❌ Performance regression detected! One or more metrics exceeded the 50% threshold.');
  console.error('   If this is intentional, update the baseline:');
  console.error('     node scripts/update-perf-baseline.mjs <results-dir>\n');
  process.exit(1);
} else {
  console.log('\n✅ All metrics within acceptable range.');
  process.exit(0);
}

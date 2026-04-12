import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Accumulated performance metrics for the current test run.
 * Written to a JSON file at the end of the run via a global teardown.
 */
const metrics: Record<string, number> = {};

/**
 * Record a performance metric. The metric name should be a stable identifier
 * that maps to a baseline entry (e.g. "vanilla.render500", "angular.scrollP95").
 */
export function recordMetric(name: string, value: number): void {
  metrics[name] = Math.round(value * 100) / 100;
}

/**
 * Write all accumulated metrics to a JSON file.
 * Called from the global teardown in playwright.config.ts.
 */
export function flushMetrics(runId: string): void {
  if (Object.keys(metrics).length === 0) return;

  const outDir = resolve(__dirname, '..', 'test-results');
  mkdirSync(outDir, { recursive: true });

  const filePath = resolve(outDir, `perf-metrics-${runId}.json`);
  writeFileSync(filePath, JSON.stringify(metrics, null, 2) + '\n');
  console.log(`📊 Wrote ${Object.keys(metrics).length} perf metrics to ${filePath}`);
}

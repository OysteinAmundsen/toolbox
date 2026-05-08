// Shared helpers and constants for benchmark adapters.
// Pure functions only — no DOM mutation or grid-specific code.

import type { BenchmarkColumn, BenchmarkRow, MetricName } from './types.js';
import { MEMORY_METRIC } from './types.js';

export const SCALE_POINTS = [5_000, 100_000, 500_000, 1_000_000];
export const COL_COUNT = 10;
/** Repeat each metric this many times and report trimmed mean. */
export const ITERATIONS = 5;
/** Single frame @ 60fps. Below this threshold, results are within measurement noise. */
export const NOISE_FLOOR_MS = 17;

interface ChromePerformance {
  memory?: { usedJSHeapSize: number };
}
interface WindowWithGc {
  gc?: () => void;
}
export const hasMemoryApi = !!(performance as unknown as ChromePerformance).memory;

export function generateColumns(count: number): BenchmarkColumn[] {
  const columns: BenchmarkColumn[] = [{ field: 'id', header: 'ID', width: 80 }];
  for (let i = 1; i < count; i++) {
    columns.push({ field: `col${i}`, header: `Column ${i}`, width: 120 });
  }
  return columns;
}

export function generateRows(rowCount: number, columnCount: number): BenchmarkRow[] {
  const rows: BenchmarkRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: BenchmarkRow = { id: i + 1 };
    for (let j = 1; j < columnCount; j++) {
      row[`col${j}`] = `R${i + 1}C${j}`;
    }
    rows.push(row);
  }
  return rows;
}

/** Fisher-Yates shuffle (in-place). Used to randomize row order before sort
 *  benchmarks so we measure real O(n log n), not O(n) reverse-of-sorted. */
export function shuffleRows(rows: BenchmarkRow[]): BenchmarkRow[] {
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

export function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function formatMetric(metric: MetricName, value: number): string {
  return metric === MEMORY_METRIC ? formatBytes(value) : formatTime(value);
}

export function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export const nextFrame = (): Promise<void> =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export const cooldown = (ms = 500): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Measure the full visual update cycle: API call + one rAF for deferred
 * rendering to complete. Uses identical methodology for every adapter so
 * the ~16ms frame cost applies equally. Always measures "time until the
 * DOM reflects the change", not "time to schedule work".
 */
export const measureVisual = async (fn: () => void | Promise<void>): Promise<number> => {
  await nextFrame(); // settle before measuring
  const start = performance.now();
  await fn();
  await new Promise<void>((r) => requestAnimationFrame(() => r())); // one frame to complete deferred work
  return performance.now() - start;
};

/**
 * Run a measurement ITERATIONS times and return the trimmed mean (drop min & max).
 * `measure` performs the operation and returns the time.
 * `reset` is called between iterations to restore state (e.g. clear filter).
 */
export async function measureAvg(measure: () => Promise<number>, reset?: () => void | Promise<void>): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    samples.push(await measure());
    if (reset) {
      await reset();
      await nextFrame();
      await cooldown(30);
    }
  }
  if (samples.length >= 4) {
    samples.sort((a, b) => a - b);
    const trimmed = samples.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

export async function measureMemoryBaseline(): Promise<number | null> {
  const mem = (performance as unknown as ChromePerformance).memory;
  if (!mem) return null;
  const w = window as unknown as WindowWithGc;
  if (typeof w.gc === 'function') {
    w.gc();
    await new Promise((r) => setTimeout(r, 100));
  }
  return mem.usedJSHeapSize;
}

/** Heap delta caused by a grid. Subtracts the pre-grid baseline. */
export async function measureMemoryDelta(baseline: number | null): Promise<number | null> {
  if (baseline === null) return null;
  const mem = (performance as unknown as ChromePerformance).memory;
  if (!mem) return null;
  const w = window as unknown as WindowWithGc;
  if (typeof w.gc === 'function') {
    w.gc();
    await new Promise((r) => setTimeout(r, 100));
  }
  return Math.max(0, mem.usedJSHeapSize - baseline);
}

/** Inject a CSS link tag (idempotent on URL). */
export function injectCss(href: string): void {
  if (document.head.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Inject a script tag and resolve when loaded. Idempotent on URL.
 * Pass `module: true` for ESM bundles (e.g. Stencil's `*.esm.js` loaders) —
 * those *must* be loaded as module scripts or the browser throws
 * `Cannot use import statement outside a module`.
 */
export function injectScript(src: string, opts?: { module?: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.head.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    if (opts?.module) script.type = 'module';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/** Best-effort fetch of a package.json `version` field from jsDelivr. */
export async function fetchPackageVersion(packageName: string): Promise<string> {
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/npm/${packageName}/package.json`);
    if (!res.ok) return '';
    const pkg = (await res.json()) as { version?: string };
    return pkg.version ?? '';
  } catch {
    return '';
  }
}

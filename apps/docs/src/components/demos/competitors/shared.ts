// Shared helpers and constants for benchmark adapters.
// Mostly pure functions; a small set of helpers (`injectCss`, `injectScript`)
// mutate `document.head` to load CDN dependencies. No grid-specific code.

import type { BenchmarkColumn, BenchmarkRow, MetricName, ScaleResult } from './types.js';
import { DOM_METRIC, MACRO_METRICS } from './types.js';

export const SCALE_POINTS = [5_000, 100_000, 500_000, 1_000_000];
export const COL_COUNT = 10;
/** Repeat each metric this many times and report trimmed mean. */
export const ITERATIONS = 5;
/** Single frame @ 60fps. Below this threshold, results are within measurement noise. */
export const FRAME_FLOOR_MS = 17;
export const REPLACEMENT_MARKER = 'REPLACED';

export function assertBenchmark(
  gridName: string,
  metric: MetricName,
  rowCount: number,
  condition: boolean,
  detail: string,
): void {
  if (!condition) {
    throw new Error(
      `[benchmark:${gridName}] ${metric} validation failed at ${formatRowCount(rowCount)} rows: ${detail}`,
    );
  }
}

export function markReplacement(rows: BenchmarkRow[]): BenchmarkRow[] {
  if (rows[0]) rows[0].col1 = REPLACEMENT_MARKER;
  return rows;
}

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

/** Seeded Fisher-Yates shuffle (in-place), giving every adapter the same sort input. */
export function shuffleRows(rows: BenchmarkRow[], seed = rows.length): BenchmarkRow[] {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

export function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function formatMetric(metric: MetricName, value: number): string {
  return metric === DOM_METRIC ? formatCount(value) : formatTime(value);
}

export function formatRowCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export const nextFrame = (): Promise<void> =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Resolve in the first task after the browser has had an opportunity to paint. */
export const afterNextPaint = (): Promise<void> =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

export const cooldown = (ms = 500): Promise<void> => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Measure API invocation through the first post-paint task. Work scheduled
 * into the next animation frame, plus that frame's style/layout/paint, is
 * included for every adapter.
 */
export const measureVisual = async (fn: () => void | Promise<void>): Promise<number> => {
  await nextFrame(); // settle before measuring
  const start = performance.now();
  await fn();
  await afterNextPaint();
  return performance.now() - start;
};

export function trimmedMean(samples: readonly number[]): number {
  if (samples.length === 0) return 0;
  if (samples.length < 4) return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
  const sorted = [...samples].sort((a, b) => a - b).slice(1, -1);
  return sorted.reduce((sum, sample) => sum + sample, 0) / sorted.length;
}

/**
 * Run a measurement ITERATIONS times and return the trimmed mean (drop min & max).
 * `measure` performs the operation and returns the time.
 * `reset` is called between iterations to restore state (e.g. clear filter).
 */
export async function measureAvg(
  measure: (iteration: number) => Promise<number>,
  reset?: () => void | Promise<void>,
): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    samples.push(await measure(i));
    if (reset) {
      await reset();
      await nextFrame();
      await cooldown(30);
    }
  }
  return trimmedMean(samples);
}

/** Repeat setup while retaining the final live instance for subsequent metrics. */
export async function measureRetained<T>(
  measure: (iteration: number) => Promise<{ duration: number; value: T }>,
  cleanup: (value: T) => void | Promise<void>,
): Promise<{ duration: number; value: T }> {
  const samples: number[] = [];
  let retained: T | undefined;
  for (let i = 0; i < ITERATIONS; i++) {
    const result = await measure(i);
    samples.push(result.duration);
    if (i < ITERATIONS - 1) {
      await cleanup(result.value);
      await nextFrame();
      await cooldown(30);
    } else {
      retained = result.value;
    }
  }
  if (retained === undefined) throw new Error('Benchmark setup produced no retained instance');
  return { duration: trimmedMean(samples), value: retained };
}

export interface MacroSummary {
  baselineWins: number;
  competitorWins: number;
  ties: number;
  geometricMean: number;
  pairedPoints: number;
}

/** Summarize paired macro observations; ratio >1 means the baseline is faster. */
export function summarizeMacroResults(allResults: readonly ScaleResult[]): MacroSummary {
  let baselineWins = 0;
  let competitorWins = 0;
  let ties = 0;
  const ratios: number[] = [];

  for (const result of allResults) {
    for (const metric of MACRO_METRICS) {
      const baseline = result.tbw.get(metric);
      const competitor = result.competitor.get(metric);
      if (baseline === undefined || competitor === undefined || baseline <= 0 || competitor <= 0) continue;

      const isTie = baseline < FRAME_FLOOR_MS && competitor < FRAME_FLOOR_MS;
      if (isTie) ties++;
      else if (baseline < competitor) baselineWins++;
      else if (competitor < baseline) competitorWins++;
      else ties++;
      if (!isTie) ratios.push(competitor / baseline);
    }
  }

  return {
    baselineWins,
    competitorWins,
    ties,
    geometricMean:
      ratios.length > 0
        ? Math.pow(
            ratios.reduce((product, ratio) => product * ratio, 1),
            1 / ratios.length,
          )
        : 1,
    pairedPoints: baselineWins + competitorWins + ties,
  };
}

/**
 * Count every element under `root`, recursing into open shadow roots.
 * Used as the "DOM nodes" benchmark metric — a deterministic, exact,
 * architecturally meaningful proxy for grid memory & render cost. Unlike
 * `performance.memory.usedJSHeapSize` (browser-quantized, unreliable
 * below ~1 MB), this is identical across runs and directly reflects what
 * each grid actually puts on the page.
 *
 * Closed shadow roots cannot be traversed from script; this is fine —
 * none of the benchmarked grids use closed shadow DOM for row content.
 */
export function countDomNodes(root: Element): number {
  let n = 1;
  const sr = (root as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  if (sr) for (const child of sr.children) n += countDomNodes(child);
  for (const child of root.children) n += countDomNodes(child);
  return n;
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
 * Inject a script tag and resolve when loaded. Idempotent on URL — concurrent
 * callers for the same `src` await the same in-flight load promise rather
 * than racing past a still-loading <script> tag.
 * Pass `module: true` for ESM bundles (e.g. Stencil's `*.esm.js` loaders) —
 * those *must* be loaded as module scripts or the browser throws
 * `Cannot use import statement outside a module`.
 */
const scriptLoadPromises = new Map<string, Promise<void>>();
export function injectScript(src: string, opts?: { module?: boolean }): Promise<void> {
  const existing = scriptLoadPromises.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const existingTag = document.head.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
    if (existingTag && existingTag.dataset.loaded === 'true') {
      resolve();
      return;
    }
    const script = existingTag ?? document.createElement('script');
    if (!existingTag) {
      script.src = src;
      if (opts?.module) script.type = 'module';
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)));
  });
  scriptLoadPromises.set(src, promise);
  return promise;
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

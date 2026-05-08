/**
 * Compare two Vitest benchmark JSON outputs and report regressions.
 *
 * Usage:
 *   bun tools/compare-benches.ts \
 *     --current <path> [--current <path> ...] \
 *     [--baseline <path>] \
 *     [--threshold <fraction, default 0.25>] \
 *     [--summary <github-step-summary-path>]
 *
 * `--current` may be passed multiple times; the resulting bench sets are
 * merged before comparison. This lets CI bench multiple Nx projects in one
 * step (each project produces its own JSON via `--outputJson`).
 *
 * Behaviour:
 *   - Joins benchmarks by `${file}::${group} > ${name}`.
 *   - For each pair, compares `hz` (ops/sec, higher is better).
 *   - Flags a REGRESSION when the current run is slower than baseline by more
 *     than `threshold` AND the slowdown is statistically meaningful (the two
 *     `hz ± moe` confidence intervals do not overlap). Both conditions must
 *     hold — this filters out runner noise (large absolute drift but inside
 *     the noise band) without hiding real algorithmic regressions.
 *   - Benches present on only one side are reported as "new" or "removed" and
 *     NEVER cause a non-zero exit. This is intentional: cold-start, cache
 *     expiry, and bench file additions/removals must not break the build.
 *   - Missing baseline file → exit 0 with an informational message. Same
 *     reason: the very first run after enabling this job has no baseline.
 *
 * Exit code: 0 on success / soft warn / no-baseline; 1 only on actual
 * regression when `--fail-on-regression` is passed.
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

// #region Types — shape of the Vitest --outputJson bench report

interface BenchEntry {
  name: string;
  hz: number;
  rme: number; // relative margin of error, as percent (e.g. 1.32 means ±1.32%)
  mean: number;
  moe?: number;
  sampleCount?: number;
}

interface BenchGroup {
  fullName: string; // e.g. "src/lib/core/internal/sorting.bench.ts > defaultComparator"
  benchmarks: BenchEntry[];
}

interface BenchFile {
  filepath: string;
  groups: BenchGroup[];
}

interface BenchReport {
  files: BenchFile[];
}

// #endregion

// #region CLI args

interface Args {
  current: string[];
  baseline?: string;
  threshold: number;
  summary?: string;
  failOnRegression: boolean;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { current: [], threshold: 0.25, failOnRegression: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--current') out.current.push(argv[++i]);
    else if (a === '--baseline') out.baseline = argv[++i];
    else if (a === '--threshold') out.threshold = Number(argv[++i]);
    else if (a === '--summary') out.summary = argv[++i];
    else if (a === '--fail-on-regression') out.failOnRegression = true;
  }
  if (!out.current) {
    console.error('Missing required --current <path>');
    process.exit(2);
  }
  return out;
}

// #endregion

// #region Flatten + index

interface FlatBench {
  key: string; // "<groupFullName> > <benchName>" — already includes filepath via groupFullName
  name: string;
  group: string;
  hz: number;
  rme: number;
  mean: number;
  moe: number;
}

function flatten(report: BenchReport): Map<string, FlatBench> {
  const out = new Map<string, FlatBench>();
  for (const file of report.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const b of group.benchmarks ?? []) {
        const key = `${group.fullName} > ${b.name}`;
        out.set(key, {
          key,
          name: b.name,
          group: group.fullName,
          hz: b.hz,
          rme: b.rme ?? 0,
          mean: b.mean,
          // Prefer Vitest's `moe` if present; otherwise derive from rme% (rme is a %).
          moe: b.moe ?? (b.mean * (b.rme ?? 0)) / 100,
        });
      }
    }
  }
  return out;
}

function loadReport(path: string): BenchReport {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as BenchReport;
}

// #endregion

// #region Comparison

type Status = 'regression' | 'improvement' | 'unchanged' | 'new' | 'removed';

interface ComparisonRow {
  key: string;
  status: Status;
  baselineHz?: number;
  currentHz?: number;
  /** Positive = faster, negative = slower. Fraction relative to baseline. */
  deltaPct?: number;
  noiseBand?: number;
}

/**
 * Confidence-interval test for hz (ops/sec, higher is better).
 *
 * `hz = 1 / mean`. We have moe (margin of error) on `mean`. Convert to bounds
 * on `hz` and check whether the upper bound of `current.hz` is below the
 * lower bound of `baseline.hz` (statistically slower) AND the relative
 * slowdown exceeds `threshold` (large enough to care about).
 */
function compareOne(baseline: FlatBench, current: FlatBench, threshold: number): ComparisonRow {
  const deltaPct = (current.hz - baseline.hz) / baseline.hz;

  // Convert mean ± moe to hz bounds. Lower mean = higher hz.
  const baselineHzLow = 1 / (baseline.mean + baseline.moe);
  const currentHzHigh = 1 / Math.max(current.mean - current.moe, Number.EPSILON);

  // Combined relative noise — used purely for reporting; the gating decision
  // uses the CI overlap above.
  const noiseBand = baseline.rme / 100 + current.rme / 100;

  const intervalsDisjointSlower = currentHzHigh < baselineHzLow;
  const isRegression = deltaPct < -threshold && intervalsDisjointSlower;
  const isImprovement = deltaPct > threshold && intervalsDisjointSlower;

  return {
    key: current.key,
    status: isRegression ? 'regression' : isImprovement ? 'improvement' : 'unchanged',
    baselineHz: baseline.hz,
    currentHz: current.hz,
    deltaPct,
    noiseBand,
  };
}

function compareReports(
  baseline: Map<string, FlatBench>,
  current: Map<string, FlatBench>,
  threshold: number,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const seen = new Set<string>();

  for (const [key, cur] of current) {
    seen.add(key);
    const base = baseline.get(key);
    if (!base) {
      rows.push({ key, status: 'new', currentHz: cur.hz });
      continue;
    }
    rows.push(compareOne(base, cur, threshold));
  }
  for (const [key, base] of baseline) {
    if (seen.has(key)) continue;
    rows.push({ key, status: 'removed', baselineHz: base.hz });
  }

  return rows;
}

// #endregion

// #region Reporting

const STATUS_EMOJI: Record<Status, string> = {
  regression: '🔴',
  improvement: '🟢',
  unchanged: '⚪',
  new: '🆕',
  removed: '🗑️',
};

function formatHz(hz?: number): string {
  if (hz == null || !isFinite(hz)) return '—';
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)}M`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(2)}K`;
  return hz.toFixed(2);
}

function formatPct(p?: number): string {
  if (p == null || !isFinite(p)) return '—';
  const sign = p >= 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function renderMarkdown(rows: ComparisonRow[], threshold: number): string {
  const regressions = rows.filter((r) => r.status === 'regression');
  const improvements = rows.filter((r) => r.status === 'improvement');
  const news = rows.filter((r) => r.status === 'new');
  const removed = rows.filter((r) => r.status === 'removed');
  const unchanged = rows.filter((r) => r.status === 'unchanged');

  const lines: string[] = [];
  lines.push('# Benchmark comparison');
  lines.push('');
  lines.push(`Threshold: **±${(threshold * 100).toFixed(0)}%** (CI-overlap gated)`);
  lines.push('');
  lines.push(
    `🔴 ${regressions.length} regression(s) · 🟢 ${improvements.length} improvement(s) · ⚪ ${unchanged.length} unchanged · 🆕 ${news.length} new · 🗑️ ${removed.length} removed`,
  );
  lines.push('');

  function table(label: string, set: ComparisonRow[]) {
    if (set.length === 0) return;
    lines.push(`## ${label}`);
    lines.push('');
    lines.push('| Bench | Baseline (hz) | Current (hz) | Δ |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of set) {
      lines.push(
        `| ${STATUS_EMOJI[r.status]} \`${r.key}\` | ${formatHz(r.baselineHz)} | ${formatHz(r.currentHz)} | ${formatPct(r.deltaPct)} |`,
      );
    }
    lines.push('');
  }

  table('Regressions', regressions);
  table('Improvements', improvements);
  table('New benches', news);
  table('Removed benches', removed);

  if (unchanged.length > 0) {
    lines.push(`<details><summary>Unchanged (${unchanged.length})</summary>`);
    lines.push('');
    lines.push('| Bench | Baseline (hz) | Current (hz) | Δ |');
    lines.push('| --- | --- | --- | --- |');
    for (const r of unchanged) {
      lines.push(
        `| ⚪ \`${r.key}\` | ${formatHz(r.baselineHz)} | ${formatHz(r.currentHz)} | ${formatPct(r.deltaPct)} |`,
      );
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  return lines.join('\n');
}

// #endregion

// #region Main

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.current.length === 0) {
    console.error('Missing required --current <path> (may be repeated)');
    process.exit(2);
  }
  for (const p of args.current) {
    if (!existsSync(p)) {
      console.error(`Current bench file not found: ${p}`);
      process.exit(2);
    }
  }

  if (!args.baseline || !existsSync(args.baseline)) {
    const msg =
      '## Benchmark comparison\n\nNo baseline available — skipping comparison. A baseline will be cached on the next push to `main`.';
    console.log(msg);
    if (args.summary) appendFileSync(args.summary, msg + '\n');
    process.exit(0);
  }

  const baseline = flatten(loadReport(args.baseline));
  // Merge multiple current reports (one per Vitest config / Nx project).
  const current = new Map<string, FlatBench>();
  for (const p of args.current) {
    for (const [k, v] of flatten(loadReport(p))) current.set(k, v);
  }
  const rows = compareReports(baseline, current, args.threshold);
  // Sort: regressions first, then improvements, then new, removed, unchanged.
  const order: Status[] = ['regression', 'improvement', 'new', 'removed', 'unchanged'];
  rows.sort((a, b) => {
    const oa = order.indexOf(a.status);
    const ob = order.indexOf(b.status);
    if (oa !== ob) return oa - ob;
    return (b.deltaPct ?? 0) - (a.deltaPct ?? 0);
  });

  const md = renderMarkdown(rows, args.threshold);
  console.log(md);
  if (args.summary) appendFileSync(args.summary, md + '\n');

  const regressions = rows.filter((r) => r.status === 'regression');
  if (regressions.length > 0 && args.failOnRegression) {
    console.error(
      `\n${regressions.length} bench regression(s) exceed ±${(args.threshold * 100).toFixed(0)}% threshold.`,
    );
    process.exit(1);
  }
}

main();

// #endregion

export { compareOne, compareReports, flatten, renderMarkdown };
export type { BenchReport, ComparisonRow, FlatBench, Status };

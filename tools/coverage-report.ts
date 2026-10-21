/**
 * Coverage Report — combines the per-project Vitest `json-summary` output into a
 * single Markdown table (one column per library), so CI can post ONE sticky PR
 * comment instead of one comment per library.
 *
 * Usage:
 *   bun tools/coverage-report.ts [--out <file>]
 *
 * Reads `coverage/libs/<project>/coverage-summary.json` (written by
 * `bun nx test <project> --coverage`). Projects without a summary (not affected
 * by the PR, so their tests did not run) are shown as "—".
 *
 * Prints the table to stdout, writes it to `--out` when given, and appends it to
 * `$GITHUB_STEP_SUMMARY` when that variable is set. Set `COVERAGE_SHA` to stamp
 * the commit the report was generated for.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// Thresholds mirror `test.coverage.thresholds` in each project's vite/vitest config.
const PROJECTS = [
  { label: 'Grid', dir: 'grid', threshold: 70 },
  { label: 'Grid-Vue', dir: 'grid-vue', threshold: 70 },
  { label: 'Grid-React', dir: 'grid-react', threshold: 70 },
  { label: 'Grid-Angular', dir: 'grid-angular', threshold: 70 },
] as const;

const METRICS = [
  { key: 'lines', label: 'Lines' },
  { key: 'statements', label: 'Statements' },
  { key: 'functions', label: 'Functions' },
  { key: 'branches', label: 'Branches' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

interface MetricSummary {
  total: number;
  covered: number;
}

type CoverageTotals = Record<MetricKey, MetricSummary>;

// ─── Helpers ──────────────────────────────────────────────────────────

function readTotals(dir: string): CoverageTotals | null {
  const file = resolve(ROOT, 'coverage', 'libs', dir, 'coverage-summary.json');
  if (!existsSync(file)) return null;
  const json = JSON.parse(readFileSync(file, 'utf8')) as { total: CoverageTotals };
  return json.total;
}

/** Istanbul reports `pct: "Unknown"` for zero totals, so derive the percentage ourselves. */
function percent({ total, covered }: MetricSummary): number {
  return total === 0 ? 100 : (covered / total) * 100;
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

// ─── Build table ──────────────────────────────────────────────────────

const results = PROJECTS.map((project) => ({ ...project, totals: readTotals(project.dir) }));

if (results.every((r) => r.totals === null)) {
  console.log('No coverage summaries found under coverage/libs/ — nothing to report.');
  process.exit(0);
}

const lines: string[] = [
  '## Coverage Report',
  '',
  `| Status | Category | ${results.map((r) => r.label).join(' | ')} |`,
  `| :----: | -------- | ${results.map(() => '----:').join(' | ')} |`,
];

for (const metric of METRICS) {
  let failing = false;
  const cells = results.map(({ totals, threshold }) => {
    if (!totals) return '—';
    const summary = totals[metric.key];
    const pct = percent(summary);
    const below = pct < threshold;
    failing ||= below;
    return `${below ? '🔴 ' : ''}${pct.toFixed(2)}% (${summary.covered}/${summary.total})`;
  });
  lines.push(`| ${failing ? '🔴' : '🟢'} | ${metric.label} | ${cells.join(' | ')} |`);
}

const thresholds = [...new Set(results.map((r) => r.threshold))];
const sha = process.env['COVERAGE_SHA'];
lines.push(
  '',
  `<sub>🟢 all libraries ≥ threshold · 🔴 at least one below threshold (${thresholds.map((t) => `${t}%`).join(' / ')})` +
    ` · — not affected, tests not run${sha ? ` · ${sha.slice(0, 7)}` : ''}</sub>`,
  '',
);

const markdown = lines.join('\n');

// ─── Output ───────────────────────────────────────────────────────────

console.log(markdown);

const out = argValue('--out');
if (out) {
  const target = resolve(process.cwd(), out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, markdown);
}

const stepSummary = process.env['GITHUB_STEP_SUMMARY'];
if (stepSummary) appendFileSync(stepSummary, markdown + '\n');

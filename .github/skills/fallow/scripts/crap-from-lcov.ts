/**
 * Re-score fallow's CRAP findings with REAL line coverage from an lcov file.
 *
 * Without `--coverage`, fallow assumes 0 % coverage (`coverage_tier: none`), so CRAP = CC² + CC and
 * `fallow audit` fails on well-tested functions with CC ≥ 5. Fallow only accepts Istanbul JSON /
 * raw V8, and the Nx vitest executor cannot switch the reporter from the CLI (dotted
 * `--coverage.*` flags are rejected; `--` passthrough overrides are ignored) — but every
 * `bun nx test grid --coverage` run writes `coverage/libs/grid/lcov.info`.
 *
 * Usage (from repo root):
 *   bunx fallow audit --base origin/main --format json > tmp/fallow-audit.json
 *   bun nx test grid --coverage            # full suite → coverage/libs/grid/lcov.info
 *   bun .github/skills/fallow/scripts/crap-from-lcov.ts [--audit tmp/fallow-audit.json]
 *     [--lcov coverage/libs/grid/lcov.info] [--root libs/grid] [--all]
 *
 * Scores `complexity.findings` (introduced only, unless `--all`) with
 * CRAP = CC² × (1 − lineCoverage)³ + CC over [line, line + line_count) — `line_count` includes `line`,
 * so the range must not borrow coverage from the next function. Threshold 30.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const auditPath = arg('--audit', 'tmp/fallow-audit.json');
const lcovPath = arg('--lcov', 'coverage/libs/grid/lcov.info');
const root = arg('--root', 'libs/grid');
const all = process.argv.includes('--all');

interface Finding {
  path: string;
  name: string;
  line: number;
  line_count?: number;
  cyclomatic: number;
  crap?: number;
  introduced?: boolean;
}

const norm = (p: string) => resolve(p).replace(/\\/g, '/').toLowerCase();
const hitsByFile = new Map<string, Map<number, number>>();
for (const rec of readFileSync(lcovPath, 'utf8').split('end_of_record')) {
  const sf = rec.match(/^SF:(.*)$/m);
  if (!sf) continue;
  const hits = new Map<number, number>();
  for (const da of rec.matchAll(/^DA:(\d+),(\d+)/gm)) hits.set(Number(da[1]), Number(da[2]));
  hitsByFile.set(norm(resolve(root, sf[1].trim())), hits);
}

const audit = JSON.parse(readFileSync(auditPath, 'utf8'));
const findings: Finding[] = (audit.complexity?.findings ?? audit.findings ?? []).filter(
  (f: Finding) => all || f.introduced,
);
if (findings.length === 0) console.log('No complexity findings to re-score.');
for (const f of findings) {
  const hits = hitsByFile.get(norm(f.path));
  const end = f.line + (f.line_count ?? 1) - 1;
  let total = 0;
  let hit = 0;
  for (let i = f.line; i <= end; i++) {
    const h = hits?.get(i);
    if (h === undefined) continue;
    total++;
    if (h > 0) hit++;
  }
  const cov = total ? hit / total : 0;
  const crap = f.cyclomatic ** 2 * (1 - cov) ** 3 + f.cyclomatic;
  const verdict = !hits ? 'UNVERIFIED (no lcov)' : crap >= 30 ? 'REAL' : 'ok (coverage artifact)';
  console.log(
    `${verdict.padEnd(22)} crap ${crap.toFixed(1).padStart(6)} (fallow ${f.crap ?? '?'}) cc ${f.cyclomatic} ` +
      `lines ${hit}/${total}  ${f.path}:${f.line} ${f.name}`,
  );
}

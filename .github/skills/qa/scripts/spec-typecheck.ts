/**
 * Type-check touched spec files and report ONLY errors on changed lines — `qa` skill.
 *
 * No Nx gate type-checks `*.spec.ts` (build-and-deploy.md → INVARIANT #470), and specs on `main`
 * already carry pre-existing errors, so a whole-file `tsc` is noise. This runs the one-file
 * `tsc --ignoreConfig` recipe per touched spec and intersects the errors with `git diff -U0` hunks.
 *
 * Usage (from repo root):
 *   bun .github/skills/qa/scripts/spec-typecheck.ts                 # working tree vs HEAD (+ untracked)
 *   bun .github/skills/qa/scripts/spec-typecheck.ts --base origin/main   # branch mode (<base>...HEAD)
 *
 * Exit 1 when any error lands on a changed line; prints per-file totals either way.
 * Ignores TS2307 for `?inline` CSS imports (known Vite-only noise).
 */
import { spawnSync } from 'node:child_process';
import { parseArgs, runBun } from './lib';

const args = parseArgs();
const base = typeof args.base === 'string' ? args.base : undefined;

const git = (...a: string[]): string => spawnSync('git', ['--no-pager', ...a], { encoding: 'utf8' }).stdout ?? '';
const range = base ? [`${base}...HEAD`] : ['HEAD'];

const changed = git('diff', '--name-only', ...range, '--', '*.spec.ts')
  .split(/\r?\n/)
  .filter(Boolean);
const untracked = base
  ? []
  : git('ls-files', '--others', '--exclude-standard', '--', '*.spec.ts').split(/\r?\n/).filter(Boolean);

/** Changed line ranges ([start, end], 1-based, inclusive) from `git diff -U0` hunk headers. */
function hunks(file: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of git('diff', '-U0', ...range, '--', file).matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    if (count > 0) out.push([start, start + count - 1]);
  }
  return out;
}

const TSC = [
  'x',
  'tsc',
  '--noEmit',
  '--pretty',
  'false',
  '--ignoreConfig',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'ESNext',
  '--moduleResolution',
  'bundler',
  '--lib',
  'ES2022,DOM,DOM.Iterable',
  '--types',
  'node',
];

let onChanged = 0;
const files = [...changed.map((f) => ({ f, whole: false })), ...untracked.map((f) => ({ f, whole: true }))];
if (!files.length) console.log('No touched *.spec.ts files.');
for (const { f, whole } of files) {
  const ranges = whole ? [[1, Number.MAX_SAFE_INTEGER] as [number, number]] : hunks(f);
  const norm = f.replace(/\\/g, '/');
  const errors = runBun([...TSC, f])
    .output.split(/\r?\n/)
    .map((l) => l.replace(/\\/g, '/'))
    .filter((l) => l.startsWith(`${norm}(`) && / error TS\d+/.test(l))
    .filter((l) => !(l.includes('TS2307') && l.includes('?inline')));
  const hits = errors.filter((l) => {
    const line = Number(/\((\d+),/.exec(l)?.[1]);
    return ranges.some(([s, e]) => line >= s && line <= e);
  });
  onChanged += hits.length;
  console.log(`${f}: ${errors.length} error(s), ${hits.length} on changed lines${whole ? ' (new file)' : ''}`);
  for (const h of hits) console.log(`  ${h}`);
}
process.exit(onChanged ? 1 : 0);

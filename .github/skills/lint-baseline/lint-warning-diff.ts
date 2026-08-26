/**
 * Compare a project's ESLint warnings against the pre-change baseline.
 *
 * `bun nx lint` exits 0 as long as there are no *errors*, so a refactor can
 * silently add warnings (dead imports, new `any`) and still look green. This
 * stashes the working tree, lints the clean baseline, restores, and reports the
 * delta.
 *
 * Usage:
 *   bun tools/lint-warning-diff.ts <project> [<project> ...]
 */
import { execFileSync } from 'node:child_process';

// eslint-disable-next-line no-control-regex -- stripping real ANSI escape codes from Nx output
const ANSI = /\x1b\[[0-9;]*m/g;

/** ESLint stylish output: a bare file path, then indented `line:col rule` rows. */
const FILE_LINE = /^(?:[A-Za-z]:\\|\/).*$/;
const WARNING_LINE = /^\s+\d+:\d+\s+warning\s+(.*?)\s{2,}([\w@/-]+)\s*$/;

type Counts = Map<string, number>;

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/** `rev-parse --verify` exits non-zero when the ref is absent. */
function gitQuiet(...args: string[]): string {
  try {
    return git(...args);
  } catch {
    return '';
  }
}

function lint(projects: string[]): string {
  try {
    return execFileSync(
      'bun',
      ['nx', 'run-many', '-t', 'lint', `--projects=${projects.join(',')}`, '--skip-nx-cache'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (err) {
    // Non-zero exit means lint *errors* exist; the output is still parseable.
    const e = err as { stdout?: string; stderr?: string };
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

/**
 * Key on file + rule + message rather than line:col — line numbers drift as
 * code moves, which would report every shifted warning as a false change.
 */
function parse(output: string): Counts {
  const counts: Counts = new Map();
  let file = '';
  for (const raw of output.replace(ANSI, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (FILE_LINE.test(line)) {
      file = line.replace(/\\/g, '/');
      continue;
    }
    const match = WARNING_LINE.exec(line);
    if (!match || !file) continue;
    const key = `${file}\u0000${match[2]}\u0000${match[1]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function total(counts: Counts): number {
  let sum = 0;
  for (const n of counts.values()) sum += n;
  return sum;
}

function report(before: Counts, after: Counts): number {
  const keys = new Set([...before.keys(), ...after.keys()]);
  const added: string[] = [];
  const removed: string[] = [];

  for (const key of keys) {
    const delta = (after.get(key) ?? 0) - (before.get(key) ?? 0);
    if (delta === 0) continue;
    const [file, rule, message] = key.split('\u0000');
    const short = file.replace(/^.*?\/(libs|apps|demos|tools|e2e)\//, '$1/');
    const entry = `  ${short}\n    ${Math.abs(delta)}× ${rule} — ${message}`;
    (delta > 0 ? added : removed).push(entry);
  }

  console.log(`\nbaseline: ${total(before)} warnings → current: ${total(after)} warnings\n`);
  if (added.length) console.log(`NEW (${added.length}):\n${added.join('\n')}\n`);
  if (removed.length) console.log(`FIXED (${removed.length}):\n${removed.join('\n')}\n`);
  if (!added.length && !removed.length) console.log('No warning changes.\n');
  return added.length;
}

const projects = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (projects.length === 0) {
  console.error('Usage: bun tools/lint-warning-diff.ts <project> [<project> ...]');
  process.exit(2);
}

if (git('status', '--porcelain').length === 0) {
  console.error('Working tree is clean — nothing to compare against the baseline.');
  process.exit(0);
}

console.log(`Linting current tree (${projects.join(', ')})…`);
const after = parse(lint(projects));

const stashBefore = gitQuiet('rev-parse', '--verify', '--quiet', 'refs/stash');
git('stash', 'push', '--include-untracked', '-m', 'lint-warning-diff');
if (gitQuiet('rev-parse', '--verify', '--quiet', 'refs/stash') === stashBefore) {
  console.error('git stash did not create an entry; aborting without measuring a baseline.');
  process.exit(1);
}

let before: Counts;
try {
  console.log('Linting baseline (changes stashed)…');
  before = parse(lint(projects));
} finally {
  try {
    git('stash', 'pop');
  } catch {
    console.error('\n!! Could not restore your changes automatically. Run: git stash pop\n');
    process.exit(1);
  }
}

process.exit(report(before, after) > 0 ? 1 : 0);

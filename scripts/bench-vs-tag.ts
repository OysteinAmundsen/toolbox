/**
 * Local "bench against a tagged release" utility.
 *
 * Mirrors the CI bench job (.github/workflows/ci.yml `bench:`):
 *   1. Resolve a baseline ref (default: last tag reachable from origin/main).
 *   2. Materialise that commit in a sibling git worktree.
 *   3. Run `vitest bench` on selected projects in BOTH worktrees on this
 *      machine (same CPU / kernel / thermal state — the whole point of the
 *      same-runner methodology, locally reproduced).
 *   4. Merge per-project / per-iteration JSON via tools/merge-bench-runs.ts.
 *   5. Compare via tools/compare-benches.ts and print the same step-summary
 *      Markdown that CI posts.
 *
 * Usage:
 *   bun scripts/bench-vs-tag.ts                       # default: last tag, all bench projects, 1 iter
 *   bun scripts/bench-vs-tag.ts --ref grid-2.7.0      # explicit tag/SHA
 *   bun scripts/bench-vs-tag.ts --project grid        # subset (repeatable)
 *   bun scripts/bench-vs-tag.ts --iterations 2        # max-of-N per side
 *   bun scripts/bench-vs-tag.ts --threshold 0.20      # tighter regression gate
 *   bun scripts/bench-vs-tag.ts --keep-worktree       # don't delete ../base on exit
 *
 * Notes:
 *   - The worktree lives at `<repo-parent>/<repo-name>-bench-baseline` by
 *     default (mirrors CI's `../base`). Override with `--worktree <path>`.
 *   - The worktree is removed on exit unless `--keep-worktree` is passed
 *     (useful when iterating: skip the second `bun install` cost).
 *   - Run with a quiet machine. Close browsers, stop dev servers, etc.
 *     Same-runner sampling cancels VM/thermal noise but NOT app-level CPU
 *     contention from your own desktop.
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// #region CLI parsing

interface CliOptions {
  ref: string | null; // null = auto-detect
  projects: string[]; // empty = all known
  iterations: number;
  threshold: number;
  worktree: string | null;
  keepWorktree: boolean;
  failOnRegression: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    ref: null,
    projects: [],
    iterations: 1,
    threshold: 0.3,
    worktree: null,
    keepWorktree: false,
    failOnRegression: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? die(`Missing value for ${a}`);
    switch (a) {
      case '--ref':
        opts.ref = next();
        break;
      case '--project':
        opts.projects.push(next());
        break;
      case '--iterations':
        opts.iterations = Math.max(1, Number(next()));
        break;
      case '--threshold':
        opts.threshold = Number(next());
        break;
      case '--worktree':
        opts.worktree = resolve(next());
        break;
      case '--keep-worktree':
        opts.keepWorktree = true;
        break;
      case '--fail-on-regression':
        opts.failOnRegression = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        die(`Unknown argument: ${a}`);
    }
  }
  return opts;
}

function printHelp(): void {
  // Strip the leading JSDoc block from this file and print the Usage section.
  console.log(`
Local bench vs. tagged release.

  bun scripts/bench-vs-tag.ts [options]

Options:
  --ref <tag-or-sha>     Baseline ref. Default: last tag reachable from origin/main.
  --project <name>       Bench project to run (repeatable). Default: grid, grid-react, grid-vue.
  --iterations <n>       Bench iterations per side (max-of-N merge). Default: 1.
  --threshold <fraction> Regression threshold. Default: 0.30.
  --worktree <path>      Path for baseline worktree. Default: <repo>-bench-baseline sibling.
  --keep-worktree        Leave the worktree on disk after the run (faster reruns).
  --fail-on-regression   Exit non-zero if compare-benches reports any regression.
  -h, --help             Show this help.
`);
}

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(2);
}

// #endregion

// #region Process helpers

function sh(cmd: string[], cwd: string = ROOT, opts: { capture?: boolean; allowFail?: boolean } = {}): string {
  const proc = Bun.spawnSync(cmd, {
    cwd,
    stdout: opts.capture ? 'pipe' : 'inherit',
    stderr: opts.capture ? 'pipe' : 'inherit',
    env: { ...process.env, NX_DAEMON: 'false' },
  });
  if (proc.exitCode !== 0 && !opts.allowFail) {
    if (opts.capture) {
      console.error(proc.stderr?.toString() ?? '');
    }
    die(`Command failed (exit ${proc.exitCode}): ${cmd.join(' ')}`);
  }
  return opts.capture ? (proc.stdout?.toString() ?? '').trim() : '';
}

// #endregion

// #region Baseline resolution

function resolveBaseline(refArg: string | null): { ref: string; sha: string; label: string } {
  // Make sure tags from origin/main are present locally before describing.
  // `allowFail: true` because some local clones won't have an `origin` remote
  // (e.g. forks); we'll still try `git describe` against whatever's local.
  sh(['git', 'fetch', '--tags', '--quiet', 'origin', 'main'], ROOT, { allowFail: true });

  let ref = refArg;
  if (!ref) {
    ref = sh(['git', 'describe', '--tags', '--abbrev=0', 'origin/main'], ROOT, {
      capture: true,
      allowFail: true,
    });
  }
  if (!ref) {
    ref = sh(['git', 'describe', '--tags', '--abbrev=0', 'main'], ROOT, {
      capture: true,
      allowFail: true,
    });
  }

  if (!ref) die('Could not resolve a baseline ref. Pass --ref <tag-or-sha> explicitly.');

  const sha = sh(['git', 'rev-list', '-n', '1', ref], ROOT, { capture: true });
  if (!sha) die(`Ref '${ref}' did not resolve to a SHA.`);
  return { ref, sha, label: refArg ? ref : `${ref} (latest tag on main)` };
}

// #endregion

// #region Project → vite config map (mirrors CI bench step)

const PROJECT_CONFIGS: Record<string, string> = {
  grid: 'libs/grid/vite.config.ts',
  'grid-react': 'libs/grid-react/vite.config.mts',
  'grid-vue': 'libs/grid-vue/vite.config.mts',
};

function selectProjects(requested: string[]): string[] {
  if (requested.length === 0) return Object.keys(PROJECT_CONFIGS);
  for (const p of requested) {
    if (!(p in PROJECT_CONFIGS)) die(`Unknown bench project '${p}'. Known: ${Object.keys(PROJECT_CONFIGS).join(', ')}`);
  }
  return requested;
}

// #endregion

// #region Worktree lifecycle

function ensureWorktree(sha: string, target: string): void {
  if (existsSync(target)) {
    console.log(`[bench-vs-tag] Reusing existing worktree: ${target}`);
    sh(['git', '-C', target, 'checkout', '--quiet', sha]);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  sh(['git', 'worktree', 'add', '--quiet', target, sha]);
}

function removeWorktree(target: string): void {
  if (!existsSync(target)) return;
  sh(['git', 'worktree', 'remove', '--force', target], ROOT, { allowFail: true });
  // Belt-and-braces: git sometimes leaves the dir on Windows if files are locked.
  if (existsSync(target)) {
    try {
      rmSync(target, { recursive: true, force: true });
    } catch {
      console.warn(`[bench-vs-tag] Could not remove worktree dir ${target}; clean up manually.`);
    }
  }
}

// #endregion

// #region Bench execution

function runBenchSide(
  side: 'baseline' | 'current',
  cwd: string,
  projects: string[],
  iterations: number,
  outDir: string,
): void {
  console.log(`\n[bench-vs-tag] ${side}: bun install (cwd=${cwd})`);
  sh(['bun', 'install'], cwd);

  for (const project of projects) {
    const config = PROJECT_CONFIGS[project];
    for (let i = 1; i <= iterations; i++) {
      const out = resolve(outDir, `bench-${side}-${project}-${i}.json`);
      console.log(`\n[bench-vs-tag] ${side}: ${project} run ${i}/${iterations}`);
      sh(['bunx', 'vitest', 'bench', '--config', config, '--run', `--outputJson=${out}`], cwd);
    }
  }
}

// #endregion

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const projects = selectProjects(opts.projects);
  const baseline = resolveBaseline(opts.ref);

  const repoName = basename(ROOT);
  const worktreePath = opts.worktree ?? resolve(ROOT, '..', `${repoName}-bench-baseline`);
  const tmpDir = resolve(ROOT, 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  console.log(`[bench-vs-tag] Baseline: ${baseline.label} → ${baseline.sha}`);
  console.log(`[bench-vs-tag] Projects: ${projects.join(', ')}`);
  console.log(`[bench-vs-tag] Iterations per side: ${opts.iterations}`);
  console.log(`[bench-vs-tag] Worktree: ${worktreePath}`);
  console.log(`[bench-vs-tag] Threshold: ${opts.threshold} (fail-on-regression=${opts.failOnRegression})`);

  const cleanup = () => {
    if (!opts.keepWorktree) removeWorktree(worktreePath);
  };
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  let exitCode = 0;
  try {
    ensureWorktree(baseline.sha, worktreePath);

    // Baseline first — warm-up cost (bun install, fs cache, JIT) is paid
    // before measuring HEAD, mirroring the CI ordering.
    runBenchSide('baseline', worktreePath, projects, opts.iterations, tmpDir);
    runBenchSide('current', ROOT, projects, opts.iterations, tmpDir);

    // Merge max-of-N per side.
    const baselineGlob = projects.flatMap((p) =>
      Array.from({ length: opts.iterations }, (_, i) => resolve(tmpDir, `bench-baseline-${p}-${i + 1}.json`)),
    );
    const currentGlob = projects.flatMap((p) =>
      Array.from({ length: opts.iterations }, (_, i) => resolve(tmpDir, `bench-current-${p}-${i + 1}.json`)),
    );

    const mergedBaseline = resolve(tmpDir, 'bench-baseline.json');
    const mergedCurrent = resolve(tmpDir, 'bench-current.json');

    sh(['bun', resolve(ROOT, 'tools/merge-bench-runs.ts'), '--output', mergedBaseline, ...baselineGlob]);
    sh(['bun', resolve(ROOT, 'tools/merge-bench-runs.ts'), '--output', mergedCurrent, ...currentGlob]);

    console.log(`\n[bench-vs-tag] Comparing current vs baseline (${baseline.label})\n`);
    const compareArgs = [
      'bun',
      resolve(ROOT, 'tools/compare-benches.ts'),
      '--current',
      mergedCurrent,
      '--baseline',
      mergedBaseline,
      '--threshold',
      String(opts.threshold),
    ];
    if (opts.failOnRegression) compareArgs.push('--fail-on-regression');

    const proc = Bun.spawnSync(compareArgs, { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
    exitCode = proc.exitCode ?? 0;
  } finally {
    cleanup();
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

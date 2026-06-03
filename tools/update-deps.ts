/**
 * Dependency update — the safe, repeatable monthly upgrade procedure.
 *
 * Why a script and not an npm one-liner: upgrading this repo means sequencing
 * `nx migrate` (codemods for the Nx + Angular clusters) with `npm-check-updates`
 * (everything else), then PROVING the result with lint + test + build (+ e2e)
 * before you trust it. A shell `&&` chain can't roll back, can't report which
 * step failed, and silently let a bad `--target` flag override `.ncurc.cjs`.
 *
 * Cluster safety lives in `.ncurc.cjs` (picked up automatically by ncu): the
 * `nx migrate`-owned families are rejected outright, and the major-locked
 * clusters are pinned to `minor` so they upgrade WITHIN their current major.
 * This script deliberately calls ncu with NO `--target` flag so the config's
 * per-package logic wins — passing `--target` on the CLI would override it.
 *
 * Usage:
 *   bun tools/update-deps.ts                 # migrate + ncu + install + verify (lint, test, build)
 *   bun tools/update-deps.ts --dry-run       # report planned ncu changes only; change nothing
 *   bun tools/update-deps.ts --e2e           # also run the full e2e suite — demos + docs (slow)
 *   bun tools/update-deps.ts --skip-migrate  # skip nx migrate (ncu-only refresh)
 *   bun tools/update-deps.ts --skip-verify   # upgrade only, no lint/test/build
 *   bun tools/update-deps.ts --yes           # don't prompt on a dirty working tree
 *
 * On success it prints a suggested commit message. It never commits for you.
 * If verification fails, your pre-update commit SHA is printed so you can
 * `git restore` and `bun install` back to a known-good state.
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// #region CLI parsing

interface CliOptions {
  dryRun: boolean;
  e2e: boolean;
  skipMigrate: boolean;
  skipVerify: boolean;
  yes: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const has = (flag: string) => argv.includes(flag);
  return {
    dryRun: has('--dry-run'),
    e2e: has('--e2e'),
    skipMigrate: has('--skip-migrate'),
    skipVerify: has('--skip-verify'),
    yes: has('--yes') || has('-y'),
  };
}

// #endregion

// #region Shell helpers

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function heading(text: string): void {
  console.log(`\n${BOLD}${CYAN}━━ ${text} ━━${RESET}`);
}

/** Run a command with inherited stdio. Returns true on exit code 0. */
function run(cmd: string): boolean {
  console.log(`${DIM}$ ${cmd}${RESET}`);
  const result = spawnSync(cmd, { cwd: ROOT, stdio: 'inherit', shell: true });
  return result.status === 0;
}

/** Run a command and capture stdout (used for git plumbing). */
function capture(cmd: string): string {
  const result = spawnSync(cmd, { cwd: ROOT, encoding: 'utf8', shell: true });
  return (result.stdout ?? '').trim();
}

function die(message: string): never {
  console.error(`\n${RED}✖ ${message}${RESET}`);
  process.exit(1);
}

// #endregion

// #region Steps

/** Abort early if the working tree is dirty so rollback stays trivial. */
function preflight(opts: CliOptions): string {
  const status = capture('git status --porcelain');
  if (status && !opts.yes && !opts.dryRun) {
    die(
      'Working tree is not clean. Commit or stash first so you can roll back\n' +
        '  a failed upgrade with a single `git restore`. Override with --yes.',
    );
  }
  const sha = capture('git rev-parse --short HEAD');
  console.log(`${DIM}Pre-update commit: ${sha}${RESET}`);
  return sha;
}

/** Bump Nx + Angular via codemods, then everything else via ncu + install. */
function upgrade(opts: CliOptions): void {
  if (!opts.skipMigrate) {
    heading('nx migrate (Nx + Angular codemods)');
    if (!run('bun nx migrate latest')) die('nx migrate latest failed.');
    if (!run('bun nx migrate --run-migrations --if-exists')) die('Running Nx migrations failed.');
  }

  heading('npm-check-updates (cluster-aware via .ncurc.cjs)');
  // NO --target flag: let .ncurc.cjs decide latest-vs-minor per package.
  if (!run('bunx npm-check-updates --format group -u --cooldown 5')) die('npm-check-updates failed.');

  heading('bun install');
  if (!run('bun install')) die('bun install failed.');
}

interface VerifyStep {
  label: string;
  cmd: string;
}

/** Lint + test + build (+ optional e2e). Stops at the first failure. */
function verify(opts: CliOptions): void {
  const steps: VerifyStep[] = [
    {
      label: 'lint',
      cmd: 'bun nx run-many --target=lint --output-style=stream',
    },
    {
      label: 'test',
      cmd: 'bun nx run-many --target=test --exclude=demo-angular --output-style=stream --silent',
    },
    {
      label: 'build',
      cmd: 'bun nx run-many --target=build --exclude=docs --output-style=stream',
    },
  ];
  // e2e builds + serves the demos itself (see the `e2e:full` script). docs-e2e
  // is self-serving (own Playwright webServer) and is the ONLY suite that
  // exercises the Astro/Starlight docs cluster — the most upgrade-sensitive
  // surface — so include it explicitly when verifying a dependency bump.
  if (opts.e2e) {
    steps.push({ label: 'e2e (demos)', cmd: 'bun run e2e:full' });
    steps.push({ label: 'e2e (docs)', cmd: 'bun nx e2e docs-e2e' });
  }

  for (const step of steps) {
    heading(`verify: ${step.label}`);
    if (!run(step.cmd)) {
      die(
        `Verification failed at "${step.label}". The upgrade is NOT safe.\n` +
          '  Inspect the failure, then either fix forward or roll back with:\n' +
          '    git restore --source=HEAD --staged --worktree . && bun install',
      );
    }
  }
}

// #endregion

// #region Main

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.dryRun) {
    heading('Dry run — planned dependency changes (nothing is written)');
    // ncu without -u reports only; .ncurc.cjs still scopes the targets.
    run('bunx npm-check-updates --format group --cooldown 5');
    console.log(`\n${DIM}Dry run only. Re-run without --dry-run to apply, migrate, and verify.${RESET}`);
    return;
  }

  const sha = preflight(opts);
  upgrade(opts);

  if (opts.skipVerify) {
    console.log(`\n${GREEN}✔ Dependencies upgraded${RESET} (verification skipped via --skip-verify).`);
  } else {
    verify(opts);
    console.log(`\n${GREEN}✔ Upgrade verified — lint, test, and build all pass.${RESET}`);
  }

  console.log(
    `\n${BOLD}Next:${RESET} review the diff, then commit. Suggested message:\n` +
      `  ${CYAN}chore(deps): update dependencies${RESET}\n` +
      `${DIM}Roll back if needed: git restore --source=${sha} --staged --worktree . && bun install${RESET}`,
  );
}

main();

// #endregion

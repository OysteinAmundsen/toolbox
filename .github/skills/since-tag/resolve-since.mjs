#!/usr/bin/env bun
/**
 * Deterministically resolve the `@since` version to stamp on a NEW public
 * symbol you are adding right now. Removes the guesswork that otherwise
 * burns QA prompts fixing wrong `@since` values.
 *
 * Algorithm (mirrors release-please's semantics):
 *   lastReleased = .release-please-manifest.json[libs/<lib>]  (authoritative
 *                  last *published* version; falls back to the lib's
 *                  package.json "version" if the manifest is missing the key)
 *   staged       = version in libs/<lib>/package.json on the open
 *                  release-please branch (origin/release-please--branches--main).
 *                  This already equals lastReleased bumped by the highest
 *                  queued conventional-commit tier. If the branch/file is
 *                  absent (no queued release), staged = lastReleased.
 *   prCandidate  = lastReleased bumped by THIS change's tier (the <bump> arg)
 *   result       = semver max(staged, prCandidate)
 *
 * A PR can only RAISE release-please's staged tier, never lower it, so taking
 * the max is always correct.
 *
 * Usage:
 *   bun .github/skills/since-tag/resolve-since.mjs <lib> <bump> [--no-fetch]
 *
 *   <lib>   grid | grid-angular | grid-react | grid-vue   (default: grid)
 *   <bump>  feat | fix | perf | refactor | feat! | breaking
 *           | major | minor | patch                        (default: feat)
 *   --no-fetch   skip the best-effort `git fetch` of the release-please branch
 *
 * Output: the resolved version on stdout (just the string, pipeable);
 *         a one-line explanation on stderr.
 *
 * Examples:
 *   bun .github/skills/since-tag/resolve-since.mjs grid feat
 *   SINCE=$(bun .github/skills/since-tag/resolve-since.mjs grid-react fix)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

const VALID_LIBS = new Set(['grid', 'grid-angular', 'grid-react', 'grid-vue']);
const RELEASE_BRANCH = 'release-please--branches--main';

const MAJOR = 'major';
const MINOR = 'minor';
const PATCH = 'patch';

/** Map a bump keyword (commit type or explicit tier) to a semver tier. */
function tierOf(bump) {
  switch (bump) {
    case 'feat!':
    case 'breaking':
    case 'major':
      return MAJOR;
    case 'feat':
    case 'minor':
      return MINOR;
    case 'fix':
    case 'perf':
    case 'refactor':
    case 'patch':
      return PATCH;
    default:
      process.stderr.write(`warn: unknown bump "${bump}", assuming patch\n`);
      return PATCH;
  }
}

function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version ?? '');
  if (!m) throw new Error(`Cannot parse semver from "${version}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function bumpVersion(version, tier) {
  const v = parse(version);
  if (tier === MAJOR) return `${v.major + 1}.0.0`;
  if (tier === MINOR) return `${v.major}.${v.minor + 1}.0`;
  return `${v.major}.${v.minor}.${v.patch + 1}`;
}

/** Return the greater of two semver strings. */
function maxVersion(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major > pb.major ? a : b;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? a : b;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? a : b;
  return a;
}

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, 'utf-8'));
}

/** Authoritative last-published version for a lib. */
function lastReleasedVersion(lib) {
  const manifestPath = resolve(repoRoot, '.release-please-manifest.json');
  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    const key = `libs/${lib}`;
    if (manifest[key]) return manifest[key];
  }
  // Fallback: the lib's own package.json version.
  return readJson(resolve(repoRoot, `libs/${lib}/package.json`)).version;
}

/**
 * Version staged on the open release-please branch, or null if there is no
 * queued release for this lib. Best-effort: tries the local remote-tracking
 * ref first, then one optional fetch.
 */
function stagedVersion(lib, allowFetch) {
  const ref = `origin/${RELEASE_BRANCH}:libs/${lib}/package.json`;
  const tryShow = () => {
    try {
      const out = execFileSync('git', ['show', ref], {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return JSON.parse(out).version ?? null;
    } catch {
      return null;
    }
  };

  let staged = tryShow();
  if (staged === null && allowFetch) {
    try {
      execFileSync('git', ['fetch', '--quiet', 'origin', `${RELEASE_BRANCH}:refs/remotes/origin/${RELEASE_BRANCH}`], {
        cwd: repoRoot,
        stdio: 'ignore',
      });
      staged = tryShow();
    } catch {
      // offline / no such branch — leave staged null
    }
  }
  return staged;
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--no-fetch');
  const allowFetch = !process.argv.includes('--no-fetch');

  const lib = args[0] ?? 'grid';
  const bump = args[1] ?? 'feat';

  if (!VALID_LIBS.has(lib)) {
    process.stderr.write(`error: unknown lib "${lib}". Valid: ${[...VALID_LIBS].join(', ')}\n`);
    process.exit(1);
  }

  const lastReleased = lastReleasedVersion(lib);
  const staged = stagedVersion(lib, allowFetch);
  const prTier = tierOf(bump);
  const prCandidate = bumpVersion(lastReleased, prTier);

  const baseline = staged ?? lastReleased;
  const resolved = maxVersion(baseline, prCandidate);

  const reason =
    staged === null
      ? `no queued release-please branch; lastReleased ${lastReleased} + ${prTier} → ${resolved}`
      : maxVersion(staged, prCandidate) === staged && staged !== prCandidate
        ? `staged ${staged} (queued) ≥ your ${prTier} bump of ${lastReleased} → ${resolved}`
        : `your ${prTier} bump of ${lastReleased} (${prCandidate}) ≥ staged ${staged} → ${resolved}`;

  process.stderr.write(`[since] ${lib}: ${reason}\n`);
  process.stdout.write(`${resolved}\n`);
}

main();

#!/usr/bin/env bun
/**
 * Map every public top-level export of each library to the first published
 * version tag that contains it. Writes the result to
 * `tools/since-map.json` for the companion `apply-since-tags.ts` script
 * to consume.
 *
 * For each library:
 *   1. Use the TypeScript compiler to enumerate top-level exports of the
 *      package's public entry point (`src/public.ts` or `src/index.ts`).
 *      Re-exports (`export * from './x'`, `export { Foo } from './x'`) are
 *      followed transitively until we land on the symbol's declaration file.
 *   2. For each (file, exportName) pair, ask git for the first commit that
 *      added a definition or `export` line for that symbol within the lib
 *      directory.
 *   3. Find the earliest version tag (`<lib>-X.Y.Z` or `vX.Y.Z`) whose
 *      tagged commit is a descendant of (or equals) that commit.
 *
 * The tag→commit→ancestor query uses `git tag --contains <sha>` filtered
 * to the relevant tag prefix.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import * as ts from 'typescript';

interface LibConfig {
  /** npm package short label, used for output keys */
  label: 'grid' | 'grid-angular' | 'grid-react' | 'grid-vue';
  /** absolute path to the lib's source root */
  srcRoot: string;
  /** absolute paths to public entry points (one lib can have several) */
  entries: string[];
  /** git tag prefixes that count toward this lib's version history */
  tagPrefixes: string[];
}

const repoRoot = resolve(import.meta.dirname, '..');

/** All grid plugin sub-entries (each has its own typedoc entry point). */
function gridPluginEntries(): string[] {
  const pluginsDir = resolve(repoRoot, 'libs/grid/src/lib/plugins');
  return readdirSync(pluginsDir)
    .map((name) => resolve(pluginsDir, name, 'index.ts'))
    .filter((p) => existsSync(p));
}

const libs: LibConfig[] = [
  {
    label: 'grid',
    srcRoot: resolve(repoRoot, 'libs/grid/src'),
    entries: [resolve(repoRoot, 'libs/grid/src/public.ts'), ...gridPluginEntries()],
    tagPrefixes: ['grid-', 'v'],
  },
  {
    label: 'grid-angular',
    srcRoot: resolve(repoRoot, 'libs/grid-angular'),
    entries: [resolve(repoRoot, 'libs/grid-angular/src/index.ts')],
    tagPrefixes: ['grid-angular-'],
  },
  {
    label: 'grid-react',
    srcRoot: resolve(repoRoot, 'libs/grid-react/src'),
    entries: [resolve(repoRoot, 'libs/grid-react/src/index.ts')],
    tagPrefixes: ['grid-react-'],
  },
  {
    label: 'grid-vue',
    srcRoot: resolve(repoRoot, 'libs/grid-vue/src'),
    entries: [resolve(repoRoot, 'libs/grid-vue/src/index.ts')],
    tagPrefixes: ['grid-vue-'],
  },
];

function git(...args: string[]): string {
  // Use execFileSync with an args array (no shell) so that paths and
  // user-supplied identifiers cannot be reinterpreted as shell syntax.
  // Addresses CodeQL "Shell command built from environment values".
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 32 * 1024 * 1024,
      shell: false,
    }).trim();
  } catch {
    return '';
  }
}

interface TagEntry {
  tag: string;
  /** parsed semver-ish tuple for sorting; -1 for prerelease */
  sortKey: [number, number, number, number];
}

function parseTag(tag: string, prefixes: string[]): TagEntry | null {
  for (const prefix of prefixes) {
    if (!tag.startsWith(prefix)) continue;
    const rest = tag.slice(prefix.length);
    // strip any -rc.N suffix
    const m = rest.match(/^(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/);
    if (!m) return null;
    const [, maj, min, pat, rc] = m;
    return {
      tag,
      sortKey: [Number(maj), Number(min), Number(pat), rc ? Number(rc) : Number.MAX_SAFE_INTEGER],
    };
  }
  return null;
}

function tagsForLib(lib: LibConfig): TagEntry[] {
  const out = git('tag', '--list');
  return out
    .split(/\r?\n/)
    .map((t) => parseTag(t.trim(), lib.tagPrefixes))
    .filter((t): t is TagEntry => t !== null)
    .sort((a, b) => {
      for (let i = 0; i < 4; i++) {
        if (a.sortKey[i] !== b.sortKey[i]) return a.sortKey[i] - b.sortKey[i];
      }
      return 0;
    });
}

/**
 * For a given commit SHA, find the earliest tag (per lib's prefixes) that
 * is at or descended from that commit. Returns the bare semver string
 * (e.g. `2.4.0`), or `null` if no matching tag exists yet.
 */
function firstTagContaining(sha: string, sortedTags: TagEntry[]): string | null {
  if (!sha) return null;
  const containing = git('tag', '--contains', sha);
  if (!containing) return null;
  const set = new Set(
    containing
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  // Walk in sorted order so we return the lowest-numbered version.
  for (const entry of sortedTags) {
    if (!set.has(entry.tag)) continue;
    // Strip prefix to leave bare semver.
    for (const prefix of ['grid-angular-', 'grid-react-', 'grid-vue-', 'grid-', 'v']) {
      if (entry.tag.startsWith(prefix)) return entry.tag.slice(prefix.length);
    }
    return entry.tag;
  }
  return null;
}

/**
 * Find the earliest commit that introduced `export ... <name>` in the
 * given file (following git history through renames). Falls back to the
 * file's first commit if no specific export-line addition is found.
 */
function firstCommitForExport(file: string, name: string): string {
  const rel = relative(repoRoot, file).replace(/\\/g, '/');
  // -G picks commits where the diff matches the regex; --diff-filter=A would
  // be too restrictive (renames break it). Use --reverse to get oldest first.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const log = git(
    'log',
    '--follow',
    '--reverse',
    '--format=%H',
    `-G(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`,
    '--',
    rel,
  );
  const sha = log.split(/\r?\n/).find((l) => l.trim());
  if (sha) return sha.trim();
  // Fallback: first commit touching the file at all.
  const fallback = git('log', '--follow', '--reverse', '--format=%H', '--', rel);
  return fallback.split(/\r?\n/)[0]?.trim() ?? '';
}

interface ResolvedExport {
  /** symbol name as it appears in the consumer */
  exportedAs: string;
  /** absolute path of the file that declares the symbol */
  file: string;
  /** the original local name in that file */
  localName: string;
}

/**
 * Walk each entry's exports using the TypeScript compiler, following
 * re-exports until each name lands on the file that declares it.
 */
function resolveExports(entries: string[], srcRoot: string): ResolvedExport[] {
  const program = ts.createProgram({
    rootNames: entries,
    options: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowJs: false,
      skipLibCheck: true,
      noEmit: true,
      strict: false,
    },
  });
  const checker = program.getTypeChecker();

  const results: ResolvedExport[] = [];
  const inLib = (file: string) => resolve(file).startsWith(resolve(srcRoot)) && !/\.(spec|test)\.tsx?$/.test(file);

  for (const entry of entries) {
    const sourceFile = program.getSourceFile(entry);
    if (!sourceFile) continue;
    const symbol = checker.getSymbolAtLocation(sourceFile);
    if (!symbol) continue;
    const exports = checker.getExportsOfModule(symbol);

    for (const exp of exports) {
      const exportedName = exp.getName();
      const target = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp;
      const decl = target.declarations?.find((d) => inLib(d.getSourceFile().fileName)) ?? target.declarations?.[0];
      if (!decl) continue;
      const file = decl.getSourceFile().fileName;
      if (!inLib(file)) continue;
      const localName = (target.escapedName as string) || exportedName;
      results.push({ exportedAs: exportedName, file, localName });
    }
  }
  // Dedupe by (file, localName) — multiple exported aliases for the same
  // symbol all live in the same place.
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.file}::${r.localName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface SinceMap {
  [lib: string]: {
    [exportName: string]: {
      version: string;
      file: string;
      sha: string;
    };
  };
}

const out: SinceMap = {};
let totalExports = 0;
let totalResolved = 0;

for (const lib of libs) {
  const presentEntries = lib.entries.filter((e) => existsSync(e));
  if (presentEntries.length === 0) {
    console.warn(`[skip] ${lib.label}: no entry points found`);
    continue;
  }
  const tags = tagsForLib(lib);
  if (tags.length === 0) {
    console.warn(`[skip] ${lib.label}: no version tags found`);
    continue;
  }
  console.log(`\n[${lib.label}] ${tags.length} tags, scanning ${presentEntries.length} entry point(s)`);
  const exports = resolveExports(presentEntries, lib.srcRoot);
  console.log(`  ${exports.length} top-level exports`);

  const libMap: SinceMap[string] = {};
  for (const exp of exports) {
    totalExports++;
    const sha = firstCommitForExport(exp.file, exp.localName);
    const version = sha ? firstTagContaining(sha, tags) : null;
    if (!version) {
      console.log(`  - ${exp.exportedAs}: <no version>`);
      continue;
    }
    totalResolved++;
    libMap[exp.exportedAs] = {
      version,
      file: relative(repoRoot, exp.file).replace(/\\/g, '/'),
      sha: sha.slice(0, 12),
    };
  }
  out[lib.label] = libMap;
}

const outPath = resolve(import.meta.dirname, 'since-map.json');
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8');
console.log(`\nResolved ${totalResolved}/${totalExports} exports → ${relative(repoRoot, outPath).replace(/\\/g, '/')}`);

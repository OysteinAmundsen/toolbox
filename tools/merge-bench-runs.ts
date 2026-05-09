/**
 * Merge multiple Vitest bench JSON outputs into a single report, taking the
 * **best** sample per benchmark to filter run-to-run noise.
 *
 * Background — borrowed from the Netflix TVUI perf-test methodology
 * (https://netflixtechblog.com/fixing-performance-regressions-before-they-happen-eab2602b86fe):
 *
 *   > Initially we took the average ... led to false positives. Switching to
 *   > median eliminated some ... Finally, since we noticed that outlier
 *   > results tended to be HIGHER than normal — rarely lower — we settled on
 *   > using the MINIMUM value across the 3 runs.
 *
 * Their metric is duration (lower = better). Our metric is `hz` (ops/sec,
 * higher = better), so the equivalent is **MAX of N**: the fastest run is
 * closest to "what the code is actually capable of"; slower runs are
 * polluted by GC, scheduler hiccups, fs cache misses, noisy neighbours.
 *
 * Two distinct merges happen here:
 *
 *  1. **Across projects** (grid + grid-react + grid-vue): bench `group.fullName`
 *     already includes the file path so identical names across projects cannot
 *     collide. Trivial flat-concat.
 *
 *  2. **Across runs of the same project** (run 1 / 2 / 3): SAME benchmark
 *     identity (`group.fullName > bench.name`) appears in every input. We
 *     keep the entry with the highest `hz` **as a unit** — `mean`, `moe`,
 *     `rme`, and `hz` all come from the same measured run, so the
 *     `(mean ± moe)` interval used by `compare-benches.ts` corresponds to
 *     a real distribution. See `pickBetter()` for why earlier "min(moe)"
 *     and "rewrite mean = 1000/hz" tweaks are explicitly avoided.
 *
 * Usage:
 *   bun tools/merge-bench-runs.ts --output <path> <input.json> [<input.json> ...]
 *
 * Inputs may be a mix of projects and runs in any order; the merge is
 * keyed strictly on `${group.fullName} > ${bench.name}` so the order in
 * which files are passed does not matter.
 */

import { readFileSync, writeFileSync } from 'node:fs';

// #region Vitest bench JSON shape (subset we touch)

interface BenchEntry {
  name: string;
  hz: number;
  rme: number;
  mean: number;
  moe?: number;
  sampleCount?: number;
  [k: string]: unknown;
}

interface BenchGroup {
  fullName: string;
  benchmarks: BenchEntry[];
  [k: string]: unknown;
}

interface BenchFile {
  filepath: string;
  groups: BenchGroup[];
  [k: string]: unknown;
}

interface BenchReport {
  files: BenchFile[];
}

// #endregion

// #region CLI

function parseArgs(argv: string[]): { output: string; inputs: string[] } {
  let output: string | undefined;
  const inputs: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--output' || a === '-o') output = argv[++i];
    else inputs.push(a);
  }
  if (!output) {
    console.error('Missing required --output <path>');
    process.exit(2);
  }
  if (inputs.length === 0) {
    console.error('At least one input JSON path is required');
    process.exit(2);
  }
  return { output, inputs };
}

// #endregion

// #region Merge

/**
 * Pick the "best" of two samples for the same benchmark identity.
 *
 * Our metric is `hz` (ops/sec); higher is better. We pick the highest-hz
 * sample because slower runs on a shared CI runner are almost always the
 * polluted ones (GC, page faults, neighbour CPU contention) — they are
 * rarely indicative of the code's true cost.
 *
 * The returned entry is the **winner verbatim**: `mean`, `moe`, `rme`,
 * `hz`, and `sampleCount` all come from the same measured run, so the
 * `(mean ± moe)` interval used by `compare-benches.ts` corresponds to a
 * real distribution. Earlier revisions rewrote `mean = 1000/winner.hz`
 * "for coherence" and took `min(moeA, moeB)` — that was wrong on both
 * counts: (a) `min(moe)` artificially tightens the CI band by pairing
 * the winner's mean with a *different* run's moe, which makes the
 * disjointness gate fire more often (i.e. MORE false positives, not
 * fewer); (b) the rewritten `1000/winner.hz` doesn't match `winner.mean`
 * exactly because Vitest derives both from samples independently, so the
 * winner's own `moe` (computed against `winner.mean`) was already paired
 * with a slightly off mean. Keeping the winner as a unit avoids both
 * problems.
 *
 * The only normalization we still do is fall back to `(mean * rme/100)`
 * if `moe` is absent on either side — purely for the comparator path,
 * which prefers `moe` but accepts `rme%` as a backup.
 */
function pickBetter(a: BenchEntry, b: BenchEntry): BenchEntry {
  const winner = a.hz >= b.hz ? a : b;
  const moe = winner.moe ?? (winner.mean * (winner.rme ?? 0)) / 100;
  return { ...winner, moe };
}

function loadReport(path: string): BenchReport {
  return JSON.parse(readFileSync(path, 'utf8')) as BenchReport;
}

function mergeReports(reports: BenchReport[]): BenchReport {
  // Index by group.fullName → (bench.name → best entry seen so far).
  // Using two-level Map preserves group structure for the output without
  // requiring a flatten/unflatten round trip.
  const groups = new Map<string, Map<string, BenchEntry>>();
  // Preserve filepath association (first seen wins) so the output matches
  // the shape consumers expect, even though comparison only keys on
  // group.fullName.
  const groupFile = new Map<string, string>();

  for (const report of reports) {
    for (const file of report.files ?? []) {
      for (const group of file.groups ?? []) {
        let bucket = groups.get(group.fullName);
        if (!bucket) {
          bucket = new Map();
          groups.set(group.fullName, bucket);
          groupFile.set(group.fullName, file.filepath);
        }
        for (const b of group.benchmarks ?? []) {
          const prev = bucket.get(b.name);
          bucket.set(b.name, prev ? pickBetter(prev, b) : b);
        }
      }
    }
  }

  // Re-bucket by filepath so the output keeps Vitest's two-level layout.
  const filesByPath = new Map<string, BenchFile>();
  for (const [fullName, bucket] of groups) {
    // groupFile is populated alongside groups in the loop above, so this
    // lookup is always defined; default to '' as an inert safeguard.
    const filepath = groupFile.get(fullName) ?? '';
    let file = filesByPath.get(filepath);
    if (!file) {
      file = { filepath, groups: [] };
      filesByPath.set(filepath, file);
    }
    file.groups.push({ fullName, benchmarks: [...bucket.values()] });
  }

  return { files: [...filesByPath.values()] };
}

// #endregion

// #region Main

const { output, inputs } = parseArgs(process.argv.slice(2));
const reports = inputs.map(loadReport);
const merged = mergeReports(reports);
writeFileSync(output, JSON.stringify(merged));
console.log(
  `Merged ${inputs.length} bench JSON file(s) → ${output} ` +
    `(${merged.files.length} bench files, ${merged.files.reduce((n, f) => n + f.groups.length, 0)} groups)`,
);

// #endregion

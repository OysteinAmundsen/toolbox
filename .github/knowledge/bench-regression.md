---
domain: bench-regression
related: [build-and-deploy]
---

# Benchmark Regression — Mental Model

> Benchmark comparison invariants. Nx targets and CI wiring → build-and-deploy.md; run workflow → `.github/skills/bench/SKILL.md`.
> Read order for a regression: affected scope → measurement units → uncertainty bounds.

## bench regression ([tools/compare-benches.ts](tools/compare-benches.ts), [tools/merge-bench-runs.ts](tools/merge-bench-runs.ts))

Compares Vitest `bench()` output (`hz`, `mean`, `moe`, `rme`) of PR head against the **last released commit on `main`** (most recent reachable tag), both measured on the **same runner in a single job**. Comparison window = full release cycle, so regressions accumulate visibly instead of being absorbed. Push to main: artifact only, no comparison.

- INVARIANT: PR job scoped via `nx affected --with-target=bench`; docs/chore PRs exit early with `## Bench: skipped`. Primary wall-time lever.
- INVARIANT (`sharedGlobals` workaround): when ONLY `sharedGlobals` files (`ci.yml`) change, `nx affected --with-target=bench` returns the adapters but NOT `grid`. CI force-includes `grid` whenever any adapter is affected (case statement in the bench step). RULED OUT: filing upstream.
- INVARIANT: baseline via `git worktree add ../base $LAST_TAG_SHA` (`git describe --tags --abbrev=0 origin/main` → `git rev-list -n 1`; fallback `origin/main`). Baseline measured FIRST (warm-up paid before head). Each side measured `BENCH_ITERATIONS` times (currently **1**), merged with **max-of-N on `hz`** (Netflix TVUI methodology — shared-runner outliers are always slower). The affected list is computed once in the PR-head checkout and reused for the baseline loop.
- INVARIANT: `merge-bench-runs.ts` returns the winning run **as a unit** (`mean`/`moe`/`rme`/`hz` from the same measured run) so the `mean ± moe` interval is a real distribution. RULED OUT: `mean = 1000/winner.hz` (hz is sample-derived); `min(moeA, moeB)` (artificially tightens the band). Only normalization: fall back to `mean * rme/100` when `moe` is absent.
- INVARIANT: regression flagged only if `current.hz < baseline.hz * (1 - threshold)` AND `current.mean ± moe` does NOT overlap `baseline.mean ± moe` (default ±25 %, CI runs `--threshold 0.30`). Regression and improvement need SEPARATE disjointness checks (`currentHzHigh < baselineHzLow` vs `currentHzLow > baselineHzHigh`) — one shared flag biases a direction.
- INVARIANT: one-sided benches report `🆕 new` / `🗑️ removed`, never a non-zero exit. Missing baseline file → exit 0.
- INVARIANT: Vitest bench JSON `mean` (ms) and `hz` (ops/s) are NOT exact reciprocals; bounds derived consistently as `1/(mean ± moe)` on both sides.
- INVARIANT: Vitest resolves `--outputJson=<path>` relative to the **config's project root**, NOT shell cwd — CI passes anchored `$PWD/tmp/...`.
- INVARIANT: [.github/skills/bench/bench-vs-tag.ts](.github/skills/bench/bench-vs-tag.ts) long-running children MUST spawn via `node:child_process.spawn` (`shAsync`), NOT `Bun.spawn`/`Bun.spawnSync` — Bun-spawning-Bun on Windows exits 58. Sync `sh()` is fine for short git commands. Success signal for `vitest bench` is `existsSync(outputJson)`, NOT the exit code (Vitest 4.x worker teardown flakes it).
- INVARIANT: baseline + current MUST run SEQUENTIALLY on the same runner. RULED OUT: `Promise.all`/`concurrently` (asymmetric variance inflation). Cross-runner matrix parallelism is fine.
- DECIDED: soft-warn mode — the script computes regressions but CI omits `--fail-on-regression`.
- DECIDED: bench coverage = `grid` + `grid-react` + `grid-vue` (each has an Nx `bench` target); exclude `grid-angular` (directive-based, no pure-function hot path). `merge-bench-runs.ts` keys on `group.fullName` (file path avoids cross-project collisions). Bench files MUST be co-located with code and excluded in adapter `tsconfig.lib.json` (`"src/**/*.bench.ts"`) or `tsc` + typedoc trip on fixtures.
- RULED OUT: cached cross-runner baselines (±30–60 % flips); Netflix-style anomaly/changepoint detection over N=40 history (needs persistent storage); shrinking per-bench `time`/`warmupTime`.

---
description: 'Run benchmarks (`bun run bench` or `bun run bench:vs-tag --ref <tag>`), compare against the previous run or a given git tag, and produce a performance report with regressions, hotspots, and a concrete fix plan.'
argument-hint: '[optional version e.g. 2.7.0 or grid-2.7.0] [optional "report-only"]'
agent: 'agent'
---

# Benchmark + Performance Analysis

Run the project's benchmark suite, compare results against a baseline, and report whether the current code is faster or slower — with a concrete plan to fix any regressions.

The argument `${input:target}` may contain:

- **A git tag or bare version** (e.g. `grid-2.7.0`, `2.7.0`, `grid-react-1.2.0`) → run `bun run bench:vs-tag -- --ref <tag> --fail-on-regression=false` to compare HEAD against that tag. See "Tag resolution" below.
- **Empty / not provided** → run `bun run bench` (current-vs-previous-run comparison via the bench output directory).
- **The literal `report-only`** (alone or trailing the tag) → skip the fix plan; produce only the analysis.

## Tag resolution

The argument may be a bare version like `2.7.0` instead of a fully-qualified tag. Resolve it before invoking `bench:vs-tag`:

1. If the input already matches a known tag (`git rev-parse --verify "refs/tags/<input>"`), use it verbatim.
2. Otherwise, if the input looks like a semver (`^\d+\.\d+\.\d+`), prepend the **flagship prefix `grid-`** and re-check. `2.7.0` → `grid-2.7.0`.
3. Otherwise, list candidate tags with `git tag --list "*<input>*" --sort=-creatordate`. If exactly one matches, use it. If multiple match (e.g. `1.6.0` could be `grid-vue-1.6.0` or `grid-react-1.6.0`), stop and ask the user which one — do not guess.
4. If nothing resolves, surface the failure and the candidate list; do not fall back silently.

Echo the resolved tag back to the user before starting the run (e.g. _"Resolved `2.7.0` → `grid-2.7.0`."_).

---

## 1. Run the benchmarks

- Pick the command based on the argument (see above). Use `mode=sync` with a generous timeout — bench runs are long-running.
- Stream the output. Do **not** pipe through `tail`/`head`/`2>&1` (terminal hangs on this machine — see `copilot-instructions.md`).
- If the run fails, stop and report the failure verbatim. Do not attempt to "fix" the bench harness unless explicitly asked.

The bench scripts emit per-project JSON under the bench output directory and (for `bench:vs-tag`) a comparison summary via `tools/compare-benches.ts`. Read those artifacts directly for precise numbers rather than parsing console output.

## 2. Locate the comparison artifacts

After the run, find:

- The merged per-side JSON files (e.g. `bench-current-*.json`, `bench-base-*.json` for `bench:vs-tag`).
- The comparison Markdown produced by `tools/compare-benches.ts` if one was written.
- For plain `bun run bench`: the per-project `bench-*.json` outputs and any previous-run history kept under the bench output directory.

If the artifacts cannot be found, list the candidate locations you searched and ask the user where they ended up — do not invent numbers.

## 3. Analyze

Produce a short, scannable report with these sections:

### Verdict

One line: **"Faster"**, **"Slower"**, or **"Mixed"** vs the baseline, with the headline delta (e.g. `+8.4% mean across all suites`). Name the baseline explicitly (`grid-2.7.0` or `previous local run @ <timestamp>`).

### Per-suite table

| Suite | Baseline (mean) | Current (mean) | Δ | Regression? |

Sort by absolute Δ% descending. Mark regressions above the script's threshold (default `0.30` for `bench:vs-tag`) and any suite that crossed from "within noise" into a real regression.

### Hotspots

For each regressed suite, identify the likely culprit:

- Cross-reference the suite name to the bench file under `libs/*/src/**/*.bench.ts` (or wherever the suite lives).
- Inspect the code under test — call out the specific function, hot loop, or render path that the bench exercises.
- Use `git log --oneline <baseline-tag>..HEAD -- <path>` to surface commits that touched the hot path since the baseline. List the top 1-3 suspect commits per regressed suite.
- For grid-core regressions, consult `.github/knowledge/grid-core.md` and `.github/knowledge/data-flow-traces.md` to map the suite to the affected subsystem (render-scheduler, config-manager, virtualization, plugin hooks, etc.).

### Fix plan (skip if `report-only`)

For each hotspot, propose:

1. **Hypothesis** — one sentence on what is slower and why.
2. **Investigation** — the minimal next step (profile with `debug-perf` skill, add a microbench, bisect the suspect commits, etc.).
3. **Candidate fix** — concrete code-level change (e.g. "cache `getBoundingClientRect` in `render-scheduler.ts:flushPending`", "skip `featureRegistry.notify` when no listeners are registered"). Cite file + symbol.
4. **Risk / scope** — public API impact, plugin compatibility, bundle-size implication.

Order the plan by impact-to-effort ratio. The user picks what to act on next.

## 4. Output

Print the report inline. Do not write a Markdown file unless asked. End with:

- A one-line summary of the verdict.
- A pointer to the relevant skill (`debug-perf`) if regressions exist.
- The exact command to reproduce the run (so the user can verify).

---

## Constraints

- **Never push, never commit.** This is a read + analyze workflow.
- Cite numbers; do not paraphrase deltas. If a number is ambiguous (e.g. noisy suite below threshold), say so explicitly.
- If `bench:vs-tag` cannot resolve the ref, surface the error and stop — do not silently fall back to a different baseline.
- Respect the bundle and perf invariants in `.github/knowledge/grid-core.md` and `.github/knowledge/build-and-deploy.md` when proposing fixes.

---

**Example invocations:**

- `/bench` — current-vs-previous local run.
- `/bench 2.7.0` — resolves to `grid-2.7.0`.
- `/bench grid-react-1.5.0` — explicit adapter tag.
- `/bench 2.7.0 report-only` — analysis only, skip fix plan.

After the report, the natural follow-up is `/perf-fix` to execute one item from the fix plan end-to-end.

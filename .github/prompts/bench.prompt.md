---
description: 'Run benchmarks (current-vs-previous run, or current-vs-tag) and produce a performance report with regressions, hotspots, and a concrete fix plan. Delegates the procedure to the `bench` skill.'
argument-hint: '[optional version e.g. 2.7.0 or grid-2.7.0] [optional "report-only"]'
agent: 'agent'
---

# Benchmark + Performance Analysis

Run the project's benchmark suite, compare against a baseline, and report whether the current
code is faster or slower — with a concrete plan to fix any regressions.

**Read `.github/skills/bench/SKILL.md` first** and follow it. It owns the canonical procedure:
which command to run, tag resolution, artifact locations, and how to read the results. This
prompt only adds the slash-command argument handling and the report shape.

## Argument handling

`${input:target}` may contain:

- **A git tag or bare version** (`grid-2.7.0`, `2.7.0`, `grid-react-1.2.0`) → current-vs-tag run.
  Resolve the tag per the skill's "Tag resolution" section, echo the resolved tag, then run
  `bun .github/skills/bench/bench-vs-tag.ts --ref <tag> --fail-on-regression=false`.
- **Empty / not provided** → `bun run bench` (current-vs-previous-run).
- **The literal `report-only`** (alone or trailing the tag) → skip the fix plan; analysis only.

Run benches with `mode=sync` and a generous timeout. Do **not** pipe through `tail`/`head`/`2>&1`
(terminal hangs on this machine). If a run fails, report it verbatim and stop.

## Report shape

Produce a short, scannable report (read artifacts directly; do not parse console output):

### Verdict

One line: **Faster** / **Slower** / **Mixed** vs the baseline, with the headline delta. Name the
baseline explicitly (`grid-2.7.0` or `previous local run @ <timestamp>`).

### Per-suite table

`Suite | Baseline (mean) | Current (mean) | Δ | Regression?` — sorted by absolute Δ% descending.
Mark regressions above the script's threshold (default `0.30` for the vs-tag run).

### Hotspots

For each regressed suite: map it to its `libs/*/src/**/*.bench.ts` and the code under test, then
`git log --oneline <baseline-tag>..HEAD -- <path>` for the top 1-3 suspect commits. For grid-core
regressions consult `.github/knowledge/grid-core.md` and `.github/knowledge/data-flow-traces.md`.

### Fix plan (skip if `report-only`)

Per hotspot: **Hypothesis** (what's slower and why) · **Investigation** (minimal next step —
`debug-perf` skill, microbench, bisect) · **Candidate fix** (concrete change, cite file + symbol)
· **Risk/scope** (public API, plugin compat, bundle size). Order by impact-to-effort ratio.

## Output

Print inline (no Markdown file unless asked). End with: one-line verdict, a pointer to the
`debug-perf` skill if regressions exist, and the exact command to reproduce the run.

## Constraints

- **Never push, never commit.** Read + analyze only.
- Cite numbers; do not paraphrase deltas. Flag noisy-below-threshold suites explicitly.
- If the tag cannot be resolved, surface the error and stop — do not fall back silently.

---

**Example invocations:**

- `/bench` — current-vs-previous local run.
- `/bench 2.7.0` — resolves to `grid-2.7.0`.
- `/bench grid-react-1.5.0` — explicit adapter tag.
- `/bench 2.7.0 report-only` — analysis only, skip fix plan.

After the report, the natural follow-up is `/perf-fix` to execute one item from the fix plan.

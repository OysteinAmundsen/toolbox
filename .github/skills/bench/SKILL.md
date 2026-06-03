---
name: bench
description: Run @toolbox-web benchmarks as local regression testing during development — either current-vs-previous-run (`bun run bench`) or current-vs-tag (the bundled bench-vs-tag.ts orchestrator). Covers writing `.bench.ts` files as part of issue development, running the suites, locating artifacts, and interpreting regressions. Use when implementing a perf-sensitive change, before opening a PR that touches hot paths, or when asked to benchmark.
argument-hint: '[optional tag e.g. grid-2.7.0] [optional "report-only"]'
---

# Benchmarking & Local Regression Testing

Benchmarks are the project's guard against silent performance regressions. Treat them like
unit tests for speed: write a `.bench.ts` when you add or change a hot path, and run the
suite to confirm a change didn't make things slower before you open a PR.

This skill backs the `/bench` slash command (`.github/prompts/bench.prompt.md`) but is also
meant to be invoked autonomously by agents during issue development. For _fixing_ a confirmed
regression, hand off to the `debug-perf` skill.

## When to write a `.bench.ts`

Add or extend a benchmark as an integral part of issue development whenever you:

- Touch a **hot path** — render scheduler, virtualization, config merge, sort/filter, plugin
  hook dispatch, large-dataset row building, adapter reconciliation.
- Add a **new feature or plugin** that runs work per-row, per-frame, or per-keystroke.
- Fix a **performance bug** — add a bench that would have caught it, so it can't silently return.

Bench files live next to the code under test as `*.bench.ts` and are picked up by each project's
`bench` target (`vitest bench`, `include: ['src/**/*.bench.ts']`). Keep each `bench()` case
focused on one operation; avoid mixing setup cost into the measured body (use the bench harness's
setup hooks). Mirror the style of existing benches under `libs/*/src/**/*.bench.ts`.

## Two ways to run

| Mode                        | Command                                                | Compares                                            | Use when                                                        |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------- |
| **Current vs previous run** | `bun run bench`                                        | HEAD now vs the last local bench output             | Iterating on a branch; quick "did my last edit slow this down?" |
| **Current vs tag**          | `bun .github/skills/bench/bench-vs-tag.ts --ref <tag>` | HEAD vs a released tag, **same-runner** methodology | Validating a branch against a shipped baseline before a PR      |

`bun run bench` runs `nx run-many --target=bench` across the bench-enabled projects
(`grid`, `grid-react`, `grid-vue`) and writes per-project JSON to the bench output directory.

The `bench-vs-tag.ts` orchestrator materialises the baseline ref in a sibling git worktree,
runs `vitest bench` on **both** sides on this machine (same CPU / kernel / thermal state — the
whole point of the methodology), merges max-of-N per side via `tools/merge-bench-runs.ts`, and
compares via `tools/compare-benches.ts`. Artifacts land under `tmp/` (`bench-current-*.json`,
`bench-baseline-*.json`).

### bench-vs-tag flags (most useful)

```
bun .github/skills/bench/bench-vs-tag.ts                    # default: last tag, all projects, 1 iter
bun .github/skills/bench/bench-vs-tag.ts --ref grid-2.7.0   # explicit tag/SHA baseline
bun .github/skills/bench/bench-vs-tag.ts --project grid     # subset (repeatable)
bun .github/skills/bench/bench-vs-tag.ts --iterations 3     # max-of-N per side (noisy suites)
bun .github/skills/bench/bench-vs-tag.ts --threshold 0.20   # tighter regression gate (default 0.30)
bun .github/skills/bench/bench-vs-tag.ts --keep-worktree    # don't delete ../base on exit
bun .github/skills/bench/bench-vs-tag.ts --help             # full flag list
```

Run with `mode=sync` and a generous timeout — bench runs are long. Do **not** pipe through
`tail`/`head`/`2>&1` (terminal hangs on this machine — see `copilot-instructions.md`).

## Tag resolution

The user may pass a bare version like `2.7.0` instead of a fully-qualified tag. Resolve before
invoking `bench-vs-tag.ts`:

1. If the input is already a tag (`git rev-parse --verify "refs/tags/<input>"`), use it verbatim.
2. If it looks like semver (`^\d+\.\d+\.\d+`), prepend the flagship prefix `grid-` and re-check
   (`2.7.0` → `grid-2.7.0`).
3. Otherwise `git tag --list "*<input>*" --sort=-creatordate`. One match → use it. Multiple
   (e.g. `1.6.0` could be `grid-vue-1.6.0` or `grid-react-1.6.0`) → stop and ask; do not guess.
4. Nothing resolves → surface the failure and candidate list; do not fall back silently.

Echo the resolved tag back before starting (e.g. _"Resolved `2.7.0` → `grid-2.7.0`."_).

## Reading the results

Read the JSON / comparison-Markdown artifacts directly for precise numbers — do not parse console
output. For each suite compare current vs baseline mean and flag any regression above the script's
threshold (default `0.30` for vs-tag). When asked for a report, produce:

- **Verdict** — one line: Faster / Slower / Mixed vs the named baseline, with the headline delta.
- **Per-suite table** — `Suite | Baseline mean | Current mean | Δ | Regression?`, sorted by |Δ%|.
- **Hotspots** — map each regressed suite to its `*.bench.ts` and the code under test; use
  `git log --oneline <baseline>..HEAD -- <path>` to surface suspect commits. For grid-core,
  cross-reference `.github/knowledge/grid-core.md` and `.github/knowledge/data-flow-traces.md`.

If regressions exist, hand off to the `debug-perf` skill (profiling + fix) and the `/perf-fix`
prompt (execute one fix-plan item end-to-end).

## Constraints

- **Never push, never commit.** Benchmarking is read + analyze.
- Cite numbers; do not paraphrase deltas. Flag noisy-below-threshold suites explicitly.
- Do not "fix" the bench harness unless explicitly asked.
- Respect the bundle and perf invariants in `.github/knowledge/build-and-deploy.md`.

---
description: 'Execute one item from a `/bench` fix plan end-to-end: profile the regression, apply a targeted patch, re-run the benchmark, and confirm the delta. Pairs with `/bench`.'
argument-hint: '[optional hotspot name or suite] [optional baseline tag, e.g. 2.7.0]'
agent: 'agent'
---

# Performance Fix Loop

Take one regression surfaced by `/bench` and drive it to a measurable improvement. This is the action half of the bench → analyze → fix cycle.

The argument `${input:target}` may contain:

- **A hotspot name, suite name, or file path** (e.g. `render-scheduler`, `grid-sort.bench.ts`, `libs/grid/src/lib/core/internal/render-scheduler.ts`) → focus on that hotspot.
- **A baseline tag or version** (e.g. `2.7.0`, `grid-2.7.0`) → use this as the comparison baseline for re-bench. Resolution rules match `/bench` (bare semver → `grid-` prefix; ambiguous → ask).
- **Empty** → re-read the most recent bench artifacts in the conversation or under the bench output directory, pick the highest-impact regression from the fix plan, and confirm the choice with the user before patching.

If both a hotspot and a tag are present, order doesn't matter — parse by shape (semver vs. identifier/path).

---

## 1. Establish the target

Before changing any code:

1. Identify the **suite**, the **file under test**, and the **baseline delta** (e.g. `+18% on sort-1k-rows vs grid-2.7.0`). Cite the bench artifact you read.
2. Confirm the regression is **real, not noise** — if the suite's Δ is within the bench script's threshold (`0.30` by default) or the run had only 1 iteration, ask the user whether to re-bench with `--iterations 3` first instead of patching speculatively.
3. State the **success criterion** in one line: e.g. _"Restore `sort-1k-rows` to within 5% of grid-2.7.0 mean."_

Stop here and surface the plan if the user invoked with no argument and you had to pick the hotspot yourself.

## 2. Profile (when the cause isn't obvious)

If the hotspot maps cleanly to a recent commit (visible via `git log <baseline>..HEAD -- <path>`), skip profiling and go straight to step 3.

Otherwise, use the `debug-perf` skill:

- Read [.github/skills/debug-perf/SKILL.md](.github/skills/debug-perf/SKILL.md) before profiling.
- Capture a trace of the relevant demo or bench scenario.
- Report the top frames by self-time, the hot call path, and any unexpected allocations / layout thrash.

Do **not** profile every suite — only the one being fixed.

## 3. Patch

Apply the **smallest** change that addresses the hotspot:

- Cite the file + symbol you're changing and the hypothesis from the `/bench` fix plan.
- Honor the project's invariants — `grid-core.md`, `grid-plugins.md`, `data-flow-traces.md`. If the fix would contradict a `DECIDED` entry, **stop and surface the conflict** before editing.
- No drive-by refactors. No "while I'm here" cleanups. One patch, one hotspot.
- Preserve public API and plugin contracts. Bundle budget still applies (`bundle-check` skill).

After the edit:

- Run the **unit tests for the affected library** (`bun nx test <project>`) — the patch must not regress correctness.
- Run **lint and build** for the affected project.

## 4. Re-bench

Re-run the same bench command `/bench` would use for this baseline:

- With a tag: `bun .github/skills/bench/bench-vs-tag.ts --ref <resolved-tag> --fail-on-regression=false` (add `--iterations 3` if the original run was noisy).
- Without a tag: `bun run bench` and compare to the pre-patch artifacts.

Read the resulting comparison artifacts. Do not eyeball console output.

## 5. Verdict

Report:

- **Before / After / Baseline** for the targeted suite (mean ± stddev).
- **Delta vs baseline** — did we meet the success criterion from step 1?
- **Collateral** — list every other suite whose Δ moved by more than the threshold (positive or negative). A win on one suite that breaks two others is not a win.
- **Bundle delta** if any production code changed (run `bundle-check` skill if applicable).

Then choose one:

| Outcome                            | Next step                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success, no collateral regressions | Mark the todo complete. Suggest a commit: `📦 perf(<scope>): <what>. Restores <suite> to within X% of <baseline>.`                                                        |
| Partial improvement                | Report honestly. Ask whether to iterate (loop back to step 2) or accept the partial win.                                                                                  |
| No improvement / made it worse     | **Revert the patch.** Report what didn't work and why. Add a `TENSION` or `RULED OUT` note to the relevant knowledge file so the next attempt doesn't repeat the mistake. |

---

## Constraints

- **One hotspot per invocation.** If multiple regressions need fixing, run `/perf-fix` once per hotspot.
- **Never push, never commit.** Suggest the commit message; the user runs `git commit`.
- **Revert on regression.** If the re-bench shows the patch made things worse or net-neutral, undo it before handing back. Do not leave speculative perf code in the tree.
- **Bench methodology matters.** Quiet machine, same iteration count for before/after, same baseline ref. If the user's machine looks noisy (background dev server, browser open), warn before trusting the numbers.

**Example invocations:**

- `/perf-fix` — pick the top regression from the last `/bench` report, confirm, then fix.
- `/perf-fix render-scheduler 2.7.0` — target `render-scheduler` hotspot against `grid-2.7.0`.
- `/perf-fix sort-1k-rows` — target a specific bench suite, baseline inferred from the last `/bench` run.

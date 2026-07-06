---
name: fallow
description: >
  Run deterministic codebase-intelligence analysis with fallow. Covers health scoring
  (complexity/CRAP/refactor targets), dead code, duplication, dependency hygiene, and
  PR-scoped audit. Use before opening a PR, as part of `/qa`, or to identify
  refactoring opportunities in a file or plugin. Produces machine-actionable JSON
  findings that can be fed directly into `qa-apply-findings`.
argument-hint: '[health | audit | dead-code | dupes | full] [--changed-since <ref>] [--file <path>]'
---

# Fallow Codebase Intelligence

Fallow (`bunx fallow`) is the deterministic codebase analysis tool
for this monorepo. It is run on demand via `bunx` and is not a project dependency.

---

## Quick reference

| Goal                                     | Command                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| Full-project maintainability report      | `bunx fallow health --score --hotspots --targets --format json` |
| PR-scoped risk gate (changed files only) | `bunx fallow audit --changed-since origin/main --format json`   |
| Dead code + unused exports               | `bunx fallow dead-code --format json`                           |
| Duplication across the codebase          | `bunx fallow dupes --format json`                               |
| Everything at once                       | `bunx fallow --format json`                                     |
| Single-file deep dive                    | `bunx fallow health --file <path> --format json`                |
| Per-package scores (monorepo)            | `bunx fallow health --group-by package --score --format json`   |

---

## When to use each subcommand

### `fallow health` — complexity, refactor targets

Use when: evaluating maintainability of a file, plugin, or the whole library;
identifying which functions to refactor; tracking quality score over time.

```bash
# Full maintainability report with score and top hotspots
bunx fallow health \
  --score \
  --hotspots \
  --targets \
  --top 30 \
  --file-scores \
  --format json

# Only functions that exceed thresholds in the grid library
bunx fallow health \
  --workspace @toolbox-web/grid \
  --score \
  --targets \
  --format json

# Changed files only (for PR review)
bunx fallow health \
  --changed-since origin/main \
  --score \
  --format json
```

**Key fields in JSON output:**

- `findings[].cyclomatic` — cyclomatic complexity (threshold: 20)
- `findings[].cognitive` — cognitive complexity (threshold: 15)
- `findings[].crap` — CRAP score (threshold: 30); amplified by low test coverage
- `findings[].severity` — `critical | high | moderate`
- `findings[].coverage_tier` — `high | partial | none`
- `findings[].actions[]` — machine-actionable `refactor-function`, `increase-coverage`, `add-tests`
- `summary.score` — overall health score 0–100 (letter grade A–F)

**What the CRAP score means:**
`CRAP = CC² × (1 − coverage)³ + CC`. A function with CC=20 and zero coverage
scores 8020; the same function fully covered scores 20. Adding test coverage is
the fastest way to bring CRAP under the threshold without refactoring.

---

### `fallow audit` — PR risk gate

Use when: reviewing a branch before opening a PR; CI gate; catching regressions
introduced by the current change.

```bash
# Gate against main (auto-detects base)
bunx fallow audit --format json

# Explicit base ref
bunx fallow audit --base origin/main --format json

# With Istanbul coverage for exact CRAP scoring
bunx fallow audit \
  --base origin/main \
  --coverage coverage/coverage-final.json \
  --format json
```

Returns a **verdict**: `pass` (exit 0), `warn` (exit 0), `fail` (exit 1).

---

### `fallow dead-code` — cleanup opportunities

Use when: doing cleanup passes; checking for unused exports after a refactor;
verifying that deprecated API removals didn't leave orphaned symbols.

```bash
# All dead code
bunx fallow dead-code --format json

# Only unused exports (most actionable in a library)
bunx fallow dead-code --unused-exports --format json

# Only circular dependencies
bunx fallow dead-code --circular-deps --format json

# Scope to changed files
bunx fallow dead-code --changed-since origin/main --format json
```

---

### `fallow dupes` — duplication

Use when: checking for copy-paste before extracting a shared helper; verifying
a refactor didn't leave stale copies.

```bash
# Default (mild mode — AST-based)
bunx fallow dupes --format json

# Semantic mode — catches renamed-variable clones
bunx fallow dupes --mode semantic --format json

# Only cross-directory duplicates (skip local overloads)
bunx fallow dupes --skip-local --format json
```

---

### `bunx fallow` — combined run

The bare command runs dead-code + duplication + health together. Use for a full
baseline snapshot or when preparing a release.

```bash
bunx fallow --format json > tmp/fallow-full.json
```

---

## Interpreting findings and prioritising work

Sort by CRAP score (highest first). Functions with both high CRAP and
`coverage_tier: none` are the best candidates because adding even a single test
suite drops CRAP dramatically.

Priority tiers for `libs/grid/`:

| Tier         | Criteria                             | Action                              |
| ------------ | ------------------------------------ | ----------------------------------- |
| **Critical** | CRAP > 500 AND `coverage_tier: none` | Add tests first, then refactor      |
| **Critical** | CRAP > 200 AND `severity: critical`  | Refactor (extract helpers)          |
| **High**     | CRAP 50–200, partial coverage        | Increase branch coverage            |
| **Moderate** | Only cyclomatic/cognitive exceeded   | Refactor when touching the function |

Functions in `libs/grid/scripts/`, `tools/`, `demos/`, and `apps/docs/` have
relaxed thresholds in `.fallowrc.json`. Flag them but don't block work on them.

---

## Integrating with `/qa`

When running `/qa` on a branch or PR scope, include a fallow audit step:

```bash
bunx fallow audit --base origin/main --format json > tmp/fallow-audit.json
```

Map fallow JSON findings to `qa-apply-findings` format:

- `severity: critical` → `blocking`
- `severity: high` → `should-fix`
- `severity: moderate` → `nit`

For dead-code findings (`unused-export`, `unused-file`): always `blocking` on
`libs/grid/src/public.ts` (public API surface), `should-fix` elsewhere.

For complexity findings in **changed functions only** (filter by `introduced: true`
in audit output): `blocking` if CRAP > 200, `should-fix` if CRAP 50–200.

---

## Suppressing false positives

```ts
// fallow-ignore-next-line complexity -- intentional dispatch table
function dispatch(action: Action) { ... }

// fallow-ignore-file -- generated route map
```

For known complex-but-correct functions (keyboard handlers, row-rendering pipelines),
prefer `// fallow-ignore-next-line complexity -- <reason>` over lowering global thresholds.

Only use `thresholdOverrides` in `.fallowrc.json` for whole file categories (e.g. build
tooling, demos) — not for individual production functions.

---

## Adding fallow to the project-wide QA baseline

After a major cleanup pass, save a baseline so future audits only gate on regressions:

```bash
bunx fallow health --save-baseline fallow-baselines/health.json
bunx fallow dead-code --save-baseline fallow-baselines/dead-code.json
bunx fallow dupes --save-baseline fallow-baselines/dupes.json
```

Commit the `fallow-baselines/` directory. Then CI uses:

```bash
bunx fallow audit \
  --health-baseline fallow-baselines/health.json \
  --dead-code-baseline fallow-baselines/dead-code.json \
  --dupes-baseline fallow-baselines/dupes.json \
  --format json
```

This gates only on **new** regressions introduced by each PR rather than the full backlog.

---
name: lint-baseline
description: Detect lint warnings a change introduced, by diffing the current tree against the pre-change baseline. Use after any refactor or multi-file change, because `bun nx lint` exits 0 on warnings and the repo carries ~200 pre-existing ones — new dead imports and `any`s pass the normal gate unnoticed.
argument-hint: project-name (e.g. grid)
---

# Lint Warning Baseline

`bun nx lint` fails only on **errors**. `grid` carries ~200 pre-existing **warnings**, so a refactor can add dead imports, fresh `any`s, or unused vars and still show a green Step 4. This skill measures the delta instead of the absolute count.

## When to use

- After any refactor that removes, renames, or moves code (dead imports are the classic residue).
- After a change touching more than a couple of files.
- Before suggesting a commit, whenever Step 4 passed but you changed a lot.

Skip it for single-line fixes and docs-only changesets.

## Run it

```bash
bun .github/skills/lint-baseline/lint-warning-diff.ts grid
```

Multiple projects in one pass:

```bash
bun .github/skills/lint-baseline/lint-warning-diff.ts grid grid-react grid-vue
```

The script lints the current tree, stashes your changes (including untracked files), lints the clean baseline, restores the stash, then prints only the difference. Exit code is **1 if any warning was added**, 0 otherwise.

## Interpreting output

```
baseline: 204 warnings → current: 205 warnings

NEW (1):
  libs/grid/src/lib/plugins/tree/tree-plugin.ts
    1× @typescript-eslint/no-explicit-any — Unexpected any. Specify a different type
```

- **`NEW`** — must be fixed, or explicitly justified in the delivery self-audit. Most are dead imports left behind by a refactor.
- **`FIXED`** — warnings your change removed. Worth mentioning in the commit body.
- Warnings are keyed on **file + rule + message**, not `line:col`, so code that merely moved does not show up as a change.

## Requirements and caveats

- **The working tree must be dirty** — the script compares your uncommitted changes against `HEAD`. It exits early on a clean tree. To check work that is already committed, compare against the parent commit manually.
- **It runs `git stash push --include-untracked`.** Restoration is in a `finally` block, and if `git stash pop` ever fails the script prints loud recovery instructions and exits 1 — run `git stash pop` yourself in that case. Do not run it mid-rebase or mid-merge.
- Lint runs with `--skip-nx-cache` on both passes so the baseline is genuinely re-measured.

## Related

- `bundle-check` — the same "prove the metric didn't regress" shape, for bundle size.
- Delivery checklist Step 4 (`delivery-workflow.instructions.md`) references this skill.

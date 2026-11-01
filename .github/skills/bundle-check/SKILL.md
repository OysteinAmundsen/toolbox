---
name: bundle-check
description: Check that the @toolbox-web/grid build stays within bundle size budget (index.js ≤170 kB raw, ≤50 kB gzipped hard limit, ≤45 kB gzipped soft warning). Run after any code change that could affect bundle size.
argument-hint: library-name (optional)
---

# Bundle Size Check

Verify that the grid library build stays within its budget constraints.

## Budget Limits

| Metric              | Threshold        | Action                                                                                                                  |
| ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `index.js` raw size | > 170 kB         | **Hard fail** — the build exits non-zero; you must reduce size before merging.                                          |
| `index.js` gzipped  | > 50 kB          | **Hard fail** — the build exits non-zero; you must reduce size before merging.                                          |
| `index.js` gzipped  | > 45 kB, ≤ 50 kB | **Soft warning** — the build succeeds; investigate the cause and reduce size if reasonable, but a merge is not blocked. |
| `index.js` gzipped  | ≤ 45 kB          | **Pass** — no action required.                                                                                          |

## Steps

> **Steps 1–2 are deterministic — run the scripts, don't eyeball it.** The build hard-enforces the budget and the report script prints exact raw/gzip sizes. Reserve your judgment for step 3 (interpreting the warning band and investigating causes).

### 1. Build the Library (enforces the hard budget)

```bash
bun nx build grid
```

The Vite `bundleBudget` plugin (`tools/vite-bundle-budget.ts`) runs during this build and **exits non-zero** if `index.js` exceeds the hard limits (170 kB raw / 50 kB gzipped). A clean build means the hard budget already passed; a failed build prints the exact offending size.

### 2. Print Exact Sizes

Run the shared size-report script — it measures raw **and** gzip for `index.js`, `all.js`, and every plugin in one deterministic pass (same script CI uses):

```bash
bun run tools/build-size-report.ts
```

This replaces ad-hoc `wc -c` / PowerShell gzip snippets — do not hand-measure. Read the `grid` column of the **core (index.js)** row for the numbers you need.

### 3. Evaluate Results

Use this checklist in order. Stop at the first matching outcome.

#### 3a. Under budget (gzipped ≤ 45 kB and raw ≤ 170 kB)

- [ ] Report the raw and gzipped sizes.
- [ ] Confirm the build is good. No further investigation required.

#### 3b. Soft warning (gzipped > 45 kB and ≤ 50 kB, raw ≤ 170 kB)

- [ ] Report the sizes and flag the warning explicitly.
- [ ] Briefly investigate using the **Over-budget investigation checklist** below.
- [ ] Document any size increase in the commit message; merging is allowed.

#### 3c. Over budget (gzipped > 50 kB **or** raw > 170 kB)

The build will hard-fail. Work through the **Over-budget investigation checklist** below until the size is back under the hard limit.

#### Over-budget investigation checklist

- [ ] Check for new dependencies or imports pulled into the core bundle.
- [ ] Verify plugins are separate entry points (not bundled into `index.js`).
- [ ] Look for dead code that should be tree-shaken.
- [ ] Consider if large functions could be moved to a plugin.
- [ ] Re-run `bun nx build grid` and review the Vite output summary.

### 4. Common Causes of Size Increase

- Accidentally importing a plugin in `src/index.ts` instead of `src/all.ts`
- Adding large utility functions to core modules
- New CSS that gets inlined into the core bundle
- Importing third-party libraries in core code
- Duplicated types or constants across modules

### 5. Size Reduction Strategies

Measure first — `attribute-bundle.mjs` (below) tells you which source files own the bytes; the
minified-output scans in the knowledge file (`build-and-deploy.md` → "bundle budget") tell you
what has already been ruled out. Then, in order of yield observed on this codebase:

- **CSS pipeline** — the inlined CSS is the single largest core "file" (~22 kB raw, but only
  ~5 kB gz). Vite runs lightningcss twice (transform + `cssMinify`), so a hand-written vendor
  prefix is emitted **three** times. Never hand-prefix; keep `cssBrowserTargets` in
  `libs/grid/vite.config.ts` equal to the documented browser floor so only needed prefixes ship.
- Move feature code to a plugin (separate entry point)
- Extract pure functions and ensure tree-shaking works
- Remove unused exports and dead code
- Minimize CSS by combining selectors; merge rules that target the same selector
- Dedupe repeated logic blocks (`updateRow` → `updateRows([…])`, shared affordance helpers)
- Use `const` objects instead of `enum`
- Audit `import` statements for unnecessary pulls

### Measuring tools (in this skill folder)

```bash
# Where do the bytes go? Per-source raw bytes from the sourcemap (top 45 by default).
bun nx build grid
node .github/skills/bundle-check/attribute-bundle.mjs dist/libs/grid/index.js [rows]

# Does a CSS pipeline change render identically? Real grid from dist/ in Chromium; every
# computed property of every element + ::before/::after, stylesheet A vs stylesheet B.
# Build the baseline in a detached worktree — `git stash` silently stashes nothing once
# the change is committed, and the compare degrades to A-vs-A.
bun nx build grid
node .github/skills/bundle-check/css-parity.mjs --dump=tmp/styles-a.css        # current dist
$wt = "$env:TEMP\parity-base"; git worktree add --detach $wt <baseline-rev>
New-Item -ItemType Junction -Path "$wt\node_modules" -Target "$PWD\node_modules" | Out-Null
Push-Location $wt; bun nx build grid; Pop-Location
Remove-Item -Recurse -Force dist\libs\grid; Copy-Item -Recurse "$wt\dist\libs\grid" dist\libs\grid
node .github/skills/bundle-check/css-parity.mjs --compare=tmp/styles-a.css     # exit 1 on any diff
(Get-Item "$wt\node_modules").Delete(); git worktree remove --force $wt
bun nx build grid                                                               # restore dist
```

`css-parity.mjs` exits 2 when the fixture itself is incomplete (no `aria-sort="ascending"`
header, no `.header-group-row`, no `.cell.selected`, or no rows) or when two snapshots of the
_same_ stylesheet differ — either would otherwise masquerade as a CSS pass/regression. Check
the baseline `index.js` size against the known number before trusting a 0-diff result. If
Playwright's bundled Chromium build is missing, point `CHROME_EXE` at any
`%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win64\chrome.exe`.

## Plugin Bundle Sizes

Individual plugins are separate entry points. The `tools/build-size-report.ts` table from step 2 already lists every plugin's raw/gzip size (one row per plugin) — read those rows rather than re-listing files by hand. Plugins don't have strict budgets but should be as small as possible.

## Bundle Composition (build-enforced + runtime smoke)

Where code lives is a global rule (`development-principles.instructions.md` → "Bundle Composition"). The build enforces the structural half via `tools/vite-core-imports.ts`, which runs in the per-plugin ESM and UMD builds:

| Build failure                                           | Meaning                                                                           | Fix                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `[core-imports] … inlines module state from X`          | A plugin inlined a core module that keeps module-level state, and core has it too | Export the plugin's entry point into that module from `public.ts` (`@internal` if needed) |
| `[core-imports] module state exists more than once`     | Two plugin bundles each carry the same stateful core module                       | Same fix: export it from `public.ts` so both share core's instance                        |
| `[core-imports] … which the built core does not export` | A plugin imports a public name that `index.js` doesn't export                     | Check `src/index.ts` re-exports                                                           |
| `[core-imports] … unexpected external import`           | Something other than `@toolbox-web/grid` (or a plugin dep, ESM) went external     | Find the import; plugin-shared code belongs in `plugins/shared/`                          |

A green build does not prove the bundles **run**. After touching `vite.config.ts`, `tools/vite-core-imports.ts`, `public.ts`, or a plugin's core imports, run the dist smoke test. It loads core and every plugin bundle (ESM and UMD) in happy-dom and drives a real grid:

```bash
bun nx build grid
node .github/skills/bundle-check/smoke-dist.mjs  # exit 1 + ✗ lines on failure
```

It catches what the build cannot: a UMD plugin reading an undefined `TbwGrid.<name>`, a plugin carrying its own `BaseGridPlugin` copy, and module state that is not shared with core (`aggregatorRegistry`). To prove a fix, build once with the old config (`git show HEAD:libs/grid/vite.config.ts`) and confirm the script fails there.

Use Node for this script: Bun's happy-dom `window.eval` can leave the UMD globals unregistered.

## Dead Code Removal

Actively identify and remove dead code to minimize bundle size. Use the `fallow` skill for
deterministic detection instead of hand-grepping exports:

```bash
bunx fallow dead-code --format json > tmp/fallow-dead-code.json   # unused exports/files, circular deps
bun nx lint grid                                                 # unused imports/locals
```

Also remove commented-out code blocks and deprecated code with no remaining references.

### When removing code:

1. Verify no usages exist (use `list_code_usages` or grep)
2. Check for dynamic imports or string-based references
3. Consider if code is used by external consumers (public API)
4. Remove associated tests if the feature is fully removed

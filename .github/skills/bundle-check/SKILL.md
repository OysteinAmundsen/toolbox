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

### 1. Build the Library

```bash
bun nx build grid
```

### 2. Check Output Sizes

After a successful build, check the output file sizes:

```bash
# Raw size
wc -c dist/libs/grid/index.js

# Gzipped size (use gzip -c on Linux/macOS, or PowerShell on Windows)
# PowerShell:
$bytes = [System.IO.File]::ReadAllBytes("dist/libs/grid/index.js"); $ms = New-Object System.IO.MemoryStream; $gs = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionMode]::Compress); $gs.Write($bytes, 0, $bytes.Length); $gs.Close(); $ms.Length

# Bash:
gzip -c dist/libs/grid/index.js | wc -c
```

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

- Move feature code to a plugin (separate entry point)
- Extract pure functions and ensure tree-shaking works
- Remove unused exports and dead code
- Minimize CSS by combining selectors
- Use `const enum` instead of `enum` where possible
- Audit `import` statements for unnecessary pulls

## Plugin Bundle Sizes

Individual plugins are separate entry points. Check their sizes too:

```bash
# List all plugin bundles with sizes
ls -la dist/libs/grid/plugins/*/index.js 2>/dev/null || dir dist\libs\grid\plugins\*\index.js
```

Plugins don't have strict budgets but should be as small as possible.

## Dead Code Removal

Actively identify and remove dead code to minimize bundle size.

### Before each commit, check for:

- Unused imports (ESLint will flag these)
- Unused functions, variables, or type definitions
- Commented-out code blocks (remove or convert to documentation)
- Deprecated code that's no longer referenced
- Unused CSS classes or variables

### Tools to identify dead code:

```bash
# TypeScript compiler flags unused locals
bun nx build grid

# ESLint checks unused variables/imports
bun nx lint grid

# Search for potentially unused exports
grep -r "export.*functionName" --include="*.ts"
```

### When removing code:

1. Verify no usages exist (use `list_code_usages` or grep)
2. Check for dynamic imports or string-based references
3. Consider if code is used by external consumers (public API)
4. Remove associated tests if the feature is fully removed

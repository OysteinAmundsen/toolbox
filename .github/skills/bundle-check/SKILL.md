---
name: bundle-check
description: Check that the @toolbox-web/grid build stays within bundle size budget (index.js ≤170 kB, gzip ≤45 kB). Run after any code change that could affect bundle size.
argument-hint: [library-name]
---

# Bundle Size Check

Verify that the grid library build stays within its budget constraints.

## Budget Limits

| Metric              | Limit    |
| ------------------- | -------- |
| `index.js` raw size | ≤ 170 kB |
| `index.js` gzipped  | ≤ 45 kB  |

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

- If **under budget**: Report sizes and confirm the build is good.
- If **over budget**: Investigate what's causing the size increase:
  1. Check for new dependencies or imports pulled into the core bundle
  2. Verify plugins are separate entry points (not bundled into `index.js`)
  3. Look for dead code that should be tree-shaken
  4. Consider if large functions could be moved to a plugin
  5. Run `bun nx build grid` and review the Vite output summary

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

---
name: release-prep
description: Prepare a @toolbox-web library for release. Runs the full pre-release checklist including lint, test, build, bundle size check, CHANGELOG review, and documentation updates.
argument-hint: optional library name
---

# Release Preparation

Run the full pre-release checklist for a @toolbox-web library.

## How to Use This Checklist

The checklist has 10 steps grouped into four phases. Complete each phase fully before starting the next; **do not interleave phases**. Within a phase, run the steps in order.

| Phase                  | Steps | Goal                                              |
| ---------------------- | ----- | ------------------------------------------------- |
| **Quality gates**      | 1–3   | Lint, test, and build the workspace cleanly.      |
| **Release validation** | 4–6   | Bundle budget, CHANGELOG, breaking-change review. |
| **Documentation**      | 7–9   | Docs updates, docs-site build, demo smoke test.   |
| **Commit hygiene**     | 10    | Final commit polish before merging.               |

## Handling Failures During the Checklist

If any command in steps 1–9 fails (lint error, failing test, type error, build break, bundle over budget, broken docs build, broken demo):

1. **Stop the checklist immediately** — do not move to the next step. The release is not ready.
2. **Diagnose the failure** by reading the actual command output. Do not retry the same command unchanged hoping for a different result.
3. **Fix the underlying cause** in code, tests, or docs (per the standard delivery workflow). For bundle-budget failures, follow the `bundle-check` skill's investigation checklist.
4. **Re-run only the failing command** to confirm it now passes.
5. **Restart the checklist from step 1** so any fix that could have ripple effects (e.g. a code change that affects bundle size, or a doc change that breaks the docs build) is re-validated end-to-end.
6. If the failure is a known intermittent or environmental issue (e.g. flaky test, transient network failure on docs build), document the cause and the rerun outcome in the release PR description rather than silently re-running.

Do not proceed to the **Release Process** section until every checklist step has passed cleanly in a single uninterrupted run.

## Pre-Release Checklist

### 1. Lint All Projects

```bash
bun run lint
```

Fix any lint errors before proceeding. Do not skip warnings either — either fix them, or **suppress with justification**, which means add a single-line ESLint disable directive on the offending line that includes the rule name **and** a brief reason, e.g. `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party API returns `any``. Bare `eslint-disable`directives without a`--` reason are not acceptable.

### 2. Run All Tests

```bash
bun run test
```

All tests must pass across grid, grid-angular, grid-react, and grid-vue.

### 3. Build All Libraries

```bash
bun nx run-many -t build
```

Verify clean builds with no TypeScript errors.

### 4. Check Bundle Size Budget

Verify `dist/libs/grid/index.js`:

- Raw size ≤ 170 kB (hard fail)
- Gzipped ≤ 50 kB (hard fail), warning at 45 kB

```bash
# Check raw size
wc -c dist/libs/grid/index.js
# Or on PowerShell:
(Get-Item dist/libs/grid/index.js).Length
```

### 5. Review CHANGELOG

Check `libs/grid/CHANGELOG.md` (and other library CHANGELOGs):

- New features documented with clear descriptions
- Bug fixes listed with issue references where available
- Breaking changes clearly marked with migration guides
- Entries follow Conventional Commits format

### 6. Check for Breaking Changes

Review all changes since last release:

```bash
git --no-pager log --oneline $(git describe --tags --abbrev=0)..HEAD
```

**What constitutes a breaking change:**

- Removed/renamed exports from `public.ts`
- Changed method signatures (added required params, changed return types)
- Removed/renamed public properties/methods on `<tbw-grid>`
- Removed/renamed CSS custom properties
- Changed event names or payload structures
- Removed/renamed plugin hook methods in `BaseGridPlugin`
- Changed the `disconnectSignal` contract (plugins depend on it for cleanup)

**What is NOT a breaking change:**

- Adding new optional properties, methods, or events
- Internal refactoring that doesn't affect public API
- Bug fixes (even if they change incorrect behavior)
- Adding new exports to `public.ts`
- Performance improvements
- New plugins or plugin features

**If breaking changes exist:**

1. Document in CHANGELOG with migration guide
2. Ensure major version bump
3. Consider deprecation warnings before removal

### 7. Update Documentation

Check if these files need updates:

| File                                       | Update When                                   |
| ------------------------------------------ | --------------------------------------------- |
| `libs/grid/README.md`                      | New features, API changes                     |
| Plugin READMEs                             | Plugin changes                                |
| `apps/docs/src/content/docs/grid/**/*.mdx` | Theming, API, getting started changes         |
| `llms.txt`                                 | Public API, plugins, events, CSS vars changed |
| `llms-full.txt`                            | Full AI guide needs updating                  |
| `.github/copilot-instructions.md`          | Workflow or conventions changed               |

### 8. Verify Docs Site Builds

```bash
bun nx build docs
```

Docs site must build without errors.

### 9. Test Demo Applications

```bash
bun nx serve demo-vanilla
bun nx serve demo-angular
bun nx serve demo-react
```

Manually verify demos work with the latest changes.

### 10. Final Commit Hygiene

- All commits follow Conventional Commits format: `type(scope): description`
- No WIP commits in the release branch
- Squash or rebase if needed for clean history

## Release Process

This project uses `release-please` for automated releases:

- Configuration in `release-please-config.json`
- Merging to main triggers release PR generation
- Approving the release PR publishes to npm

## Post-Release

- Verify npm packages published correctly
- Check that GitHub release notes are accurate
- Update any external documentation or announcements

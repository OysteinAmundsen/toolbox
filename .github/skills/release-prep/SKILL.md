---
name: release-prep
description: Prepare a @toolbox-web library for release. Runs the full pre-release checklist including lint, test, build, bundle size check, CHANGELOG review, and documentation updates.
argument-hint: [library-name]
---

# Release Preparation

Run the full pre-release checklist for a @toolbox-web library.

## Pre-Release Checklist

### 1. Lint All Projects

```bash
bun run lint
```

Fix any lint errors before proceeding. Do not skip warnings either — address or suppress with justification.

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

- Raw size ≤ 170 kB
- Gzipped ≤ 45 kB

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

| File                              | Update When                                   |
| --------------------------------- | --------------------------------------------- |
| `libs/grid/README.md`             | New features, API changes                     |
| Plugin READMEs                    | Plugin changes                                |
| `libs/grid/docs/*.mdx`            | Theming, API, getting started changes         |
| Plugin `.mdx` files               | Plugin feature changes                        |
| `llms.txt`                        | Public API, plugins, events, CSS vars changed |
| `llms-full.txt`                   | Full AI guide needs updating                  |
| `.github/copilot-instructions.md` | Workflow or conventions changed               |

### 8. Verify Storybook Builds

```bash
bun nx build docs
```

Storybook must build without errors.

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

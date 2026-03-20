# Copilot Instructions for Toolbox Web

## Project Overview

This is an **Nx monorepo** for building a **suite of framework-agnostic component libraries** using **pure TypeScript web components**. The architecture prioritizes cross-framework compatibility - components work natively in vanilla JS, React, Vue, Angular, etc. without wrappers (though framework-specific adapters may be built separately for enhanced DX).

Currently houses `@toolbox-web/grid` as the flagship component (`<tbw-grid>`), with more libraries planned. The repo uses **Bun** as package manager/runtime, **Vitest** for testing, **Vite** for building, and **Astro/Starlight** for documentation.

## Scoped Instructions

Context-specific conventions are in `.github/instructions/` and auto-apply based on file paths:

| Instruction file         | Applies to                         | Content                                                                                    |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `grid-architecture`      | `libs/grid/src/**`                 | Config precedence, render scheduler, virtualization, custom styles, web component patterns |
| `grid-api`               | `libs/grid/**`                     | API stability, feature system, features vs plugins, plugin API                             |
| `grid-pitfalls`          | `libs/grid/**`                     | Grid-specific common pitfalls (13 items)                                                   |
| `typescript-conventions` | `**/*.ts`                          | No `as unknown as`, region markers, naming/visibility                                      |
| `css-conventions`        | `**/*.css`                         | Color guidelines, `light-dark()` usage                                                     |
| `testing-patterns`       | `**/*.spec.ts`                     | Test co-location, `waitUpgrade()`, DOM cleanup                                             |
| `docs-site`              | `apps/docs/**`                     | Astro/Starlight docs, key components                                                       |
| `framework-adapters`     | `libs/grid-{angular,react,vue}/**` | Adapter conventions, key files                                                             |

## Skills Reference

Task-specific workflows are documented in dedicated skill files (loaded on demand). Reference these when performing specialized tasks:

| Skill                 | Description                                    | When to use                                           |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `new-plugin`          | Create a new grid plugin                       | Adding a plugin with hooks, styles, tests, demos      |
| `bundle-check`        | Verify bundle size budget                      | After code changes that may affect bundle size        |
| `test-coverage`       | Analyze and improve test coverage              | Writing tests, improving coverage for a file          |
| `new-adapter-feature` | Add features across Angular/React/Vue adapters | Ensuring feature parity across framework adapters     |
| `release-prep`        | Pre-release checklist                          | Preparing a library version for release               |
| `astro-demo`          | Create Astro demo components and MDX docs      | Adding demos or documentation for features            |
| `debug-perf`          | Performance investigation                      | Profiling, hot path analysis, render scheduler issues |
| `debug-browser`       | Live browser debugging via Chrome DevTools MCP | DOM inspection, screenshots, console, script eval     |
| `docs-update`         | Documentation update checklist                 | After any feature, fix, or refactor                   |
| `new-adapter`         | Create a new framework adapter library         | Scaffolding a new adapter from scratch                |

## Core Development Principles

**Every change must consider these three pillars:**

### 1. Maintainability

- **File size limit**: Keep files under ~2000 lines of code (excluding JSDoc/comments)
- **Single responsibility**: Each module/file should have one clear purpose
- **Extract pure functions**: Move logic to `internal/` modules when it doesn't require `this` access
- **Region organization**: Use `// #region` markers for navigation in large files
- **Clear naming**: Function names should describe what they do, not how

### 2. Bundle Size

- **Core budget**: `index.js` must stay ≤170 kB (≤45 kB gzipped)
- **Tree-shakeable**: Features and plugins are separate entry points, not bundled in core
- **No dead code**: Remove unused functions, imports, and types immediately
- **Minimize abstraction overhead**: Prefer inline code over creating classes/wrappers for simple operations
- **Audit before adding**: New features must justify their byte cost

### 3. Performance

- **Hot path awareness**: Scroll handlers, cell rendering, and virtualization are hot paths - optimize aggressively
- **Avoid allocations**: Reuse objects in loops (e.g., `#pooledScrollEvent`)
- **Batch DOM operations**: Use `requestAnimationFrame` via the scheduler, never direct RAF calls
- **Minimize DOM queries**: Cache element references, avoid `querySelector` in hot paths
- **Lazy initialization**: Defer work that isn't needed for first paint

**When in doubt:** Smaller is better. Simpler is better. Faster is better.

**Before every PR, verify:**

```bash
bun nx build grid
# Check: index.js ≤170 kB, gzip ≤45 kB
```

## Architecture & Key Components

### Framework-Agnostic Design Philosophy

All libraries are built as **standard web components** (custom elements) using pure TypeScript. Zero framework lock-in — components work in any JavaScript environment. All web components use `tbw-` prefix (e.g., `<tbw-grid>`).

### Delivery Checklist

Every feature, fix, or refactor must complete **all four steps** before it is considered done:

1. **Implement the code** — Write the feature or fix following the project's architecture and conventions
2. **Write/update tests** — Add unit tests (co-located) and integration tests as needed; ensure all existing tests still pass
3. **Verify the build** — Run `bun nx build grid` (check bundle budget), `bun nx test grid`, and `bun nx lint grid`; fix any failures
4. **Update documentation** — Use the `docs-update` skill for the full checklist (MDX pages, READMEs, llms.txt, llms-full.txt, copilot-instructions, TypeDoc regeneration)

Do **not** consider work complete until all four steps are finished. Skipping documentation is not acceptable — it is a required delivery step, not an afterthought.

### Commit Hygiene

Prompt the user to commit at logical stopping points during work sessions. Small, focused commits are preferred over large omnibus commits.

**Before suggesting a commit, review documentation** — use the `docs-update` skill for the full checklist of what to update (READMEs, MDX, llms.txt, copilot-instructions, etc.).

**When to suggest a commit:**

- After each discrete bug fix
- After adding or modifying a single feature
- After updating tests for a specific change
- After documentation updates
- After refactoring a single module or function
- After fixing build/config issues

**Commit message format (Conventional Commits):**

```
type(scope): short description

[optional body with more detail]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `perf`

**Scopes:** `grid`, `grid-angular`, `grid-react`, `themes`, `docs`, `demo`

**Prompt format:** After completing a logical unit of work, suggest:

> 📦 **Good commit point:** `type(scope): description`

### Monorepo Structure

- **`libs/grid/`** - First library in suite; single `<tbw-grid>` component with extensive internal modules
- **`libs/grid-angular/`** - Angular adapter library (`@toolbox-web/grid-angular`)
- **`libs/grid-react/`** - React adapter library (`@toolbox-web/grid-react`)
- **`libs/grid-vue/`** - Vue adapter library (`@toolbox-web/grid-vue`)
- **`libs/themes/`** - Shared CSS theme system
- **`apps/docs/`** - Astro/Starlight documentation site (https://toolboxjs.com)
- **`demos/employee-management/`** - Demo apps: `vanilla/`, `angular/`, `react/`, `vue/`, `shared/`

## Critical Workflows

### Development Commands

> **Important**: Always run tasks through **Nx**, never invoke Vitest, Vite, or ESLint directly.

```bash
bun nx serve docs          # Start docs site (port 4401)
bun nx build grid          # Build grid library
bun nx test grid           # Run grid tests
bun nx test grid --testFile=src/lib/plugins/visibility/group-drag.spec.ts
bun run lint               # Lint all projects
bun run lint && bun run test && bun run build  # CI flow
bun nx affected -t test    # Run affected tests
bun nx serve demo-vanilla  # Serve a demo app
```

**Common mistakes to avoid:**

- ❌ `npx vitest run path/to/spec.ts` — bypasses Nx config; will fail
- ❌ `bunx vitest …` — same issue
- ❌ `npx eslint …` — use `bun nx lint <project>` instead
- ✅ Always use `bun nx <target> <project>` or `bun run <script>`

### Adding a New Feature to Grid (or any library)

1. **Define types** in `types.ts` (public) or as inline types (internal)
2. **Implement logic** in appropriate `internal/*.ts` module (keep pure functions testable)
3. **Add unit tests** co-located with source file (e.g., `feature.ts` → `feature.spec.ts`)
4. **Add integration test** in `src/__tests__/integration/` if it requires full component lifecycle
5. **Create demo** in `apps/docs/src/components/demos/` demonstrating the feature
6. **Export public API** in `src/public.ts` if exposing new types/functions

### Path Mappings

TypeScript paths defined in `tsconfig.base.json` for all libraries:

```json
"@toolbox-web/grid": ["dist/libs/grid/index.d.ts"],
"@toolbox-web/grid/all": ["dist/libs/grid/all.d.ts"],
"@toolbox-web/grid/*": ["dist/libs/grid/*"],
"@toolbox-web/grid-angular": ["dist/libs/grid-angular/index.d.ts"],
"@toolbox/themes/*": ["libs/themes/*"]
```

**Note**: Grid paths point to `dist/` for type resolution after build. Use workspace paths, not relative paths across libs.

## Project-Specific Conventions

### Code Style

- **Strict TypeScript**: `strict: true`, no implicit any, prefer explicit types
- **ESLint config**: Flat config in `eslint.config.mjs` using `@nx/eslint-plugin`
- **Formatting**: Prettier v3.8.x (no explicit config file; uses defaults)

### Vite Build Outputs

Configured in `vite.config.ts`:

- **ESM** format for modern bundlers (no CJS - web components require browser context)
- **UMD** bundles for CDN/script tag usage
- **vite-plugin-dts** with `rollupTypes: true` for bundled TypeScript declarations
- **esbuild** minification for optimal bundle size
- **Sourcemaps** enabled for debugging

### Nx Caching & CI

- **Nx Cloud**: Connected (ID in `nx.json`); distributed task execution available
- **CI**: GitHub Actions `.github/workflows/ci.yml` runs `bun nx run-many -t lint test build`
- **Affected commands**: Use `nx affected` to run tasks only on changed projects
- **Sync TypeScript refs**: `nx sync` updates project references based on dependency graph

## Common Pitfalls

1. **Don't import from `internal/` in public API** - Keep `src/public.ts` as the only external export
2. **TypeScript paths** - Use workspace paths (`@toolbox/*`) not relative paths between libs
3. **Nx target names** - Use inferred targets from plugins (e.g., `test`, `build`, `lint`); check `project.json` for custom targets
4. **Bun vs Node** - This repo uses Bun; some Node-specific patterns may not work

Grid-specific pitfalls are in `.github/instructions/grid-pitfalls.instructions.md` (auto-applied when working on grid files).

## External Dependencies

- **Nx**: v22.4.x - Monorepo task orchestration
- **Vite**: v7.3.x - Build tool and dev server
- **Vitest**: v4.x - Fast unit test runner
- **Bun**: Package manager + test runtime (faster than npm/yarn)
- **Astro**: v5.18.x - Documentation site framework
- **Starlight**: v0.37.x - Astro docs theme
- **happy-dom**: DOM environment for testing
- **Prettier**: v3.8.x - Code formatting (uses defaults)

## Key Files Reference

- **`libs/grid/src/public.ts`** - Public API surface; only import from here externally
- **`libs/grid/src/lib/core/types.ts`** - Type definitions for grid configuration
- **`libs/grid/src/lib/core/grid.ts`** - Main component implementation
- **`libs/grid/src/lib/core/styles/`** - Modular CSS (`@layer tbw-base` → `@layer tbw-plugins` → `@layer tbw-theme`)
- **`libs/grid/src/lib/core/internal/render-scheduler.ts`** - Centralized render orchestration
- **`libs/grid/src/lib/core/internal/config-manager.ts`** - Configuration management (single source of truth)
- **`libs/grid/src/lib/features/`** - Feature registry and 22 feature modules
- **`libs/grid/src/lib/core/plugin/`** - Plugin system (registry, hooks, state management)
- **`libs/grid/src/lib/plugins/`** - Individual plugin implementations
- **`libs/grid/vite.config.ts`** - Vite build configuration with plugin bundling
- **`apps/docs/src/content/docs/grid/`** - Astro MDX documentation pages
- **`apps/docs/src/components/demos/`** - Interactive demo components (.astro)
- **`demos/employee-management/`** - Demo applications (vanilla, angular, react, vue, shared)
- **`tsconfig.base.json`** - Workspace-wide TypeScript paths
- **`nx.json`** - Nx workspace config with plugins and target defaults
- **`.github/workflows/ci.yml`** - CI pipeline (Bun-based)

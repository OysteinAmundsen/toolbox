# Copilot Instructions for Toolbox Web

## Project Overview

**Nx monorepo** for building **framework-agnostic component libraries** using **pure TypeScript web components** (custom elements with `tbw-` prefix). Components work natively in vanilla JS, React, Vue, Angular without wrappers.

**Toolchain:** Bun (package manager/runtime) · Nx (task orchestration) · Vite (build) · Vitest (test) · Astro/Starlight (docs)

**Flagship library:** `@toolbox-web/grid` (`<tbw-grid>`)

### Monorepo Structure

| Path                         | Description                                                      |
| ---------------------------- | ---------------------------------------------------------------- |
| `libs/grid/`                 | Core grid component with features, plugins, and internal modules |
| `libs/grid-angular/`         | Angular adapter (`@toolbox-web/grid-angular`)                    |
| `libs/grid-react/`           | React adapter (`@toolbox-web/grid-react`)                        |
| `libs/grid-vue/`             | Vue adapter (`@toolbox-web/grid-vue`)                            |
| `libs/themes/`               | Shared CSS theme system                                          |
| `apps/docs/`                 | Astro/Starlight documentation site (https://toolboxjs.com)       |
| `demos/employee-management/` | Demo apps: `vanilla/`, `angular/`, `react/`, `vue/`, `shared/`   |

## Knowledge Base Architecture

This project's AI knowledge is organized in three tiers to minimize context window usage:

1. **This file** (always loaded) — Project overview, navigation hub, core constraints
2. **Instruction files** (auto-loaded by file path) — Conventions and rules for specific file types
3. **Skill files** (loaded on demand) — Multi-step workflows and procedures

> **Continuous improvement:** After significant tasks, use the `retrospective` skill to capture lessons learned and update the knowledge base. See [Scoped Instructions](#scoped-instructions) and [Skills Reference](#skills-reference) below.

### Scoped Instructions

Auto-applied from `.github/instructions/` when working on matching files:

| Instruction file         | Applies to                         | Content                                                                     |
| ------------------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| `development-principles` | `{libs,apps,demos}/**/*.ts`        | Three pillars: maintainability, bundle size, performance                    |
| `delivery-workflow`      | `{libs,apps,demos}/**`             | 5-step delivery checklist, commit hygiene, feature workflow                 |
| `nx-workflow`            | `{libs,apps,demos,e2e}/**`         | Nx commands, path mappings, Vite build, CI                                  |
| `grid-architecture`      | `libs/grid/src/**`                 | Config precedence, render scheduler, virtualization, web component patterns |
| `grid-api`               | `libs/grid/**`                     | API stability, feature system, features vs plugins, plugin API              |
| `grid-pitfalls`          | `libs/grid/**`                     | Grid-specific common pitfalls                                               |
| `typescript-conventions` | `**/*.ts`                          | No `as unknown as`, region markers, naming/visibility                       |
| `css-conventions`        | `**/*.css`                         | Color guidelines, `light-dark()` usage                                      |
| `testing-patterns`       | `**/*.spec.ts`                     | Test co-location, `waitUpgrade()`, DOM cleanup                              |
| `e2e-testing`            | `{e2e,apps/docs-e2e}/**`           | Playwright patterns, docs demo e2e, cross-framework e2e, utilities          |
| `docs-site`              | `apps/docs/**`                     | Astro/Starlight docs, key components                                        |
| `framework-adapters`     | `libs/grid-{angular,react,vue}/**` | Adapter conventions, key files                                              |

### Skills Reference

Loaded on demand from `.github/skills/` for task-specific workflows:

| Skill                 | When to use                                             |
| --------------------- | ------------------------------------------------------- |
| `new-plugin`          | Adding a grid plugin with hooks, styles, tests, demos   |
| `bundle-check`        | After code changes that may affect bundle size          |
| `test-coverage`       | Writing tests, improving coverage for a file            |
| `new-adapter-feature` | Ensuring feature parity across framework adapters       |
| `new-adapter`         | Scaffolding a new framework adapter from scratch        |
| `release-prep`        | Preparing a library version for release                 |
| `astro-demo`          | Adding demos or documentation for features              |
| `debug-perf`          | Profiling, hot path analysis, render scheduler issues   |
| `debug-browser`       | DOM inspection, screenshots, console, script eval       |
| `docs-update`         | After any feature, fix, or refactor                     |
| `retrospective`       | Post-task lessons learned; update instructions & skills |

## Core Constraints

- **Bundle budget:** `index.js` ≤170 kB (≤45 kB gzipped) — verify with `bun nx build grid`
- **Always use Nx:** `bun nx <target> <project>`, never invoke Vitest/Vite/ESLint directly
- **Strict TypeScript:** `strict: true`, no implicit any
- **Code style:** ESLint flat config + Prettier defaults
- **Web components:** All libraries use standard custom elements, `tbw-` prefix

## Common Pitfalls

1. **Don't import from `internal/` in public API** — Keep `src/public.ts` as the only external export
2. **TypeScript paths** — Use workspace paths (`@toolbox-web/*`) not relative paths between libs
3. **Nx target names** — Use inferred targets from plugins (e.g., `test`, `build`, `lint`)
4. **Bun vs Node** — This repo uses Bun; some Node-specific patterns may not work

Grid-specific pitfalls are in `grid-pitfalls.instructions.md` (auto-applied when editing grid files).

## External Dependencies

Nx v22.4.x · Vite v7.3.x · Vitest v4.x · Bun · Astro v5.18.x · Starlight v0.37.x · happy-dom · Prettier v3.8.x

## Key Files Reference

| File                                                  | Purpose                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `libs/grid/src/public.ts`                             | Public API surface                                            |
| `libs/grid/src/lib/core/types.ts`                     | Grid configuration types                                      |
| `libs/grid/src/lib/core/grid.ts`                      | Main component implementation                                 |
| `libs/grid/src/lib/core/styles/`                      | Modular CSS layers (`tbw-base` → `tbw-plugins` → `tbw-theme`) |
| `libs/grid/src/lib/core/internal/render-scheduler.ts` | Centralized render orchestration                              |
| `libs/grid/src/lib/core/internal/config-manager.ts`   | Configuration management                                      |
| `libs/grid/src/lib/features/`                         | Feature registry and modules                                  |
| `libs/grid/src/lib/core/plugin/`                      | Plugin system (registry, hooks, state)                        |
| `libs/grid/src/lib/plugins/`                          | Individual plugin implementations                             |
| `libs/grid/vite.config.ts`                            | Vite build with plugin bundling                               |
| `apps/docs/src/content/docs/grid/`                    | Astro MDX documentation                                       |
| `apps/docs/src/components/demos/`                     | Interactive demo components                                   |
| `tsconfig.base.json`                                  | Workspace-wide TypeScript paths                               |
| `nx.json`                                             | Nx workspace config                                           |

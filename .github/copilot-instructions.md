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

This project's AI knowledge is organized in four tiers to minimize context window usage:

1. **This file** (always loaded) — Project overview, navigation hub, core constraints
2. **Instruction files** (auto-loaded by file path) — Conventions and rules for specific file types (prescriptive: _how to work_)
3. **Skill files** (loaded on demand) — Multi-step workflows and procedures (procedural: _how to do X_)
4. **Knowledge files** (loaded on demand at task start) — Living mental model of the system (descriptive: _how it works and why_)

> **Knowledge files — read before editing, write after learning:**
>
> - **Read gate:** Before editing any file under `libs/grid/**`, `libs/grid-{angular,react,vue}/**`, or making a non-trivial change anywhere else, you MUST first read the knowledge files that cover the affected domain (see [Knowledge Reference](#knowledge-reference)). This rebuilds the mental model — state ownership, invariants, design rationale — so you can spot when a proposed change contradicts an earlier `DECIDED` entry and push back rather than silently regress it. Trivial edits (typos, comments, formatting) are exempt.
> - **Write gate:** During or after any task, if you discover a new invariant, state-ownership fact, data-flow edge, design decision, or tension that is not already in a knowledge file, you MUST add it to the correct file in `.github/knowledge/` using the structured notation (`OWNS / READS FROM / WRITES TO / INVARIANT / FLOW / TENSION / DECIDED`). These files are your externalized mental model — if you don't write it down, the next session will rediscover it from scratch.
> - **Knowledge vs. memory — do not confuse them:** Anything that is true _about this repository_ (architecture facts, design decisions, gotchas, build/test recipes, release plans, deprecation inventories) belongs in `.github/knowledge/*.md` (or, for prescriptive rules, `.github/instructions/*.md`) so it is **committable, reviewable, and shared with every contributor and future agent session**. The `/memories/repo/` scope is for **agent-private, machine-local scratch only** — e.g. notes about an in-flight investigation that the user has not yet decided to formalize. If the fact would help a human contributor or another agent on a different machine, it goes in the knowledge base, not in repo memory. When in doubt, choose the knowledge base.
> - **Rule of thumb:** If the user ever argues for a change that contradicts a `DECIDED` entry, cite the entry and ask them to justify overriding it before implementing. Past decisions have context; don't silently reverse them.

> **Knowledge file style — keep them dense or they stop working:**
> Knowledge files are an _agent_ tool. Their value is being scannable enough that you can rebuild a mental model in seconds without burning context window. They lose that value the moment they drift into changelog prose. Apply these rules every time you touch a `.github/knowledge/*.md` file:
>
> - **`DECIDED` is one bullet, not a paragraph.** Format: `DECIDED (date/PR): <conclusion>. WHY: <one-line rationale>. <File / test reference>.` Aim for 1-4 lines. If you have more to say, the next bullet is `INVARIANT:` or `TENSION:`, not a continuation paragraph.
> - **No history-as-DECIDED.** "We tried X, then Y, then settled on Z because A then B then C" is a commit message, not knowledge. Write the conclusion ("Use Z; X breaks because A") and let `git log` carry the story. The exception is a "RULED OUT:" line listing alternatives that look obvious but don't work — one line each, max.
> - **Preserve every spec file path, PR/issue number, function/class name, and "MUST/MUST NOT" rule.** Those are the navigation targets. Drop adjectives, transitions, and explanation of obvious mechanics — keep proper nouns.
> - **Tables beat prose for enumerations.** A 23-row feature/binding list is a 25-line table, not a 25-line paragraph.
> - **Compress, don't append.** When updating an existing entry, rewrite it. Do not stack a new "DECIDED (May 2026, follow-up to follow-up): ..." on top — fold the new fact into the existing entry.
> - **No tier-by-tier history sections.** When a multi-pass refactor lands, replace the per-pass narrative with the post-refactor invariants. Keep at most one short paragraph of historical context if a future maintainer would otherwise be confused by the absence.
> - **Move guidance to the right home.** Test-writing patterns belong in `.github/instructions/testing-patterns.instructions.md` (auto-applied to `*.spec.ts`), not in a knowledge file. Workflow recipes belong in `.github/skills/`. Knowledge files describe _how the code is and why_, not _how to write tests for it_.
> - **Soft size budget per knowledge file: ≤200 lines.** Hard ceiling: 250. If you're past 200, condense before adding. If a single domain genuinely needs more, split (e.g. `adapters-react.md` / `adapters-vue.md` / `adapters-angular.md`) — but try condensing first.
> - **Write for yourself, not the user.** No "in this section we will...", no narrative tone, no marketing language. Bullets, tables, code fences, structured markers (`OWNS:`, `INVARIANT:`, `DECIDED:`).

> **Continuous improvement:** After significant tasks, use the `retrospective` skill to capture lessons learned and update the knowledge base. See [Scoped Instructions](#scoped-instructions), [Knowledge Reference](#knowledge-reference), and [Skills Reference](#skills-reference) below.

### Scoped Instructions

Auto-applied from `.github/instructions/` when working on matching files:

| Instruction file         | Applies to                         | Content                                                                 |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| `development-principles` | `{libs,apps,demos}/**/*.ts`        | Three pillars + troubleshooting: check pitfalls when stuck              |
| `delivery-workflow`      | `{libs,apps,demos}/**`             | 5-step delivery checklist, commit hygiene, feature workflow             |
| `nx-workflow`            | `{libs,apps,demos,e2e}/**`         | Nx commands, path mappings, Vite build, CI                              |
| `grid-architecture`      | `libs/grid/src/**`                 | Config precedence, render scheduler, virtualization, plugin DOM access  |
| `grid-api`               | `libs/grid/**`                     | API stability, features vs plugins, plugin conventions, usage reference |
| `grid-pitfalls`          | `libs/grid/**`                     | Counterintuitive DOM/render/plugin gotchas (check when debugging)       |
| `typescript-conventions` | `**/*.ts`                          | No `as unknown as`, region markers, naming/visibility                   |
| `css-conventions`        | `**/*.css`                         | Color guidelines, `light-dark()`, hover/sticky rules                    |
| `testing-patterns`       | `**/*.spec.ts`                     | Test co-location, `waitUpgrade()`, DOM cleanup                          |
| `e2e-testing`            | `{e2e,apps/docs-e2e}/**`           | Playwright patterns, docs demo e2e, cross-framework e2e, utilities      |
| `docs-site`              | `apps/docs/**`                     | Astro/Starlight docs, key components                                    |
| `framework-adapters`     | `libs/grid-{angular,react,vue}/**` | Adapter conventions, key files                                          |

### Knowledge Reference

Loaded on demand from `.github/knowledge/` — read relevant files before starting work to rebuild the mental model:

| Knowledge file     | Domain                    | Content                                                                          |
| ------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| `grid-core`        | Grid internals            | Config-manager, render-scheduler, virtualization, DOM structure, state ownership |
| `grid-plugins`     | Plugin system             | Plugin lifecycle, hooks, inter-plugin communication, all 24 plugins catalogued   |
| `grid-features`    | Feature registry          | Feature vs plugin distinction, registry pattern, all 25 features                 |
| `adapters`         | Framework adapters        | React/Vue/Angular bridging, portal/teleport patterns, event handling             |
| `build-and-deploy` | Build, CSS, release       | Vite config, bundle budgets, CSS layers, themes, CI pipeline                     |
| `data-flow-traces` | End-to-end operation maps | First render, property change, sort, scroll, edit, tree expand, config merge     |

> **Schema:** Each entry uses structured notation — OWNS, READS FROM, WRITES TO, INVARIANT, FLOW, TENSION, DECIDED — optimized for fast scanning and mental model reconstruction.

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

- **Never push or merge to a remote without explicit per-request user consent.** Local commits are fine; `git push`, `gh pr create`, `gh pr merge`, force-pushes, tag pushes, and any GitHub-mutating tool call are **forbidden** unless the user asked for that exact action in the current turn. Never commit directly to `main` — switch to a topic branch first. See the "Git Safety Rules" section in `delivery-workflow.instructions.md` for the full list and recovery procedure if you slip.
- **Delivery workflow is mandatory:** Every change — no matter how small — must follow the 7-step delivery checklist in `delivery-workflow.instructions.md`: read knowledge → implement → test → build/lint → docs → retrospective + knowledge update → commit suggestion. Do not consider work complete until all steps are finished. No exceptions.
  - **Hard precondition:** Before calling any file-editing or code-running tool, you MUST first call `manage_todo_list` with the seven delivery steps. Read-only exploration does not require the list; the moment you intend to modify the workspace, it does.
  - **Completion gate:** Do not output "done", "complete", or a wrap-up summary until every todo is marked completed. A step may be marked completed with "N/A" only in the specific cases listed in `delivery-workflow.instructions.md` — state the reason explicitly; never silently skip.
  - **Self-audit:** Before the final message, state in one concrete sentence what was done for each completed step (e.g. "Read `grid-plugins.md`; ran `bun nx test grid` — 3225 passed; added `DECIDED` entry for pinned-rows count derivation"). End with `📦 **Good commit point:** type(scope): ...`.
- **Bundle budget:** `index.js` ≤170 kB raw and ≤50 kB gzipped (build fails) with a soft warning at 45 kB gzipped; plugins ≤50 kB each; adapters: react ≤50 kB / vue ≤50 kB — enforced by `tools/vite-bundle-budget.ts`. Keep core lean: any feature that can ship as a plugin without hurting performance MUST be a plugin.
- **Always use Nx:** `bun nx <target> <project>`, never invoke Vitest/Vite/ESLint directly
- **Strict TypeScript:** `strict: true`, no implicit any
- **Code style:** ESLint flat config + Prettier defaults
- **Web components:** All libraries use standard custom elements, `tbw-` prefix
- **Terminal command shape (Windows / Git Bash):** Do **not** pipe long-running or Nx commands through `| tail -n …`, `| head -n …`, or redirect with `2>&1` in this workspace. On the user's setup these constructs frequently cause the terminal integration to hang indefinitely (the command never returns control). Run the command plainly and let the tool's automatic output truncation handle large output. If you must filter, prefer `grep`/`awk` without an `2>&1` redirect, or write to a file with `> out.log` and read it with `read_file`.

## Common Pitfalls

1. **Don't import from `internal/` in public API** — Keep `src/public.ts` as the only external export
2. **TypeScript paths** — Use workspace paths (`@toolbox-web/*`) not relative paths between libs
3. **Nx target names** — Use inferred targets from plugins (e.g., `test`, `build`, `lint`)
4. **Bun vs Node** — This repo uses Bun; some Node-specific patterns may not work
5. **Don't append `| tail`, `| head`, or `2>&1`** to terminal commands — they hang the terminal session on this machine. Run commands plainly.

Grid-specific gotchas (DOM, rendering, plugin system) are in `grid-pitfalls.instructions.md` (auto-applied when editing grid files). **Check pitfalls first when something fails unexpectedly.**

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

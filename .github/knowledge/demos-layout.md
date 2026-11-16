---
domain: demos-layout
related: [build-and-deploy, adapters]
---

# Demo Apps — Mental Model

> Shared routes and fixtures across framework demos. Build/serve wiring → build-and-deploy.md.
> Read order for demo parity: shared fixtures → shell routes → E2E demo registry.

## demos layout

- All four frameworks use the route-based shell under `demos/<framework>/`; each shell bootstraps an idiomatic router and registers one lazy route per demo. Demos live at `src/demos/<demo-name>/`.
- INVARIANT: per-demo data/types/styles live in `demos/shared/<demo-name>/` so every framework imports identical fixtures via `@demo/shared/<demo-name>` — required for cross-framework parity tests in `e2e/`.
- INVARIANT: [demos/shared/resolve-aliases.ts](demos/shared/resolve-aliases.ts) enumerates demo names in a `demoNames` array; adding a demo = appending one string. The Angular esbuild plugin (`demos/angular/tools/esbuild-alias-plugin.mjs`) duplicates this logic (Angular bypasses Vite) — keep them in sync.
- INVARIANT: every shell loads routes lazily (`import()` for vanilla/Vue, `lazy()` for React, `loadComponent` for Angular).
- INVARIANT: `/` renders a demo index listing every registered route (unknown paths too) and returns 200, so CI `wait-on http://localhost:<port>` keeps working. E2E targets `localhost:<port>/employee-management` via `e2e/tests/utils.ts:DEMOS`.
- INVARIANT: the docs site imports the pure grid factory via `@demo/vanilla/<demo-name>` (→ `demos/vanilla/src/demos/<demo-name>/grid-factory.ts`), NOT the route module — keep factory (`createEmployeeGrid()`) separate from the route module's mount/teardown + control panel. React/Vue/Angular need no factory (docs does not import their adapters).
- Routers: vanilla = hand-rolled `shell/router.ts` (~50 LOC, pathname-based); React = `react-router-dom` v7; Vue = `vue-router` v4 (`createWebHistory()`); Angular = `provideRouter()` + `loadComponent`. DECIDED: framework demos double as reference setups so they use idiomatic routers; the vanilla demo is a fixture, so an extra dependency would be noise. Angular flattens to `demos/angular/src/` (no `src/app/` wrapper).

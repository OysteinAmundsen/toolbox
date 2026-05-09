# Demos

Each framework has a single shell app under `demos/<framework>/`. Demos are organised as
routes under `src/demos/<demo-name>/` so a single dev server can host any number of
demo grids. Cross-framework parity is preserved by sharing per-demo data, types and
styles from `demos/shared/<demo-name>/`.

## Layout

```
demos/
├── shared/                     # Per-demo shared resources (identical across frameworks)
│   └── employee-management/    # data.ts, types.ts, demo-styles.css, styles.ts, index.ts
├── vanilla/                    # Pure TypeScript shell (port 4000)
│   └── src/
│       ├── main.ts             # Bootstrap → router
│       ├── shell/router.ts     # Hand-rolled pathname router (~50 LOC)
│       └── demos/employee-management/
│           ├── grid-factory.ts # Pure factory used by the docs site (@demo/vanilla/...)
│           └── index.ts        # Route module: control panel + mount/teardown
├── react/                      # React 19 shell (port 4300, react-router-dom)
│   └── src/
│       ├── main.tsx            # Bootstrap → BrowserRouter
│       ├── shell/App.tsx       # <Routes> with one lazy route per demo
│       └── demos/employee-management/EmployeeManagement.tsx
├── vue/                        # Vue 3 shell (port 4100, vue-router)
│   └── src/
│       ├── main.ts             # Bootstrap → router
│       ├── shell/{App.vue,router.ts}
│       └── demos/employee-management/EmployeeManagement.vue
└── angular/                    # Angular 21 shell (port 4200, @angular/router)
    └── src/
        ├── main.ts             # Bootstrap → AppComponent + appConfig
        ├── app.component.ts    # <router-outlet />
        ├── app.routes.ts       # loadComponent per demo
        └── demos/employee-management/employee-management.component.ts
```

`/` in any shell falls back to the first registered route, which keeps the
existing `wait-on http://localhost:<port>` health checks working.

## Running

Development (resolves to source for fast HMR):

```bash
bun run demo                    # all four shells in parallel
bun nx serve demo-vanilla       # or one at a time
bun nx serve demo-react
bun nx serve demo-vue
bun nx serve demo-angular
```

Direct URL to a specific demo: `http://localhost:<port>/employee-management`.

Validate against built packages instead of source:

```bash
bun run demo:dist               # all shells against dist/
USE_DIST=true bun nx serve demo-react
```

## Adding a new demo

1. Create `demos/shared/<demo-name>/` with data, types, styles. Add `<demo-name>` to the
   `demoNames` array in [`demos/shared/resolve-aliases.ts`](./shared/resolve-aliases.ts).
2. For each framework, add a route module under `src/demos/<demo-name>/` and register it
   in the framework's shell (`shell/App.tsx`, `shell/router.ts`, `shell/App.vue`,
   or `app.routes.ts`).
3. The Astro docs alias `@demo/vanilla/<demo-name>` → factory module is wired in
   [`apps/docs/astro.config.mjs`](../apps/docs/astro.config.mjs) — extend it if the
   docs need to embed the new demo.

## Adding a new framework

See `.github/skills/new-adapter.md` and the existing shells as templates.

---
applyTo: '{libs,apps,demos,e2e}/**'
---

# Nx & Build Workflow

## Development Commands

> **Important — task execution rules**:
>
> 1. **Always invoke tasks through Nx** (`bun nx <target> <project>` or `bun run <script>`). Nx applies the workspace's project graph, caching, and inferred target configuration; bypassing it skips those layers.
> 2. **Never call Vitest directly** (`npx vitest`, `bunx vitest`). Vitest is configured per-project via Nx-inferred targets — direct invocation loads the wrong config and the run will fail.
> 3. **Never call Vite directly** for builds or dev servers. The Nx target wires plugin discovery, output paths, and bundle-budget checks that a bare `vite build` skips.
> 4. **Never call ESLint directly** (`npx eslint`). Use `bun nx lint <project>` so the flat config is resolved against the project's tsconfig and Nx's lint configuration.

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

## Path Mappings

TypeScript paths defined in `tsconfig.base.json` for all libraries:

```json
"@toolbox-web/grid": ["dist/libs/grid/index.d.ts"],
"@toolbox-web/grid/all": ["dist/libs/grid/all.d.ts"],
"@toolbox-web/grid/*": ["dist/libs/grid/*"],
"@toolbox-web/grid-angular": ["dist/libs/grid-angular/index.d.ts"],
"@toolbox/themes/*": ["libs/themes/*"]
```

**Note**: Grid paths point to `dist/` for type resolution after build. Use the TypeScript path aliases defined in `tsconfig.base.json` (e.g. `@toolbox-web/grid`), not relative file paths (e.g. `../../grid/src/...`) when importing across libraries.

## Vite Build Outputs

- **ESM** format for modern bundlers (no CJS — web components require browser context)
- **UMD** bundles for CDN/script tag usage
- **vite-plugin-dts** with `rollupTypes: true` for bundled TypeScript declarations
- **esbuild** minification for optimal bundle size
- **Sourcemaps** enabled for debugging

## Nx Caching & CI

- **Nx Cloud**: Connected (ID in `nx.json`); distributed task execution available
- **CI**: GitHub Actions `.github/workflows/ci.yml` runs `bun nx run-many -t lint test build`
- **Affected commands**: Use `nx affected` to run tasks only on changed projects
- **Sync TypeScript refs**: `nx sync` updates project references based on dependency graph

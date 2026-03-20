---
applyTo: '{libs,apps,demos,e2e}/**'
---

# Nx & Build Workflow

## Development Commands

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

## Path Mappings

TypeScript paths defined in `tsconfig.base.json` for all libraries:

```json
"@toolbox-web/grid": ["dist/libs/grid/index.d.ts"],
"@toolbox-web/grid/all": ["dist/libs/grid/all.d.ts"],
"@toolbox-web/grid/*": ["dist/libs/grid/*"],
"@toolbox-web/grid-angular": ["dist/libs/grid-angular/index.d.ts"],
"@toolbox/themes/*": ["libs/themes/*"]
```

**Note**: Grid paths point to `dist/` for type resolution after build. Use workspace paths, not relative paths across libs.

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

````skill
---
name: new-adapter
description: Create a new framework adapter library for @toolbox-web/grid, with a matching demo app. Covers library scaffolding, adapter implementation, demo setup, workspace wiring, and e2e parity testing.
argument-hint: <framework-name>
---

# Create a New Framework Adapter

This skill guides you through creating a **complete framework adapter** for `@toolbox-web/grid` — a library (`@toolbox-web/grid-{framework}`), a demo app (`demo-{framework}`), and all workspace wiring needed to integrate with the monorepo.

> **Prerequisite**: Read the `new-adapter-feature` skill to understand how features work *within* existing adapters. This skill covers creating an adapter from scratch.

## What You're Building

An adapter bridges the gap between the vanilla `<tbw-grid>` web component and a specific framework's component model. It provides:

1. **A `FrameworkAdapter` implementation** — handles mounting/destroying framework components inside grid cells
2. **A wrapper component** — idiomatic API surface (props, events, slots/children) for the framework
3. **Feature modules** — tree-shakeable plugin registration via side-effect imports
4. **A demo app** — full employee management demo matching all other framework demos visually and functionally

## Architecture Reference

### The `FrameworkAdapter` Interface

Every adapter must implement this interface (from `@toolbox-web/grid`):

```typescript
export interface FrameworkAdapter {
  /** Can this adapter handle the given light DOM element? */
  canHandle(element: HTMLElement): boolean;

  /** Create a cell renderer from a light DOM column element */
  createRenderer<TRow, TValue>(element: HTMLElement): ColumnViewRenderer<TRow, TValue>;

  /** Create a cell editor from a light DOM column element (undefined = use grid's built-in editor) */
  createEditor<TRow, TValue>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> | undefined;

  /** Create a tool panel renderer from a light DOM element (optional) */
  createToolPanelRenderer?(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined;

  /** Get type-level defaults from an app-level registry (optional) */
  getTypeDefault?<TRow>(type: string): TypeDefault<TRow> | undefined;

  /** Properly destroy cached views/components for a cell being released (optional) */
  releaseCell?(cellEl: HTMLElement): void;

  /** Unmount a framework container and free its resources (optional) */
  unmount?(container: HTMLElement): void;
}
```

### How Adapters Register

The grid has a static method for adapter registration:

```typescript
import { GridElement } from '@toolbox-web/grid';

// Register once at app bootstrap
GridElement.registerAdapter(new MyFrameworkAdapter(/* framework deps */));
```

Existing adapters auto-register when their wrapper component/directive initializes, so users don't call this manually.

### Existing Adapter Patterns

| Framework | Wrapper Component | Rendering | Column Registry | Component Mount/Destroy |
|-----------|-------------------|-----------|----------------|------------------------|
| **Angular** | `Grid` directive | `TemplateRef` + `ViewContainerRef` | Structural directives register templates | `createComponent()` / `viewRef.destroy()` |
| **React** | `<DataGrid>` component | `ReactDOM.createRoot()` per cell | `WeakMap<HTMLElement, ColumnRegistry>` + field fallback | `root.render()` / `root.unmount()` |
| **Vue** | `<TbwGrid>` SFC | `createApp()` + `createVNode()` | `WeakMap<HTMLElement, ColumnRegistry>` + field fallback | `app.mount()` / `app.unmount()` |

The **React and Vue patterns are nearly identical** — use them as your primary reference for a new adapter. Angular is unique due to its DI system and ng-packagr build.

### Feature Registry Pattern (Tree-Shakeable Plugins)

All adapters share a common pattern for tree-shakeable plugin loading:

1. **`feature-registry.ts`** — A `Map<string, PluginFactory>` where features self-register
2. **Feature modules** (`features/selection.ts`, etc.) — Import the grid plugin, call `registerFeature('name', factoryFn)`, and export a composable/hook
3. **Wrapper component** — Reads feature props, looks up registered factories, creates plugin instances

```
// features/selection.ts (side-effect module)
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { registerFeature } from '../lib/feature-registry';

registerFeature('selection', (config) => {
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  return new SelectionPlugin(typeof config === 'object' ? config : {});
});

// Also export a composable/hook for programmatic access
export function useGridSelection() { /* ... */ }
```

Users then import features as side effects:
```typescript
import '@toolbox-web/grid-{framework}/features/selection';
// The 'selection' prop now works on the wrapper component
```

**There are 24 feature modules** to implement (matching React/Vue):
`clipboard`, `column-virtualization`, `context-menu`, `editing`, `export`, `filtering`, `grouping-columns`, `grouping-rows`, `master-detail`, `multi-sort`, `pinned-columns`, `pinned-rows`, `pivot`, `print`, `reorder`, `responsive`, `row-reorder`, `selection`, `server-side`, `sorting`, `tree`, `undo-redo`, `visibility`, plus a barrel `index.ts` that re-exports all.

## Step 1: Scaffold the Library

Use the Nx MCP server tools to create the library project, or create it manually:

### Directory Structure

```
libs/grid-{framework}/
├── package.json
├── project.json
├── README.md
├── tsconfig.json
├── tsconfig.lib.json
├── tsconfig.spec.json
├── typedoc.json
├── vite.config.mts
└── src/
    ├── index.ts                         # Public barrel export
    ├── features/
    │   ├── index.ts                     # Re-exports all features (side-effect barrel)
    │   ├── selection.ts                 # One per feature (24 total)
    │   ├── editing.ts
    │   └── ...
    └── lib/
        ├── {framework}-grid-adapter.ts  # FrameworkAdapter implementation
        ├── feature-registry.ts          # registerFeature() + getRegisteredFeatures()
        ├── feature-props.ts             # TypeScript types for feature props
        ├── {framework}-column-config.ts # Extended config types with framework renderers
        ├── grid-type-registry.ts        # Type-level defaults (optional)
        ├── DataGrid.{ext}               # Wrapper component (.tsx, .vue, .svelte, etc.)
        ├── GridColumn.{ext}             # Column component for declarative renderers/editors
        ├── GridDetailPanel.{ext}        # Master-detail panel component
        ├── GridToolPanel.{ext}          # Tool panel component
        ├── GridToolButtons.{ext}        # Tool buttons component
        ├── GridResponsiveCard.{ext}     # Responsive card component
        └── composables.ts               # useGrid(), useGridEvent() (or hooks/stores)
```

### project.json

```jsonc
{
  "name": "grid-{framework}",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/grid-{framework}/src",
  "projectType": "library",
  "tags": ["type:lib", "scope:grid"],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "defaultConfiguration": "production",
      "dependsOn": [
        { "projects": ["grid"], "target": "build" }
      ],
      "options": {
        "outputPath": "dist/libs/grid-{framework}",
        "emptyOutDir": true
      },
      "configurations": {
        "development": { "mode": "development" },
        "production": { "mode": "production" }
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/grid-{framework}/**/*.{ts,tsx,vue,svelte}"]
        // ↑ Adjust extensions for your framework
      }
    },
    "typedoc": {
      "executor": "nx:run-commands",
      "options": {
        "command": "npx typedoc --options libs/grid-{framework}/typedoc.json"
      }
    }
  }
}
```

### package.json

```jsonc
{
  "name": "@toolbox-web/grid-{framework}",
  "version": "0.1.0",
  "description": "{Framework} adapter for @toolbox-web/grid data grid component",
  "type": "module",
  "main": "./index.js",
  "module": "./index.js",
  "types": "./index.d.ts",
  "typesVersions": {
    "*": {
      "features": ["features/index.d.ts"],
      "features/*": ["features/*.d.ts"]
    }
  },
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./index.d.ts",
      "import": "./index.js",
      "default": "./index.js"
    },
    "./features": {
      "types": "./features/index.d.ts",
      "import": "./features/index.js",
      "default": "./features/index.js"
    },
    "./features/*": {
      "types": "./features/*.d.ts",
      "import": "./features/*.js",
      "default": "./features/*.js"
    }
  },
  "peerDependencies": {
    "{framework-package}": ">=X.Y.Z",
    "@toolbox-web/grid": ">=1.0.0"
  },
  "sideEffects": ["./features/*.js"]
}
```

### vite.config.mts

Follow the React/Vue pattern. Key points:

```typescript
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
// import frameworkPlugin from '{framework-vite-plugin}';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/grid-{framework}',
  plugins: [
    // frameworkPlugin({ /* options */ }),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      pathsToAliases: false, // Preserve @toolbox-web/grid imports in .d.ts
    }),
  ],
  build: {
    outDir: '../../dist/libs/grid-{framework}',
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        'features/index': 'src/features/index.ts',
        // One entry per feature:
        'features/selection': 'src/features/selection.ts',
        'features/editing': 'src/features/editing.ts',
        // ... all 24 features
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        '{framework-package}',        // e.g. 'svelte', 'react', 'vue'
        // Add framework sub-packages as needed
        '@toolbox-web/grid',
        '@toolbox-web/grid/all',
        /^@toolbox-web\/grid/,
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
  test: {
    name: '@toolbox-web/grid-{framework}',
    watch: false,
    globals: true,
    environment: 'jsdom', // or 'happy-dom' — Vue uses happy-dom
    include: ['{src,tests}/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    alias: [
      // Self-referencing aliases for tests
      {
        find: /^@toolbox-web\/grid-{framework}\/features\/(.+)$/,
        replacement: path.join(import.meta.dirname, 'src/features/$1.ts'),
      },
      // Grid dist aliases for tests
      { find: /^@toolbox-web\/grid\/plugins\/(.+)$/, replacement: path.join(gridDistPath, 'lib/plugins/$1/index.js') },
      { find: '@toolbox-web/grid/all', replacement: path.join(gridDistPath, 'all.js') },
      { find: '@toolbox-web/grid', replacement: path.join(gridDistPath, 'index.js') },
    ],
  },
}));
```

### tsconfig.lib.json

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/libs/grid-{framework}",
    "types": ["vite/client"]
    // Add framework-specific compiler options as needed
    // e.g. "jsx": "react-jsx" for React, or "jsx": "preserve" for Vue
  },
  "include": ["src/**/*.ts", "src/**/*.{ext}"],
  // ↑ Add framework extensions: .tsx, .vue, .svelte, etc.
  "exclude": ["src/**/*.spec.ts", "src/**/*.test.ts"],
  "references": [
    { "path": "../grid/tsconfig.lib.json" }
  ]
}
```

## Step 2: Implement the Adapter

### Core Adapter (`{framework}-grid-adapter.ts`)

Start from the React or Vue adapter as a template. The key responsibilities:

1. **Column Registry** — `WeakMap<HTMLElement, ColumnRegistry>` keyed on column elements, with a `Map<string, ColumnRegistry>` field-name fallback (handles framework component re-creation where DOM refs change)

2. **`canHandle()`** — Return `true` when a column element has framework-specific markers. For React/Vue this always returns `true` when the adapter is registered (they check for registered renderers). For Angular, it checks for template refs.

3. **`createRenderer()`** — Look up the renderer function from the column registry, return a `ColumnViewRenderer` that:
   - Mounts the framework component into the cell element
   - Passes `CellRenderContext` (value, row, column, rowIndex, colIndex)
   - Returns the rendered DOM element

4. **`createEditor()`** — Similar to renderer but wraps the framework component with commit/cancel callbacks from `ColumnEditorContext`

5. **`releaseCell()`** — Properly destroy framework component instances attached to a cell. **This is critical for memory leak prevention.**

6. **`unmount()`** — Destroy a framework container (used by MasterDetailPlugin, tool panels, etc.)

### Wrapper Component (`DataGrid.{ext}`)

The main wrapper component should:

- Accept the same props as `<tbw-grid>` (`rows`, `gridConfig`, `columns`, `fitMode`)
- Accept **feature props** (e.g., `selection`, `editing`, `filtering`) — look them up in the feature registry to create plugin instances
- Accept **event props** (e.g., `onCellClick`, `onSelectionChange`) — forward to `addEventListener` on the grid element
- Create the underlying `<tbw-grid>` element and register the adapter on it
- Provide a context/injection mechanism so child components and composables can access the grid element (React: `Context`, Vue: `provide/inject`, Svelte: `setContext/getContext`, etc.)
- Process `GridColumn` child components that register renderers/editors in the column registry

### Composables / Hooks

Implement at minimum:

- **`useGrid()`** — Returns the grid element ref for programmatic API access
- **`useGridEvent(eventName, handler)`** — Type-safe event subscription with automatic cleanup on component destroy

## Step 3: Scaffold the Demo App

### Directory Structure

```
demos/employee-management/{framework}/
├── index.html
├── package.json
├── project.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts                          # App bootstrap
    ├── App.{ext}                        # Main app component
    ├── grid-config.ts                   # Grid configuration (shared across demos)
    └── components/
        ├── renderers/
        │   ├── StatusBadge.{ext}        # Status column renderer
        │   ├── RatingDisplay.{ext}      # Star rating renderer
        │   └── TopPerformerBadge.{ext}  # Top performer icon
        ├── editors/
        │   ├── StatusSelect.{ext}       # Status dropdown editor
        │   ├── StarRating.{ext}         # Star rating editor
        │   ├── BonusSlider.{ext}        # Bonus range slider editor
        │   └── DatePicker.{ext}         # Date picker editor
        └── tool-panels/
            └── ColumnStats.{ext}        # Custom tool panel
```

### project.json

```jsonc
{
  "name": "demo-{framework}",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "projectType": "application",
  "sourceRoot": "demos/employee-management/{framework}",
  "implicitDependencies": ["grid", "grid-{framework}"],
  "targets": {
    "serve": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vite",
        "cwd": "demos/employee-management/{framework}",
        "port": {PORT}
      }
    },
    "serve:dist": {
      "executor": "nx:run-commands",
      "options": {
        "command": "vite",
        "cwd": "demos/employee-management/{framework}",
        "port": {PORT},
        "env": { "USE_DIST": "true" }
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "dependsOn": ["^build"],
      "options": {
        "command": "vite build",
        "cwd": "demos/employee-management/{framework}"
      }
    },
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["demos/employee-management/{framework}/**/*.{ts,{ext}}"]
      }
    }
  }
}
```

**Port assignment**: Existing ports are vanilla=4000, vue=4100, angular=4200, react=4300. Pick the next available (e.g., 4400 for Svelte, 4500 for Solid).

### vite.config.ts

```typescript
import frameworkPlugin from '{framework-vite-plugin}';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { getResolveAliases } from '../shared/resolve-aliases';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [frameworkPlugin()],
  resolve: {
    alias: getResolveAliases(__dirname, { include{Framework}: true }),
  },
  server: {
    port: {PORT},
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../../../dist/demos/employee-management/{framework}'),
    emptyOutDir: true,
  },
});
```

### Demo Requirements (Parity)

The demo **must** look and behave identically to the vanilla, React, Angular, and Vue demos. Specifically:

1. **Same shared data** — Import `Employee` type and `generateEmployees()` from `@demo/shared`
2. **Same shared styles** — Import `@demo/shared/demo-styles.css`
3. **Same shell layout** — Header with title `"Employee Management System ({Framework})"`, matching CSS classes (`.tbw-shell-header`, `.tbw-shell-title`)
4. **Same column configuration** — Same columns, same types, same widths, same order
5. **Same custom renderers** — `StatusBadge` (colored badge), `RatingDisplay` (stars), `TopPerformerBadge` (star icon). Use the **same CSS classes** as other demos (`.status-badge`, `.rating-display`, `.top-performer-star`) so e2e selectors work
6. **Same custom editors** — Status dropdown, star rating, bonus slider, date picker
7. **Same plugins enabled** — Selection, filtering, sorting, editing, master-detail, responsive, etc.
8. **Same master-detail panel** — Employee details with projects and reviews (import shared data structure)
9. **Same tool panel** — Column stats sidebar
10. **Same responsive card layout** — Mobile card view with the same class (`.responsive-employee-card`)

## Step 4: Workspace Wiring

### 4.1: Update `tsconfig.base.json`

Add path mappings for the new adapter:

```jsonc
// In "compilerOptions.paths":
"@toolbox-web/grid-{framework}": ["dist/libs/grid-{framework}/index.d.ts"],
"@toolbox-web/grid-{framework}/features/*": ["dist/libs/grid-{framework}/features/*.d.ts"]
```

### 4.2: Update `resolve-aliases.ts`

Add a new option to `getResolveAliases()` in `demos/employee-management/shared/resolve-aliases.ts`:

```typescript
export function getResolveAliases(
  demoDir: string,
  options: {
    includeReact?: boolean;
    includeAngular?: boolean;
    includeVue?: boolean;
    include{Framework}?: boolean;  // ← Add this
  } = {},
): Alias[] {
```

Then add both dist-mode and source-mode aliases following the exact same pattern as the React/Vue blocks. Source mode should point to `libs/grid-{framework}/src/...`, dist mode to `dist/libs/grid-{framework}/...`.

### 4.3: Update E2E Tests

Add the new demo to the `DEMOS` map in `e2e/tests/utils.ts`:

```typescript
export const DEMOS = {
  vanilla: 'http://localhost:4000',
  react: 'http://localhost:4300',
  angular: 'http://localhost:4200',
  vue: 'http://localhost:4100',
  {framework}: 'http://localhost:{PORT}',  // ← Add this
} as const;
```

Also add the framework label to `getExpectedFrameworkLabel()`:

```typescript
case '{framework}':
  return '({Framework})';
```

The e2e tests in `e2e/tests/cross-framework-visual.spec.ts` iterate over all entries in `DEMOS`, so the new demo will automatically be tested for:

- **Visual parity** — Screenshots compared against vanilla baseline
- **Structural verification** — Correct grid structure, header cells, shell title
- **Renderer parity** — Status badges, rating cells, top performer badges
- **Editor parity** — Status select, star rating editors
- **Master-detail** — Expand/collapse detail panels
- **Responsive cards** — Mobile viewport card layout
- **Functional parity** — Sorting, selection, keyboard navigation, column resizing
- **Data consistency** — Same row count, same column headers across all demos

### 4.4: Update `copilot-instructions.md`

Add the new adapter to:

- The "Monorepo Structure" section (new bullet for `libs/grid-{framework}/`)
- The "Framework Adapters" section (new entry with components/hooks/composables)
- The "Path Mappings" section
- The "Key Files Reference" section
- The "Development Commands" section (demo serve command)
- The "Common Pitfalls" section if there are framework-specific gotchas

### 4.5: Update `AGENTS.md`

No changes needed — Nx auto-discovers new projects.

## Step 5: Testing

### Library Unit Tests

- Co-locate test files: `{framework}-grid-adapter.spec.ts`, `composables.spec.ts`, etc.
- Test the adapter in isolation (mock grid element, verify mount/unmount lifecycle)
- Test composables/hooks with framework-specific test utils (e.g., `@testing-library/svelte`, `@vue/test-utils`)
- Run: `bun nx test grid-{framework}`

### Demo Validation

1. **Serve the demo**: `bun nx serve demo-{framework}`
2. **Visual inspection**: Compare side-by-side with vanilla demo at `http://localhost:4000`
3. **Run e2e tests**: `bun nx e2e e2e` (requires all demo servers running)
4. **Check all test categories pass** for the new framework entry

### Build Validation

```bash
bun nx build grid-{framework}
bun nx build demo-{framework}
```

Verify the dist output structure matches React/Vue:
```
dist/libs/grid-{framework}/
├── index.js
├── index.d.ts
├── features/
│   ├── index.js
│   ├── index.d.ts
│   ├── selection.js
│   ├── selection.d.ts
│   └── ...
└── chunks/
    └── ...
```

## Step 6: Documentation

1. **`libs/grid-{framework}/README.md`** — Installation, quick start, API reference
2. **`demos/employee-management/{framework}/README.md`** — How to run the demo
3. **TypeDoc config** — `libs/grid-{framework}/typedoc.json` following existing pattern
4. **Update `llms.txt`** and **`llms-full.txt`** — Add the new adapter to the library listing
5. **Docs site** (optional) — The Astro docs site already covers the grid; framework-specific demo pages can be added to `apps/docs/`

## Checklist

### Library
- [ ] `libs/grid-{framework}/` created with all config files
- [ ] `FrameworkAdapter` implemented (`canHandle`, `createRenderer`, `createEditor`, `releaseCell`, `unmount`)
- [ ] Wrapper component created with props, events, and child component support
- [ ] `useGrid()` and `useGridEvent()` composables/hooks implemented
- [ ] Feature registry + all 24 feature modules created
- [ ] `GridColumn`, `GridDetailPanel`, `GridToolPanel`, `GridToolButtons`, `GridResponsiveCard` components created
- [ ] Type-level defaults support (type registry) implemented
- [ ] `src/index.ts` exports all public API
- [ ] Unit tests written and passing

### Demo
- [ ] `demos/employee-management/{framework}/` created
- [ ] Uses `@demo/shared` types and `generateEmployees()` data
- [ ] Uses `@demo/shared/demo-styles.css`
- [ ] Shell header shows `"Employee Management System ({Framework})"`
- [ ] Same columns, renderers, editors as other demos
- [ ] Same CSS classes for e2e selector compatibility (`.status-badge`, `.rating-display`, `.top-performer-star`, `.responsive-employee-card`)
- [ ] Master-detail panel with projects + reviews
- [ ] Tool panel with column stats
- [ ] Responsive card layout
- [ ] `project.json` with serve, serve:dist, build, lint targets

### Workspace Integration
- [ ] `tsconfig.base.json` paths added
- [ ] `resolve-aliases.ts` updated with `include{Framework}` option
- [ ] `e2e/tests/utils.ts` DEMOS map updated
- [ ] `e2e/tests/utils.ts` `getExpectedFrameworkLabel()` updated
- [ ] `copilot-instructions.md` updated
- [ ] All e2e parity tests passing for new demo
- [ ] `bun nx build grid-{framework}` succeeds
- [ ] `bun nx test grid-{framework}` passes
- [ ] `bun nx lint grid-{framework}` passes
````

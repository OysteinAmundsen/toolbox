---
name: astro-demo
description: Create Astro demo components and MDX docs for a grid feature or plugin. Scaffolds .astro demo files following project conventions.
argument-hint: <feature-or-plugin-name>
---

# Create an Astro Demo Component

Scaffold an Astro demo component (`.astro`) for either a grid core feature or a grid plugin, and wire it into an MDX documentation page. The same scaffolding steps, templates, e2e test structure, and naming rules apply to both — the only differences are the target file paths (see the **File Locations** section below: `demos/<feature-name>/` vs `demos/<plugin-name>/`, and `content/docs/grid/<page>.mdx` vs `content/docs/grid/plugins/<plugin>.mdx`).

## Quick Reference

This skill is organized into the following sections — jump to the one you need rather than reading top to bottom:

| Section                             | When you need it                                            |
| ----------------------------------- | ----------------------------------------------------------- |
| **File Locations**                  | Where to put the `.astro` and `.mdx` files                  |
| **Demo Component Template**         | Minimal demo without controls                               |
| **Demo with DemoControls Template** | Interactive demo with toggleable options                    |
| **Wiring Demo into MDX Page**       | Hooking the `.astro` into an MDX page                       |
| **DemoControls API**                | Control types, `ControlDef` shape, event payload            |
| **Key Conventions**                 | Per-demo rules (unique IDs, scoped scripts/styles, imports) |
| **Naming Conventions**              | File, container ID, and directory naming rules              |
| **E2E Test for the Demo**           | Required Playwright test scaffold and checklist             |
| **Verifying**                       | Build, serve, and e2e commands                              |

## File Locations

- **Plugin demos**: `apps/docs/src/components/demos/<plugin-name>/<PluginNameDemoVariant>.astro`
- **Core feature demos**: `apps/docs/src/components/demos/<feature-name>/<FeatureNameDemo>.astro`
- **MDX content pages**: `apps/docs/src/content/docs/grid/plugins/<plugin-name>.mdx`
- **Core MDX pages**: `apps/docs/src/content/docs/grid/<page-name>.mdx`
- **Reusable components**: `apps/docs/src/components/` (DemoControls, ShowSource, etc.)
- **Framework code tabs**: use Starlight's `<Tabs syncKey="framework">` + `<TabItem>` from `@astrojs/starlight/components` (page-wide synced selection)

## Demo Component Template (`.astro`)

```astro
---
// No frontmatter needed for demo components (they are imported by MDX pages)
---

<div id="my-feature-demo">
  <tbw-grid></tbw-grid>
</div>

<script>
  import { createGrid } from '@toolbox-web/grid';
  import { MyPlugin } from '@toolbox-web/grid/plugins/my-plugin';

  const container = document.getElementById('my-feature-demo');
  const grid = container?.querySelector('tbw-grid');
  if (!grid) throw new Error('Grid not found');

  const sampleData = [
    { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
    { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', department: 'Sales' },
  ];

  grid.gridConfig = {
    columns: [
      { field: 'id', header: 'ID', width: 60 },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'department', header: 'Department' },
    ],
    plugins: [new MyPlugin()],
  };
  grid.rows = sampleData;
</script>

<style>
  #my-feature-demo tbw-grid {
    height: 300px;
  }
</style>
```

## Demo with DemoControls Template

For interactive demos with configurable options:

```astro
---
import DemoControls from '@components/DemoControls.astro';
import type { ControlDef } from '@components/DemoControls.astro';

const controls: ControlDef[] = [
  { name: 'optionA', label: 'Option A', type: 'boolean', default: false, description: 'Toggle feature A' },
  { name: 'optionB', label: 'Option B', type: 'number', default: 200, min: 0, max: 1000, step: 50, description: 'Numeric value for B' },
  { name: 'mode', label: 'Mode', type: 'select', default: 'auto', options: ['auto', 'manual', 'hybrid'], description: 'Select operating mode' },
];
---

<div id="my-feature-controls-demo">
  <DemoControls controls={controls} />
  <tbw-grid></tbw-grid>
</div>

<script>
  import { createGrid } from '@toolbox-web/grid';
  import { MyPlugin } from '@toolbox-web/grid/plugins/my-plugin';

  const container = document.getElementById('my-feature-controls-demo');
  const grid = container?.querySelector('tbw-grid');
  if (!grid) throw new Error('Grid not found');

  const sampleData = [
    { id: 1, name: 'Alice', department: 'Engineering' },
    { id: 2, name: 'Bob', department: 'Marketing' },
    { id: 3, name: 'Charlie', department: 'Sales' },
  ];

  function buildGrid(values: Record<string, unknown>) {
    grid!.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 60 },
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
      ],
      plugins: [
        new MyPlugin({
          optionA: values.optionA as boolean,
          optionB: values.optionB as number,
          mode: values.mode as string,
        }),
      ],
    };
    grid!.rows = sampleData;
  }

  // Initial build with defaults
  buildGrid({ optionA: false, optionB: 200, mode: 'auto' });

  // Listen for control changes
  container?.addEventListener('control-change', ((e: CustomEvent) => {
    buildGrid(e.detail.allValues);
  }) as EventListener);
</script>

<style>
  #my-feature-controls-demo tbw-grid {
    height: 300px;
  }
</style>
```

## Wiring Demo into MDX Page

In the MDX content page, import and use the demo:

```mdx
---
title: Plugin Name
description: One-line description of what this plugin does.
---

import PluginDefaultDemo from '@components/demos/plugin-name/PluginNameDefaultDemo.astro';
import PluginAdvancedDemo from '@components/demos/plugin-name/PluginNameAdvancedDemo.astro';
import ShowSource from '@components/ShowSource.astro';

## Basic Usage

<ShowSource component="plugin-name/PluginNameDefaultDemo">
  <PluginDefaultDemo />
</ShowSource>

## Advanced Usage

<ShowSource component="plugin-name/PluginNameAdvancedDemo">
  <PluginAdvancedDemo />
</ShowSource>
```

## DemoControls API

The `DemoControls.astro` component provides interactive Storybook-like controls:

### Control Types

| Type          | Renders             | Value Type | Extra Props          |
| ------------- | ------------------- | ---------- | -------------------- |
| `number`      | Range slider        | `number`   | `min`, `max`, `step` |
| `boolean`     | Checkbox            | `boolean`  | —                    |
| `radio`       | Radio buttons       | `string`   | `options: string[]`  |
| `select`      | Dropdown            | `string`   | `options: string[]`  |
| `check-group` | Multiple checkboxes | `string[]` | `options: string[]`  |

### ControlDef Interface

```typescript
interface ControlDef {
  name: string; // Unique identifier
  label: string; // Display label
  type: 'number' | 'boolean' | 'radio' | 'select' | 'check-group';
  default: unknown; // Default value (shown with badge)
  description?: string; // Tooltip/help text
  section?: string; // Group controls under a section header
  options?: string[]; // For radio, select, check-group types
  min?: number; // For number type
  max?: number; // For number type
  step?: number; // For number type
}
```

### Event Handling

DemoControls emits `control-change` CustomEvent on the parent container:

```typescript
container.addEventListener('control-change', ((e: CustomEvent) => {
  const { name, value, allValues } = e.detail;
  // name: string — which control changed
  // value: unknown — new value of that control
  // allValues: Record<string, unknown> — all current control values
}) as EventListener);
```

## Key Conventions

1. **Unique container IDs**: Every demo needs a unique `id` on its root `<div>` — scripts use this to scope DOM queries
2. **Self-contained scripts**: Each demo's `<script>` imports its own dependencies and sets up the grid independently
3. **Scoped styles**: Use the container ID to scope CSS (e.g., `#my-demo tbw-grid { height: 300px; }`)
4. **No shared state**: Demos on the same page must not interfere with each other
5. **Use `@components/` alias**: Import shared components from `@components/` (e.g., `import DemoControls from '@components/DemoControls.astro'`)
6. **ShowSource wrapper**: Always wrap demos in `<ShowSource component="path">` to provide a "View Source" button
7. **Import `@toolbox-web/grid` not `../../index`**: Demos import from the package path, not relative source paths
8. **Docs site runs on port 4401**: `bun nx serve docs`

## Naming Conventions

- Demo files: `<PluginName><Variant>Demo.astro` (PascalCase)
  - Default demo: `FilteringDefaultDemo.astro`
  - Variant demo: `FilteringCustomPanelDemo.astro`
- Container IDs: `<plugin-name>-<variant>-demo` (kebab-case)
  - Default: `filtering-default-demo`
  - Variant: `filtering-custom-panel-demo`
- Demo directories match plugin names: `demos/filtering/`, `demos/selection/`, etc.

## E2E Test for the Demo

Every demo **must** have a corresponding e2e test in `apps/docs-e2e/tests/`. The test should verify the demo renders and that the feature it advertises actually works.

### Where to add the test

- If a test file for the feature already exists (e.g., `selection.spec.ts`), add tests there
- If not, create a new file: `apps/docs-e2e/tests/<feature>.spec.ts`

### What to test

Go beyond "it renders". Test the **behavior the demo demonstrates**. Work through this checklist in order; skip a step only when it does not apply to the demo:

- [ ] **Step 1 — Rendering** (always required): grid is visible, correct number of rows/headers.
- [ ] **Step 2 — Core interaction** (always required): simulate the user action the demo advertises (click, drag, type, sort, filter).
- [ ] **Step 3 — Outcome** (always required): verify the visible result (selected cells, sorted order, filtered rows, edited values).
- [ ] **Step 4 — Events** (only if demo exposes `[data-event-log]` or `[data-output-id]`): verify the output element updates.
- [ ] **Step 5 — Controls** (only if demo uses `DemoControls`): switch options and verify the grid responds.

### Template

```typescript
import { expect, test } from '@playwright/test';
import { openDemo, clickCell, dataRows, cellText, grid } from './utils';

test.describe('Feature Demos', () => {
  test('MyFeatureDemo — describes what is being verified', async ({ page }) => {
    await openDemo(page, 'MyFeatureDemo');

    // Verify rendering
    await expect(grid(page)).toBeVisible();
    expect(await dataRows(page).count()).toBeGreaterThan(0);

    // Simulate the feature interaction
    await clickCell(page, 0, 1);
    await page.waitForTimeout(200);

    // Assert the expected outcome
    const result = await cellText(page, 0, 1);
    expect(result).toBe('expected value');
  });
});
```

### Run the e2e tests

```bash
bun nx e2e docs-e2e
```

> See the `e2e-testing` instruction file (auto-applied when editing `e2e/` or `apps/docs-e2e/` files) for the full utility reference, selector conventions, and wait strategies.

## Verifying

```bash
# Build docs site (catches broken imports, missing components, MDX errors)
bun nx build docs

# Start dev server to visually verify
bun nx serve docs
# Navigate to http://localhost:4401/grid/plugins/<plugin-name>/

# Run e2e tests for the demo
bun nx e2e docs-e2e
```

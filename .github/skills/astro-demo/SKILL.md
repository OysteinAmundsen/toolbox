---
name: astro-demo
description: Create Astro demo components and MDX docs for a grid feature or plugin. Scaffolds .astro demo files following project conventions.
argument-hint: <feature-or-plugin-name>
---

# Create an Astro Demo Component

Scaffold an Astro demo component (`.astro`) for a grid feature or plugin, and wire it into an MDX documentation page.

## File Locations

- **Plugin demos**: `apps/docs/src/components/demos/<plugin-name>/<PluginNameDemoVariant>.astro`
- **Core feature demos**: `apps/docs/src/components/demos/<feature-name>/<FeatureNameDemo>.astro`
- **MDX content pages**: `apps/docs/src/content/docs/grid/plugins/<plugin-name>.mdx`
- **Core MDX pages**: `apps/docs/src/content/docs/grid/<page-name>.mdx`
- **Reusable components**: `apps/docs/src/components/` (DemoControls, ShowSource, FrameworkTabs, etc.)

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

## Verifying

```bash
# Build docs site (catches broken imports, missing components, MDX errors)
bun nx build docs

# Start dev server to visually verify
bun nx serve docs
# Navigate to http://localhost:4401/grid/plugins/<plugin-name>/
```

---
name: storybook-story
description: Create a Storybook story and MDX documentation for a grid feature or plugin. Scaffolds stories.ts and .mdx files following project conventions.
argument-hint: <feature-or-plugin-name>
---

# Create a Storybook Story

Scaffold a Storybook story (`.stories.ts`) and MDX documentation (`.mdx`) for a grid feature or plugin.

## File Locations

- **Core grid stories**: `libs/grid/src/lib/core/*.stories.ts`
- **Plugin stories**: `libs/grid/src/lib/plugins/<plugin-name>/<plugin-name>.stories.ts`
- **Plugin MDX docs**: `libs/grid/src/lib/plugins/<plugin-name>/<plugin-name>.mdx`
- **High-level docs**: `libs/grid/docs/*.mdx`
- **Demo stories**: `demos/employee-management/employee-management.stories.ts`

## Story File Template (`.stories.ts`)

Stories use **Lit** for web component rendering:

```typescript
import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';

// Import live source for HMR (not dist)
import '../../index';

// Import plugins if needed
import { MyPlugin } from './index';

interface StoryArgs {
  rows: unknown[];
  // Add story-specific args
}

const meta: Meta<StoryArgs> = {
  title: 'Plugins/MyPlugin', // or 'Grid/FeatureName'
  tags: ['autodocs'],
  argTypes: {
    // Define controls for the story
  },
  render: (args) => {
    const grid = document.createElement('tbw-grid') as any;
    grid.rows = args.rows;
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', width: 60 },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email' },
      ],
      plugins: [new MyPlugin()],
    };
    return grid;
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

/**
 * Basic usage of MyPlugin.
 */
export const Basic: Story = {
  args: {
    rows: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com' },
    ],
  },
};

/**
 * Advanced configuration demonstrating all options.
 */
export const Advanced: Story = {
  args: {
    rows: [
      /* ... */
    ],
  },
  render: (args) => {
    // Custom render for advanced scenarios
    return html`<tbw-grid></tbw-grid>`;
  },
};
```

## MDX Documentation Template (`.mdx`)

````mdx
import { Meta, Canvas, Controls, Source } from '@storybook/addon-docs/blocks';
import * as Stories from './<plugin-name>.stories';

<Meta of={Stories} />

# Plugin Name

Brief description of what this plugin does.

## Installation

```typescript
import { MyPlugin } from '@toolbox-web/grid/plugins/my-plugin';
```
````

## Basic Usage

<Canvas of={Stories.Basic} />

## Configuration

<Controls of={Stories.Basic} />

### Options

| Option    | Type      | Default | Description             |
| --------- | --------- | ------- | ----------------------- |
| `optionA` | `boolean` | `false` | Description of option A |

## Advanced Usage

<Canvas of={Stories.Advanced} />

## API

### Events

| Event      | Detail Type         | Description   |
| ---------- | ------------------- | ------------- |
| `my-event` | `{ value: string }` | Fired when... |

### Methods

| Method          | Returns | Description    |
| --------------- | ------- | -------------- |
| `doSomething()` | `void`  | Does something |

````

## Key Conventions

1. **Import live source** (`../../index` or `../src/index`) for HMR — not from `dist/`
2. **Use `tags: ['autodocs']`** on meta for auto-generated docs pages
3. **Add JSDoc comments** above each story export — they appear in docs
4. **Use `html` from Lit** for template rendering in render functions
5. **Create the grid element programmatically** when you need to set JS properties (rows, gridConfig)
6. **Story titles** follow hierarchy: `Grid/Feature` or `Plugins/PluginName`
7. **Storybook runs on port 4400**: `bun nx serve docs`

## MDX Doc Blocks Reference

| Block | Usage |
|---|---|
| `<Canvas of={Story} />` | Renders story with source code panel |
| `<Controls of={Story} />` | Interactive prop controls |
| `<ArgTypes of={Stories} />` | Auto-generated prop table from JSDoc |
| `<Source code={...} />` | Syntax-highlighted code block |

Import from `@storybook/addon-docs/blocks`.

## Verifying

```bash
# Start Storybook locally
bun nx serve docs

# Build Storybook (catches errors)
bun nx build docs
```

Navigate to your story in the sidebar to verify rendering and docs.
````

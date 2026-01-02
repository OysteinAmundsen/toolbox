import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { SelectionPlugin } from './SelectionPlugin';
import type { SelectionMode } from './types';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Selection',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Selection plugin enables cell, row, and range selection with full keyboard support.

**Selection Modes:**
- \`cell\` - Single cell selection (click to select one cell)
- \`row\` - Row selection (click any cell to select the entire row)
- \`range\` - Range selection (shift+click or drag to select rectangles)

**Keyboard Shortcuts:**
- \`Escape\` - Clear selection
- \`Ctrl+A\` (range mode) - Select all cells
- \`Shift+Click\` - Extend selection
- Arrow keys - Navigate and extend selection with Shift held
        `,
      },
    },
  },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['cell', 'row', 'range'],
      description: 'Selection mode determines what gets selected on click',
      table: { category: 'Selection', type: { summary: 'SelectionMode' } },
    },
  },
  args: {
    mode: 'cell',
  },
};
export default meta;

interface SelectionArgs {
  mode: SelectionMode;
}
type Story = StoryObj<SelectionArgs>;

// Sample data for all selection stories
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, email: 'alice@example.com' },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, email: 'bob@example.com' },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, email: 'carol@example.com' },
  { id: 4, name: 'Dan', department: 'Sales', salary: 85000, email: 'dan@example.com' },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, email: 'eve@example.com' },
  { id: 6, name: 'Frank', department: 'Engineering', salary: 98000, email: 'frank@example.com' },
  { id: 7, name: 'Grace', department: 'Sales', salary: 88000, email: 'grace@example.com' },
  { id: 8, name: 'Henry', department: 'HR', salary: 65000, email: 'henry@example.com' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
  { field: 'email', header: 'Email' },
];

/**
 * Interactive selection demo with mode switcher. Use the controls to switch
 * between cell, row, and range selection modes.
 */
export const Default: Story = {
  args: {
    mode: 'cell',
  },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [new SelectionPlugin({ mode: 'cell' })],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: SelectionArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    grid.style.display = 'block';

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: args.mode })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Cell selection mode - click to select individual cells.
 * The focused cell is highlighted.
 */
export const CellMode: Story = {
  args: { mode: 'cell' },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 300px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [new SelectionPlugin({ mode: 'cell' })],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';
    grid.style.display = 'block';

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'cell' })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Row selection mode - clicking any cell selects the entire row.
 * The selected row is highlighted with a border.
 */
export const RowMode: Story = {
  args: { mode: 'row' },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 300px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [new SelectionPlugin({ mode: 'row' })],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';
    grid.style.display = 'block';

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'row' })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Range selection mode - shift+click or click-and-drag to select
 * rectangular regions of cells.
 */
export const RangeMode: Story = {
  args: { mode: 'range' },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 300px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [new SelectionPlugin({ mode: 'range' })],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';
    grid.style.display = 'block';

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'range' })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

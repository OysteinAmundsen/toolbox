import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { UndoRedoPlugin } from './UndoRedoPlugin';

// Import grid component
import '../../../index';

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name', editable: true },
  { field: 'quantity', header: 'Quantity', type: 'number' as const, editable: true },
  { field: 'price', header: 'Price', type: 'number' as const, editable: true },
];

const sampleData = [
  { id: 1, name: 'Widget A', quantity: 10, price: 25.99 },
  { id: 2, name: 'Widget B', quantity: 5, price: 49.99 },
  { id: 3, name: 'Widget C', quantity: 20, price: 15.0 },
];

const meta: Meta = {
  title: 'Grid/Plugins/Undo-Redo',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    maxHistorySize: {
      control: { type: 'range', min: 10, max: 200, step: 10 },
      description: 'Maximum actions in history',
      table: { category: 'Undo/Redo', defaultValue: { summary: '100' } },
    },
  },
  args: {
    maxHistorySize: 100,
  },
};
export default meta;

interface UndoRedoArgs {
  maxHistorySize: number;
}
type Story = StoryObj<UndoRedoArgs>;

/**
 * Double-click to edit cells, then use Ctrl+Z to undo and Ctrl+Y to redo.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name', editable: true },
    { field: 'quantity', header: 'Quantity', type: 'number', editable: true },
    { field: 'price', header: 'Price', type: 'number', editable: true },
  ],
  plugins: [
    new UndoRedoPlugin({
      maxHistorySize: 100,
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Widget A', quantity: 10, price: 25.99 },
  { id: 2, name: 'Widget B', quantity: 5, price: 49.99 },
  { id: 3, name: 'Widget C', quantity: 20, price: 15.00 },
];

// Double-click to edit, Ctrl+Z to undo, Ctrl+Y to redo
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: UndoRedoArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new UndoRedoPlugin({
          maxHistorySize: args.maxHistorySize,
        }),
      ],
    };
    grid.rows = [...sampleData];

    return grid;
  },
};

/**
 * Limited history (20 actions max).
 */
export const LimitedHistory: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name', editable: true },
    { field: 'quantity', header: 'Quantity', type: 'number', editable: true },
    { field: 'price', header: 'Price', type: 'number', editable: true },
  ],
  plugins: [
    new UndoRedoPlugin({
      maxHistorySize: 20, // Limit history to 20 actions
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Widget A', quantity: 10, price: 25.99 },
  { id: 2, name: 'Widget B', quantity: 5, price: 49.99 },
  { id: 3, name: 'Widget C', quantity: 20, price: 15.00 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    maxHistorySize: 20,
  },
  render: (args: UndoRedoArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new UndoRedoPlugin({
          maxHistorySize: args.maxHistorySize,
        }),
      ],
    };
    grid.rows = [...sampleData];

    return grid;
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { ReorderPlugin } from './ReorderPlugin';

// Import grid component
import '../../../index';

// Sample data for reorder demos
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', salary: 105000 },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'email', header: 'Email' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
];

const meta: Meta = {
  title: 'Grid/Plugins/Reorder',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: { type: 'boolean' },
      description: 'Animate column movement',
      table: { category: 'Reorder', defaultValue: { summary: 'true' } },
    },
    animationDuration: {
      control: { type: 'range', min: 0, max: 500, step: 50 },
      description: 'Animation duration in milliseconds',
      table: { category: 'Reorder', defaultValue: { summary: '200' } },
    },
  },
  args: {
    animation: true,
    animationDuration: 200,
  },
};
export default meta;

interface ReorderArgs {
  animation: boolean;
  animationDuration: number;
}
type Story = StoryObj<ReorderArgs>;

/**
 * Drag column headers to reorder columns. A visual indicator shows where
 * the column will be placed.
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
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'email', header: 'Email' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new ReorderPlugin({
      animation: true,
      animationDuration: 200,
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', salary: 105000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: ReorderArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new ReorderPlugin({
          animation: args.animation,
          animationDuration: args.animationDuration,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Instant column movement without animation.
 */
export const NoAnimation: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'email', header: 'Email' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new ReorderPlugin({
      animation: false, // Instant reorder
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', salary: 105000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    animation: false,
    animationDuration: 0,
  },
  render: (args: ReorderArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new ReorderPlugin({
          animation: args.animation,
          animationDuration: args.animationDuration,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

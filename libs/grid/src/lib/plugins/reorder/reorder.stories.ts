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

/** Generate code snippet for reorder */
function generateReorderCode(): string {
  return `<!-- HTML -->
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
  plugins: [new ReorderPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', salary: 105000 },
];
</script>`;
}

const meta: Meta = {
  title: 'Grid/Plugins/Reorder',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * Drag column headers to reorder columns. A visual indicator shows where
 * the column will be placed.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        transform: () => generateReorderCode(),
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [new ReorderPlugin()],
    };
    grid.rows = sampleData;

    return grid;
  },
};

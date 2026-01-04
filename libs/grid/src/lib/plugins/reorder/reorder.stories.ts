import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { ReorderPlugin } from './ReorderPlugin';
import type { ReorderAnimation } from './types';

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

interface ReorderArgs {
  animation: ReorderAnimation;
  animationDuration: number;
}

/** Generate code snippet for reorder */
function generateReorderCode(args: ReorderArgs): string {
  const animationStr = args.animation === false ? 'false' : `'${args.animation}'`;
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
  plugins: [new ReorderPlugin({ animation: ${animationStr}, animationDuration: ${args.animationDuration} })],
};

grid.rows = [...];
</script>`;
}

const meta: Meta<ReorderArgs> = {
  title: 'Grid/Plugins/Reorder',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: 'select',
      options: [false, 'flip', 'fade'],
      description: 'Animation type for column reordering',
      table: { defaultValue: { summary: "'flip'" } },
    },
    animationDuration: {
      control: { type: 'range', min: 0, max: 1000, step: 50 },
      description: 'Animation duration in milliseconds (FLIP only)',
      table: { defaultValue: { summary: '200' } },
    },
  },
  args: {
    animation: 'flip',
    animationDuration: 200,
  },
};
export default meta;

type Story = StoryObj<ReorderArgs>;

/**
 * Drag column headers to reorder columns. A visual indicator shows where
 * the column will be placed.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        transform: (_code: string, ctx: { args: ReorderArgs }) => generateReorderCode(ctx.args),
        language: 'html',
      },
    },
  },
  render: (args) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [new ReorderPlugin({ animation: args.animation, animationDuration: args.animationDuration })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

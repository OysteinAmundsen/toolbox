import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { MultiSortPlugin } from './MultiSortPlugin';

// Import grid component
import '../../../index';

// Sample data for sorting demos
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, joined: '2023-01-15' },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, joined: '2022-06-20' },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, joined: '2021-03-10' },
  { id: 4, name: 'Dan', department: 'Engineering', salary: 85000, joined: '2023-08-05' },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, joined: '2024-01-12' },
  { id: 6, name: 'Frank', department: 'Sales', salary: 82000, joined: '2022-11-30' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const, sortable: true },
  { field: 'name', header: 'Name', sortable: true },
  { field: 'department', header: 'Department', sortable: true },
  { field: 'salary', header: 'Salary', type: 'number' as const, sortable: true },
  { field: 'joined', header: 'Joined', type: 'date' as const, sortable: true },
];

const meta: Meta = {
  title: 'Grid/Plugins/Multi-Sort',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    maxSortColumns: {
      control: { type: 'range', min: 1, max: 5, step: 1 },
      description: 'Maximum number of columns to sort by',
      table: { category: 'Sorting', defaultValue: { summary: '3' } },
    },
    showSortIndex: {
      control: { type: 'boolean' },
      description: 'Show sort order badges (1, 2, 3) on headers',
      table: { category: 'Sorting', defaultValue: { summary: 'true' } },
    },
  },
  args: {
    maxSortColumns: 3,
    showSortIndex: true,
  },
};
export default meta;

interface MultiSortArgs {
  maxSortColumns: number;
  showSortIndex: boolean;
}
type Story = StoryObj<MultiSortArgs>;

/**
 * Hold Shift and click column headers to sort by multiple columns.
 * Sort badges (1, 2, 3) indicate the priority when enabled.
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
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', sortable: true },
    { field: 'name', header: 'Name', sortable: true },
    { field: 'department', header: 'Department', sortable: true },
    { field: 'salary', header: 'Salary', type: 'number', sortable: true },
    { field: 'joined', header: 'Joined', type: 'date', sortable: true },
  ],
  plugins: [
    new MultiSortPlugin({
      maxSortColumns: 3,
      showSortIndex: true,
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, joined: '2023-01-15' },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, joined: '2022-06-20' },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, joined: '2021-03-10' },
  { id: 4, name: 'Dan', department: 'Engineering', salary: 85000, joined: '2023-08-05' },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, joined: '2024-01-12' },
  { id: 6, name: 'Frank', department: 'Sales', salary: 82000, joined: '2022-11-30' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: MultiSortArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MultiSortPlugin({
          maxSortColumns: args.maxSortColumns,
          showSortIndex: args.showSortIndex,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Initial sort applied programmatically (Department ASC, Salary DESC).
 */
export const WithInitialSort: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';

const grid = document.querySelector('tbw-grid');
const plugin = new MultiSortPlugin({ maxSortColumns: 3 });

grid.gridConfig = {
  columns: [...],
  plugins: [plugin],
};
grid.rows = [...];

// Apply initial sort after grid is ready
grid.ready().then(() => {
  plugin.setSortModel([
    { field: 'department', direction: 'asc' },
    { field: 'salary', direction: 'desc' },
  ]);
});
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: MultiSortArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    const plugin = new MultiSortPlugin({
      maxSortColumns: args.maxSortColumns,
      showSortIndex: args.showSortIndex,
    });

    grid.gridConfig = {
      columns,
      plugins: [plugin],
    };
    grid.rows = sampleData;

    // Apply initial sort after grid is ready
    grid.ready().then(() => {
      plugin.setSortModel([
        { field: 'department', direction: 'asc' },
        { field: 'salary', direction: 'desc' },
      ]);
    });

    return grid;
  },
};

/**
 * Sort badges hidden - sort order indicated only by arrow direction.
 */
export const NoBadges: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [
    new MultiSortPlugin({
      maxSortColumns: 3,
      showSortIndex: false, // Hide sort order badges
    }),
  ],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    maxSortColumns: 3,
    showSortIndex: false,
  },
  render: (args: MultiSortArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MultiSortPlugin({
          maxSortColumns: args.maxSortColumns,
          showSortIndex: args.showSortIndex,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Limit to single column sort (maxSortColumns: 1).
 */
export const SingleColumnOnly: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [
    new MultiSortPlugin({
      maxSortColumns: 1, // Limit to single column sort
    }),
  ],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    maxSortColumns: 1,
    showSortIndex: false,
  },
  render: (args: MultiSortArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MultiSortPlugin({
          maxSortColumns: args.maxSortColumns,
          showSortIndex: args.showSortIndex,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

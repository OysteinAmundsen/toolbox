import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { GroupingRowsPlugin } from './GroupingRowsPlugin';

// Import grid component
import '../../../index';

// Sample data for grouping demos
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000 },
  { id: 4, name: 'Dan', department: 'Sales', salary: 85000 },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000 },
  { id: 6, name: 'Frank', department: 'Engineering', salary: 98000 },
  { id: 7, name: 'Grace', department: 'Sales', salary: 88000 },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
];

const meta: Meta = {
  title: 'Grid/Plugins/Row Grouping',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    defaultExpanded: {
      control: { type: 'boolean' },
      description: 'Whether groups are expanded by default',
      table: { category: 'Row Grouping', defaultValue: { summary: 'false' } },
    },
    showRowCount: {
      control: { type: 'boolean' },
      description: 'Show row count in group headers',
      table: { category: 'Row Grouping', defaultValue: { summary: 'true' } },
    },
    indentWidth: {
      control: { type: 'range', min: 10, max: 40, step: 5 },
      description: 'Indentation width per depth level in pixels',
      table: { category: 'Row Grouping', defaultValue: { summary: '20' } },
    },
  },
  args: {
    defaultExpanded: false,
    showRowCount: true,
    indentWidth: 20,
  },
};
export default meta;

interface GroupingRowsArgs {
  defaultExpanded: boolean;
  showRowCount: boolean;
  indentWidth: number;
}
type Story = StoryObj<GroupingRowsArgs>;

/**
 * Group rows by a field value. Click group headers to expand/collapse.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new GroupingRowsPlugin({
      groupOn: (row) => row.department,
      defaultExpanded: false,
      showRowCount: true,
      indentWidth: 20,
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000 },
  { id: 4, name: 'Dan', department: 'Sales', salary: 85000 },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000 },
  { id: 6, name: 'Frank', department: 'Engineering', salary: 98000 },
  { id: 7, name: 'Grace', department: 'Sales', salary: 88000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: GroupingRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new GroupingRowsPlugin({
          groupOn: (row: { department: string }) => row.department,
          defaultExpanded: args.defaultExpanded,
          showRowCount: args.showRowCount,
          indentWidth: args.indentWidth,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Groups expanded by default.
 */
export const ExpandedByDefault: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new GroupingRowsPlugin({
      groupOn: (row) => row.department,
      defaultExpanded: true, // All groups expanded initially
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000 },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    defaultExpanded: true,
    showRowCount: true,
    indentWidth: 20,
  },
  render: (args: GroupingRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new GroupingRowsPlugin({
          groupOn: (row: { department: string }) => row.department,
          defaultExpanded: args.defaultExpanded,
          showRowCount: args.showRowCount,
          indentWidth: args.indentWidth,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Row count hidden in group headers.
 */
export const NoRowCount: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new GroupingRowsPlugin({
      groupOn: (row) => row.department,
      showRowCount: false, // Hide row count in headers
    }),
  ],
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
  args: {
    defaultExpanded: false,
    showRowCount: false,
    indentWidth: 20,
  },
  render: (args: GroupingRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new GroupingRowsPlugin({
          groupOn: (row: { department: string }) => row.department,
          defaultExpanded: args.defaultExpanded,
          showRowCount: args.showRowCount,
          indentWidth: args.indentWidth,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { GroupingColumnsPlugin } from './GroupingColumnsPlugin';

// Import grid component
import '../../../index';

const sampleData = [
  {
    id: 1,
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice@example.com',
    department: 'Engineering',
    title: 'Senior Engineer',
    salary: 95000,
  },
  {
    id: 2,
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob@example.com',
    department: 'Marketing',
    title: 'Marketing Manager',
    salary: 85000,
  },
  {
    id: 3,
    firstName: 'Carol',
    lastName: 'Williams',
    email: 'carol@example.com',
    department: 'Engineering',
    title: 'Lead Engineer',
    salary: 115000,
  },
];

const meta: Meta = {
  title: 'Grid/Plugins/Column Grouping',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    showGroupBorders: {
      control: { type: 'boolean' },
      description: 'Show borders between column groups',
      table: { category: 'Column Groups', defaultValue: { summary: 'true' } },
    },
  },
  args: {
    showGroupBorders: true,
  },
};
export default meta;

interface GroupingColumnsArgs {
  showGroupBorders: boolean;
}
type Story = StoryObj<GroupingColumnsArgs>;

/**
 * Group related columns under a shared header row. Columns with the same
 * group ID are grouped together.
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
import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'lastName', header: 'Last Name', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'department', header: 'Department', group: { id: 'work', label: 'Work Info' } },
    { field: 'title', header: 'Title', group: { id: 'work', label: 'Work Info' } },
    { field: 'salary', header: 'Salary', type: 'number', group: { id: 'work', label: 'Work Info' } },
  ],
  plugins: [new GroupingColumnsPlugin({ showGroupBorders: true })],
};

grid.rows = [
  { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', department: 'Engineering', title: 'Senior Engineer', salary: 95000 },
  { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', department: 'Marketing', title: 'Marketing Manager', salary: 85000 },
  { id: 3, firstName: 'Carol', lastName: 'Williams', email: 'carol@example.com', department: 'Engineering', title: 'Lead Engineer', salary: 115000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: GroupingColumnsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'lastName', header: 'Last Name', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'department', header: 'Department', group: { id: 'work', label: 'Work Info' } },
        { field: 'title', header: 'Title', group: { id: 'work', label: 'Work Info' } },
        { field: 'salary', header: 'Salary', type: 'number', group: { id: 'work', label: 'Work Info' } },
      ],
      plugins: [new GroupingColumnsPlugin({ showGroupBorders: args.showGroupBorders })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Groups without visible borders.
 */
export const NoBorders: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'lastName', header: 'Last Name', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal Info' } },
    { field: 'department', header: 'Department', group: { id: 'work', label: 'Work Info' } },
    { field: 'title', header: 'Title', group: { id: 'work', label: 'Work Info' } },
    { field: 'salary', header: 'Salary', type: 'number', group: { id: 'work', label: 'Work Info' } },
  ],
  plugins: [new GroupingColumnsPlugin({ showGroupBorders: false })],
};

grid.rows = [
  { id: 1, firstName: 'Alice', lastName: 'Johnson', email: 'alice@example.com', department: 'Engineering', title: 'Senior Engineer', salary: 95000 },
  { id: 2, firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com', department: 'Marketing', title: 'Marketing Manager', salary: 85000 },
  { id: 3, firstName: 'Carol', lastName: 'Williams', email: 'carol@example.com', department: 'Engineering', title: 'Lead Engineer', salary: 115000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    showGroupBorders: false,
  },
  render: (args: GroupingColumnsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'lastName', header: 'Last Name', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal Info' } },
        { field: 'department', header: 'Department', group: { id: 'work', label: 'Work Info' } },
        { field: 'title', header: 'Title', group: { id: 'work', label: 'Work Info' } },
        { field: 'salary', header: 'Salary', type: 'number', group: { id: 'work', label: 'Work Info' } },
      ],
      plugins: [new GroupingColumnsPlugin({ showGroupBorders: args.showGroupBorders })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { VisibilityPlugin } from './VisibilityPlugin';

// Import grid component
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Visibility',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * Click the ☰ button in the top-right corner to open the visibility panel.
 * Toggle checkboxes to show/hide columns.
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
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', lockVisible: true },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email', hidden: true }, // Hidden by default
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [new VisibilityPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering', salary: 105000 },
  { id: 4, name: 'David', email: 'david@example.com', department: 'Sales', salary: 65000 },
  { id: 5, name: 'Eve', email: 'eve@example.com', department: 'HR', salary: 70000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', lockVisible: true },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email', hidden: true },
        { field: 'department', header: 'Department' },
        { field: 'salary', header: 'Salary', type: 'number' },
      ],
      plugins: [new VisibilityPlugin()],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', salary: 95000 },
      { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing', salary: 75000 },
      { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering', salary: 105000 },
      { id: 4, name: 'David', email: 'david@example.com', department: 'Sales', salary: 65000 },
      { id: 5, name: 'Eve', email: 'eve@example.com', department: 'HR', salary: 70000 },
    ];

    return grid;
  },
};

/**
 * Some columns cannot be hidden using `lockVisible: true`.
 */
export const LockedColumns: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', lockVisible: true },
    { field: 'name', header: 'Name', lockVisible: true },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [new VisibilityPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', salary: 95000 },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing', salary: 75000 },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering', salary: 105000 },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', lockVisible: true },
        { field: 'name', header: 'Name', lockVisible: true },
        { field: 'email', header: 'Email' },
        { field: 'department', header: 'Department' },
        { field: 'salary', header: 'Salary', type: 'number' },
      ],
      plugins: [new VisibilityPlugin()],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', salary: 95000 },
      { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing', salary: 75000 },
      { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering', salary: 105000 },
    ];

    return grid;
  },
};

/**
 * Columns hidden by default using `hidden: true`.
 */
export const InitiallyHidden: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email', hidden: true },
    { field: 'phone', header: 'Phone', hidden: true },
    { field: 'department', header: 'Department' },
  ],
  plugins: [new VisibilityPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', phone: '555-0101', department: 'Engineering' },
  { id: 2, name: 'Bob', email: 'bob@example.com', phone: '555-0102', department: 'Marketing' },
  { id: 3, name: 'Carol', email: 'carol@example.com', phone: '555-0103', department: 'Engineering' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' },
        { field: 'name', header: 'Name' },
        { field: 'email', header: 'Email', hidden: true },
        { field: 'phone', header: 'Phone', hidden: true },
        { field: 'department', header: 'Department' },
      ],
      plugins: [new VisibilityPlugin()],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com', phone: '555-0101', department: 'Engineering' },
      { id: 2, name: 'Bob', email: 'bob@example.com', phone: '555-0102', department: 'Marketing' },
      { id: 3, name: 'Carol', email: 'carol@example.com', phone: '555-0103', department: 'Engineering' },
    ];

    return grid;
  },
};

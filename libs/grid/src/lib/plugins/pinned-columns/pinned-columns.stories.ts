import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { PinnedColumnsPlugin } from './PinnedColumnsPlugin';

// Import grid component
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Pinned Columns',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * Pin columns to the left or right side of the grid. Scroll horizontally
 * to see pinned columns stay fixed in place.
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
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
    { field: 'name', header: 'Name', width: 150, sticky: 'left' },
    { field: 'email', header: 'Email', width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'phone', header: 'Phone', width: 150 },
    { field: 'address', header: 'Address', width: 250 },
    { field: 'city', header: 'City', width: 120 },
    { field: 'country', header: 'Country', width: 120 },
    { field: 'actions', header: 'Actions', width: 100, sticky: 'right' },
  ],
  fitMode: 'fixed',
  plugins: [new PinnedColumnsPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', phone: '+1-555-0101', address: '123 Main St', city: 'New York', country: 'USA', actions: '...' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', phone: '+1-555-0102', address: '456 Oak Ave', city: 'Los Angeles', country: 'USA', actions: '...' },
  { id: 3, name: 'Carol Williams', email: 'carol@example.com', department: 'Sales', phone: '+1-555-0103', address: '789 Pine Rd', city: 'Chicago', country: 'USA', actions: '...' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
        { field: 'name', header: 'Name', width: 150, sticky: 'left' },
        { field: 'email', header: 'Email', width: 200 },
        { field: 'department', header: 'Department', width: 150 },
        { field: 'phone', header: 'Phone', width: 150 },
        { field: 'address', header: 'Address', width: 250 },
        { field: 'city', header: 'City', width: 120 },
        { field: 'country', header: 'Country', width: 120 },
        { field: 'actions', header: 'Actions', width: 100, sticky: 'right' },
      ],
      fitMode: 'fixed',
      plugins: [new PinnedColumnsPlugin()],
    };

    grid.rows = [
      {
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        department: 'Engineering',
        phone: '+1-555-0101',
        address: '123 Main St',
        city: 'New York',
        country: 'USA',
        actions: '...',
      },
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@example.com',
        department: 'Marketing',
        phone: '+1-555-0102',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        country: 'USA',
        actions: '...',
      },
      {
        id: 3,
        name: 'Carol Williams',
        email: 'carol@example.com',
        department: 'Sales',
        phone: '+1-555-0103',
        address: '789 Pine Rd',
        city: 'Chicago',
        country: 'USA',
        actions: '...',
      },
    ];

    return grid;
  },
};

/**
 * Only left-pinned columns (ID and Name).
 */
export const LeftPinnedOnly: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
    { field: 'name', header: 'Name', width: 150, sticky: 'left' },
    { field: 'email', header: 'Email', width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'phone', header: 'Phone', width: 150 },
    { field: 'address', header: 'Address', width: 250 },
    { field: 'city', header: 'City', width: 120 },
    { field: 'country', header: 'Country', width: 120 },
  ],
  fitMode: 'fixed',
  plugins: [new PinnedColumnsPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', phone: '+1-555-0101', address: '123 Main St', city: 'New York', country: 'USA' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', phone: '+1-555-0102', address: '456 Oak Ave', city: 'Los Angeles', country: 'USA' },
  { id: 3, name: 'Carol Williams', email: 'carol@example.com', department: 'Sales', phone: '+1-555-0103', address: '789 Pine Rd', city: 'Chicago', country: 'USA' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
        { field: 'name', header: 'Name', width: 150, sticky: 'left' },
        { field: 'email', header: 'Email', width: 200 },
        { field: 'department', header: 'Department', width: 150 },
        { field: 'phone', header: 'Phone', width: 150 },
        { field: 'address', header: 'Address', width: 250 },
        { field: 'city', header: 'City', width: 120 },
        { field: 'country', header: 'Country', width: 120 },
      ],
      fitMode: 'fixed',
      plugins: [new PinnedColumnsPlugin()],
    };

    grid.rows = [
      {
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        department: 'Engineering',
        phone: '+1-555-0101',
        address: '123 Main St',
        city: 'New York',
        country: 'USA',
      },
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@example.com',
        department: 'Marketing',
        phone: '+1-555-0102',
        address: '456 Oak Ave',
        city: 'Los Angeles',
        country: 'USA',
      },
      {
        id: 3,
        name: 'Carol Williams',
        email: 'carol@example.com',
        department: 'Sales',
        phone: '+1-555-0103',
        address: '789 Pine Rd',
        city: 'Chicago',
        country: 'USA',
      },
    ];

    return grid;
  },
};

/**
 * Only right-pinned column (Actions).
 */
export const RightPinnedOnly: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', width: 60 },
    { field: 'name', header: 'Name', width: 150 },
    { field: 'email', header: 'Email', width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'phone', header: 'Phone', width: 150 },
    { field: 'address', header: 'Address', width: 250 },
    { field: 'actions', header: 'Actions', width: 100, sticky: 'right' },
  ],
  fitMode: 'fixed',
  plugins: [new PinnedColumnsPlugin()],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', email: 'alice@example.com', department: 'Engineering', phone: '+1-555-0101', address: '123 Main St', actions: '...' },
  { id: 2, name: 'Bob Smith', email: 'bob@example.com', department: 'Marketing', phone: '+1-555-0102', address: '456 Oak Ave', actions: '...' },
  { id: 3, name: 'Carol Williams', email: 'carol@example.com', department: 'Sales', phone: '+1-555-0103', address: '789 Pine Rd', actions: '...' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 60 },
        { field: 'name', header: 'Name', width: 150 },
        { field: 'email', header: 'Email', width: 200 },
        { field: 'department', header: 'Department', width: 150 },
        { field: 'phone', header: 'Phone', width: 150 },
        { field: 'address', header: 'Address', width: 250 },
        { field: 'actions', header: 'Actions', width: 100, sticky: 'right' },
      ],
      fitMode: 'fixed',
      plugins: [new PinnedColumnsPlugin()],
    };

    grid.rows = [
      {
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        department: 'Engineering',
        phone: '+1-555-0101',
        address: '123 Main St',
        actions: '...',
      },
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@example.com',
        department: 'Marketing',
        phone: '+1-555-0102',
        address: '456 Oak Ave',
        actions: '...',
      },
      {
        id: 3,
        name: 'Carol Williams',
        email: 'carol@example.com',
        department: 'Sales',
        phone: '+1-555-0103',
        address: '789 Pine Rd',
        actions: '...',
      },
    ];

    return grid;
  },
};

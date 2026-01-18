import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { ContextMenuPlugin } from './ContextMenuPlugin';
import type { ContextMenuItem, ContextMenuParams } from './types';

// Import grid component
import '../../../index';

// Sample data for context menu demos
const sampleData = [
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
  { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
  { id: 4, name: 'Dan', email: 'dan@example.com', status: 'inactive' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'status', header: 'Status' },
];

// Default menu items
const defaultMenuItems: ContextMenuItem[] = [
  {
    id: 'copy',
    name: 'Copy Row',
    icon: '📋',
    shortcut: 'Ctrl+C',
    action: (params: ContextMenuParams) => console.log('Copy', params.row),
  },
  { id: 'edit', name: 'Edit Row', icon: '✏️', action: (params: ContextMenuParams) => console.log('Edit', params.row) },
  { id: 'sep1', name: '', separator: true },
  {
    id: 'duplicate',
    name: 'Duplicate',
    icon: '📄',
    action: (params: ContextMenuParams) => console.log('Duplicate', params.row),
  },
  { id: 'sep2', name: '', separator: true },
  {
    id: 'delete',
    name: 'Delete',
    icon: '🗑️',
    cssClass: 'danger',
    action: (params: ContextMenuParams) => console.log('Delete', params.row),
  },
];

const meta: Meta = {
  title: 'Grid/Plugins/Context Menu',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * Right-click on any row to show the context menu with icons, shortcuts, and actions.
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
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new ContextMenuPlugin({
      items: [
        { id: 'copy', name: 'Copy Row', icon: '📋', shortcut: 'Ctrl+C', action: (p) => console.log('Copy', p.row) },
        { id: 'edit', name: 'Edit Row', icon: '✏️', action: (p) => console.log('Edit', p.row) },
        { id: 'sep1', name: '', separator: true },
        { id: 'duplicate', name: 'Duplicate', icon: '📄', action: (p) => console.log('Duplicate', p.row) },
        { id: 'sep2', name: '', separator: true },
        { id: 'delete', name: 'Delete', icon: '🗑️', cssClass: 'danger', action: (p) => console.log('Delete', p.row) },
      ],
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
  { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
  { id: 4, name: 'Dan', email: 'dan@example.com', status: 'inactive' },
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
      columns,
      plugins: [new ContextMenuPlugin({ items: defaultMenuItems })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Nested submenus for complex menu hierarchies.
 */
export const WithSubmenus: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new ContextMenuPlugin({
      items: [
        { id: 'view', name: 'View', icon: '👁️', action: () => console.log('View') },
        { id: 'edit', name: 'Edit', icon: '✏️', action: () => console.log('Edit') },
        { id: 'sep1', name: '', separator: true },
        {
          id: 'export',
          name: 'Export',
          icon: '📤',
          subMenu: [
            { id: 'csv', name: 'As CSV', action: () => console.log('Export CSV') },
            { id: 'json', name: 'As JSON', action: () => console.log('Export JSON') },
            { id: 'excel', name: 'As Excel', action: () => console.log('Export Excel') },
          ],
        },
        {
          id: 'share',
          name: 'Share',
          icon: '🔗',
          subMenu: [
            { id: 'email', name: 'Email', icon: '📧', action: () => console.log('Share Email') },
            { id: 'slack', name: 'Slack', icon: '💬', action: () => console.log('Share Slack') },
          ],
        },
      ],
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
  { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
  { id: 4, name: 'Dan', email: 'dan@example.com', status: 'inactive' },
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

    const menuItems: ContextMenuItem[] = [
      { id: 'view', name: 'View', icon: '👁️', action: () => console.log('View') },
      { id: 'edit', name: 'Edit', icon: '✏️', action: () => console.log('Edit') },
      { id: 'sep1', name: '', separator: true },
      {
        id: 'export',
        name: 'Export',
        icon: '📤',
        subMenu: [
          { id: 'csv', name: 'As CSV', action: () => console.log('Export CSV') },
          { id: 'json', name: 'As JSON', action: () => console.log('Export JSON') },
          { id: 'excel', name: 'As Excel', action: () => console.log('Export Excel') },
        ],
      },
      {
        id: 'share',
        name: 'Share',
        icon: '🔗',
        subMenu: [
          { id: 'email', name: 'Email', icon: '📧', action: () => console.log('Share Email') },
          { id: 'slack', name: 'Slack', icon: '💬', action: () => console.log('Share Slack') },
        ],
      },
    ];

    grid.gridConfig = {
      columns,
      plugins: [new ContextMenuPlugin({ items: menuItems })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Dynamically disable menu items based on row data.
 */
export const ConditionalItems: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new ContextMenuPlugin({
      items: [
        {
          id: 'activate',
          name: 'Activate',
          icon: '✅',
          // Disable when row is already active
          disabled: (params) => params.row?.status === 'active',
          action: (p) => console.log('Activate', p.row),
        },
        {
          id: 'deactivate',
          name: 'Deactivate',
          icon: '⏸️',
          // Disable when row is not active
          disabled: (params) => params.row?.status !== 'active',
          action: (p) => console.log('Deactivate', p.row),
        },
        { id: 'sep1', name: '', separator: true },
        { id: 'delete', name: 'Delete', icon: '🗑️', cssClass: 'danger', action: (p) => console.log('Delete', p.row) },
      ],
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', status: 'active' },
  { id: 2, name: 'Bob', email: 'bob@example.com', status: 'pending' },
  { id: 3, name: 'Carol', email: 'carol@example.com', status: 'active' },
  { id: 4, name: 'Dan', email: 'dan@example.com', status: 'inactive' },
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

    const menuItems: ContextMenuItem[] = [
      {
        id: 'activate',
        name: 'Activate',
        icon: '✅',
        disabled: (params) => (params.row as { status?: string })?.status === 'active',
        action: (p) => console.log('Activate', p.row),
      },
      {
        id: 'deactivate',
        name: 'Deactivate',
        icon: '⏸️',
        disabled: (params) => (params.row as { status?: string })?.status !== 'active',
        action: (p) => console.log('Deactivate', p.row),
      },
      { id: 'sep1', name: '', separator: true },
      { id: 'delete', name: 'Delete', icon: '🗑️', cssClass: 'danger', action: (p) => console.log('Delete', p.row) },
    ];

    grid.gridConfig = {
      columns,
      plugins: [new ContextMenuPlugin({ items: menuItems })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

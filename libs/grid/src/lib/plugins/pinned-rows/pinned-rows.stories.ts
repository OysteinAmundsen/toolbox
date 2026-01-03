import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { PinnedRowsPlugin } from './PinnedRowsPlugin';
import type { PinnedRowsPosition } from './types';

// Import grid component
import '../../../index';

// Generate sample data
const generateData = (count: number) => {
  const names = ['Widget', 'Gadget', 'Gizmo', 'Doohickey', 'Thingamabob'];
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: names[i % names.length],
    quantity: Math.floor(Math.random() * 100) + 10,
    price: Math.round((Math.random() * 50 + 5) * 100) / 100,
  }));
};

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'quantity', header: 'Qty', type: 'number' as const },
  { field: 'price', header: 'Price', type: 'number' as const },
];

const meta: Meta = {
  title: 'Grid/Plugins/Pinned Rows',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    position: {
      control: { type: 'radio' },
      options: ['top', 'bottom'],
      description: 'Position of the info bar',
      table: { category: 'Info Bar', defaultValue: { summary: 'bottom' } },
    },
    showRowCount: {
      control: { type: 'boolean' },
      description: 'Show total row count in info bar',
      table: { category: 'Info Bar', defaultValue: { summary: 'true' } },
    },
  },
  args: {
    position: 'bottom',
    showRowCount: true,
  },
};
export default meta;

interface PinnedRowsArgs {
  position: PinnedRowsPosition;
  showRowCount: boolean;
}
type Story = StoryObj<PinnedRowsArgs>;

// Currency formatter for price columns
const formatCurrency = (value: unknown) => `$${(value as number).toFixed(2)}`;

/**
 * Status bar with aggregation rows showing totals at the bottom.
 * Scroll to see the pinned rows stay fixed.
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
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'quantity', header: 'Qty', type: 'number' },
    { field: 'price', header: 'Price', type: 'number' },
  ],
  plugins: [
    new PinnedRowsPlugin({
      position: 'bottom',
      showRowCount: true,
      aggregationRows: [
        {
          id: 'totals',
          position: 'bottom',
          aggregators: {
            // Custom aggregator function
            name: (rows) => \`\${new Set(rows.map(r => r.name)).size} unique\`,
            // Built-in aggregator
            quantity: 'sum',
            // Object syntax with formatter for currency
            price: {
              aggFunc: 'sum',
              formatter: (value) => \`$\${value.toFixed(2)}\`,
            },
          },
          cells: { id: 'Totals:' },
        },
      ],
    }),
  ],
};

// Generate sample product data
grid.rows = [
  { id: 1, name: 'Widget', quantity: 50, price: 25.00 },
  { id: 2, name: 'Gadget', quantity: 30, price: 45.50 },
  { id: 3, name: 'Widget', quantity: 25, price: 25.00 },
  { id: 4, name: 'Gizmo', quantity: 80, price: 12.99 },
  // ... more rows
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: PinnedRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PinnedRowsPlugin({
          position: args.position,
          showRowCount: args.showRowCount,
          aggregationRows: [
            {
              id: 'totals',
              position: 'bottom',
              aggregators: {
                name: (rows) => `${new Set(rows.map((r) => r.name)).size} unique`,
                quantity: 'sum',
                price: { aggFunc: 'sum', formatter: formatCurrency },
              },
              cells: { id: 'Totals:' },
            },
          ],
        }),
      ],
    };
    grid.rows = generateData(100);

    return grid;
  },
};

/**
 * Multiple aggregation rows showing sum, average, and min/max values.
 * This demonstrates how to add multiple footer rows with different aggregations.
 */
export const MultipleAggregations: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

const formatCurrency = (value) => \`$\${value.toFixed(2)}\`;

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'quantity', header: 'Qty', type: 'number' },
    { field: 'price', header: 'Price', type: 'number' },
  ],
  plugins: [
    new PinnedRowsPlugin({
      position: 'bottom',
      showRowCount: true,
      aggregationRows: [
        {
          id: 'sum',
          position: 'bottom',
          aggregators: {
            quantity: 'sum',
            price: { aggFunc: 'sum', formatter: formatCurrency },
          },
          cells: { id: 'Sum:', name: '' },
        },
        {
          id: 'avg',
          position: 'bottom',
          aggregators: {
            quantity: { aggFunc: 'avg', formatter: (v) => v.toFixed(1) },
            price: { aggFunc: 'avg', formatter: formatCurrency },
          },
          cells: { id: 'Avg:', name: '' },
        },
        {
          id: 'minmax',
          position: 'bottom',
          aggregators: {
            quantity: 'min',
            price: { aggFunc: 'max', formatter: formatCurrency },
          },
          cells: { id: 'Min/Max:', name: '' },
        },
      ],
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Widget', quantity: 50, price: 25.00 },
  { id: 2, name: 'Gadget', quantity: 30, price: 45.50 },
  // ... more rows
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: PinnedRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PinnedRowsPlugin({
          position: args.position,
          showRowCount: args.showRowCount,
          aggregationRows: [
            {
              id: 'sum',
              position: 'bottom',
              aggregators: {
                quantity: 'sum',
                price: { aggFunc: 'sum', formatter: formatCurrency },
              },
              cells: { id: 'Sum:', name: '' },
            },
            {
              id: 'avg',
              position: 'bottom',
              aggregators: {
                quantity: { aggFunc: 'avg', formatter: (v) => (v as number).toFixed(1) },
                price: { aggFunc: 'avg', formatter: formatCurrency },
              },
              cells: { id: 'Avg:', name: '' },
            },
            {
              id: 'minmax',
              position: 'bottom',
              aggregators: {
                quantity: 'min',
                price: { aggFunc: 'max', formatter: formatCurrency },
              },
              cells: { id: 'Min/Max:', name: '' },
            },
          ],
        }),
      ],
    };
    grid.rows = generateData(50);

    return grid;
  },
};

/**
 * Custom panels in the info bar with dynamic content.
 */
export const CustomPanels: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'quantity', header: 'Qty', type: 'number' },
    { field: 'price', header: 'Price', type: 'number' },
  ],
  plugins: [
    new PinnedRowsPlugin({
      customPanels: [
        {
          id: 'timestamp',
          position: 'center',
          render: () => \`Updated: \${new Date().toLocaleTimeString()}\`,
        },
        {
          id: 'total',
          position: 'right',
          render: (ctx) => \`<strong>Total: \${ctx.grid.rows.length}</strong>\`,
        },
      ],
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Widget', quantity: 50, price: 25.00 },
  { id: 2, name: 'Gadget', quantity: 30, price: 45.50 },
  // ... more rows
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: PinnedRowsArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PinnedRowsPlugin({
          position: args.position,
          showRowCount: args.showRowCount,
          customPanels: [
            {
              id: 'timestamp',
              position: 'center',
              render: () => `Last updated: ${new Date().toLocaleTimeString()}`,
            },
            {
              id: 'total-value',
              position: 'right',
              render: (ctx) => {
                const rows = (ctx.grid as GridElement).rows as Array<{ quantity: number; price: number }>;
                const total = rows.reduce((sum, row) => sum + (row.quantity || 0) * (row.price || 0), 0);
                return `<strong>Value: $${total.toFixed(2)}</strong>`;
              },
            },
          ],
        }),
      ],
    };
    grid.rows = generateData(50);

    return grid;
  },
};

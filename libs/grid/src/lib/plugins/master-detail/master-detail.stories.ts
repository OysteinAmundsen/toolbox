import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { MasterDetailPlugin } from './MasterDetailPlugin';

// Import grid component
import '../../../index';

// Generate sample order data
const generateOrderData = (count: number) => {
  const customers = [
    'Alice Corp',
    'Bob Inc',
    'Carol LLC',
    'Delta Co',
    'Echo Ltd',
    'Foxtrot GmbH',
    'Golf SA',
    'Hotel AG',
  ];
  const products = [
    'Widget A',
    'Widget B',
    'Gadget X',
    'Gadget Y',
    'Service Plan',
    'Support Pack',
    'License',
    'Hardware Kit',
  ];

  return Array.from({ length: count }, (_, i) => {
    const itemCount = 1 + (i % 4);
    const items = Array.from({ length: itemCount }, (_, j) => ({
      name: products[(i + j) % products.length],
      qty: 1 + ((i + j) % 5),
      price: 25 + ((i * 7 + j * 13) % 200),
    }));
    return {
      id: 1001 + i,
      customer: customers[i % customers.length],
      date: `2024-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
      total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
      items,
    };
  });
};

const columns = [
  { field: 'id', header: 'Order ID', type: 'number' as const },
  { field: 'customer', header: 'Customer' },
  { field: 'date', header: 'Date' },
  { field: 'total', header: 'Total', type: 'number' as const, format: (v: number) => `$${v.toFixed(2)}` },
];

const meta: Meta = {
  title: 'Grid/Plugins/Master-Detail',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: { type: 'select' },
      options: [false, 'slide', 'fade'],
      description: 'Animation style for expand/collapse',
      table: { category: 'Master-Detail', defaultValue: { summary: "'slide'" } },
    },
    detailHeight: {
      control: { type: 'select' },
      options: ['auto', 100, 150, 200],
      description: 'Height of the detail row',
      table: { category: 'Master-Detail', defaultValue: { summary: 'auto' } },
    },
    expandOnRowClick: {
      control: { type: 'boolean' },
      description: 'Expand detail on row click',
      table: { category: 'Master-Detail', defaultValue: { summary: 'false' } },
    },
  },
  args: {
    animation: 'slide' as const,
    detailHeight: 'auto',
    expandOnRowClick: false,
  },
};
export default meta;

interface MasterDetailArgs {
  animation: false | 'slide' | 'fade';
  detailHeight: 'auto' | number;
  expandOnRowClick: boolean;
}
type Story = StoryObj<MasterDetailArgs>;

// Shared detail renderer
const detailRenderer = (row: { items: { name: string; qty: number; price: number }[] }) => {
  const div = document.createElement('div');
  div.style.cssText = 'padding: 16px;';
  div.innerHTML = `
    <h4 style="margin: 0 0 8px;">Order Items</h4>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr>
          <th style="padding: 4px 8px; text-align: left;">Item</th>
          <th style="padding: 4px 8px; text-align: right;">Qty</th>
          <th style="padding: 4px 8px; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${row.items
          .map(
            (item) => `
          <tr>
            <td style="padding: 4px 8px;">${item.name}</td>
            <td style="padding: 4px 8px; text-align: right;">${item.qty}</td>
            <td style="padding: 4px 8px; text-align: right;">$${item.price.toFixed(2)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;
  return div;
};

/**
 * Click the ▶ icon in the first column to expand a row and see its detail content.
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
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'Order ID', type: 'number' },
    { field: 'customer', header: 'Customer' },
    { field: 'date', header: 'Date' },
    { field: 'total', header: 'Total', type: 'number', format: (v) => \`$\${v.toFixed(2)}\` },
  ],
  plugins: [
    new MasterDetailPlugin({
      detailHeight: 'auto',
      expandOnRowClick: false,
      detailRenderer: (row) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 16px;';
        div.innerHTML = \`
          <h4 style="margin: 0 0 8px;">Order Items</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 4px 8px; text-align: left;">Item</th>
                <th style="padding: 4px 8px; text-align: right;">Qty</th>
                <th style="padding: 4px 8px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              \${row.items.map(item => \`
                <tr>
                  <td style="padding: 4px 8px;">\${item.name}</td>
                  <td style="padding: 4px 8px; text-align: right;">\${item.qty}</td>
                  <td style="padding: 4px 8px; text-align: right;">$\${item.price.toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
        return div;
      },
    }),
  ],
};

grid.rows = [
  {
    id: 1001,
    customer: 'Alice Corp',
    date: '2024-01-15',
    total: 175,
    items: [
      { name: 'Widget A', qty: 2, price: 50 },
      { name: 'Gadget X', qty: 1, price: 75 },
    ],
  },
  {
    id: 1002,
    customer: 'Bob Inc',
    date: '2024-02-20',
    total: 250,
    items: [
      { name: 'Service Plan', qty: 1, price: 150 },
      { name: 'Support Pack', qty: 2, price: 50 },
    ],
  },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: MasterDetailArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MasterDetailPlugin({
          animation: args.animation,
          detailHeight: args.detailHeight,
          expandOnRowClick: args.expandOnRowClick,
          detailRenderer,
        }),
      ],
    };
    grid.rows = generateOrderData(100);

    return grid;
  },
};

/**
 * Click anywhere on a row to expand (not just the icon).
 */
export const ExpandOnRowClick: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'Order ID', type: 'number' },
    { field: 'customer', header: 'Customer' },
    { field: 'date', header: 'Date' },
    { field: 'total', header: 'Total', type: 'number', format: (v) => \`$\${v.toFixed(2)}\` },
  ],
  plugins: [
    new MasterDetailPlugin({
      expandOnRowClick: true, // Click row to expand
      detailRenderer: (row) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 16px;';
        div.innerHTML = \`
          <h4>Order Items</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              \${row.items.map(item => \`
                <tr>
                  <td style="padding: 4px 8px;">\${item.name}</td>
                  <td style="padding: 4px 8px; text-align: right;">\${item.qty}</td>
                  <td style="padding: 4px 8px; text-align: right;">$\${item.price.toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
        return div;
      },
    }),
  ],
};

grid.rows = [
  { id: 1001, customer: 'Alice Corp', date: '2024-01-15', total: 175, items: [{ name: 'Widget A', qty: 2, price: 50 }] },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    detailHeight: 'auto',
    expandOnRowClick: true,
  },
  render: (args: MasterDetailArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MasterDetailPlugin({
          detailHeight: args.detailHeight,
          expandOnRowClick: args.expandOnRowClick,
          detailRenderer,
        }),
      ],
    };
    grid.rows = generateOrderData(50);

    return grid;
  },
};

/**
 * Fixed height detail rows (150px).
 */
export const FixedDetailHeight: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'Order ID', type: 'number' },
    { field: 'customer', header: 'Customer' },
    { field: 'date', header: 'Date' },
    { field: 'total', header: 'Total', type: 'number', format: (v) => \`$\${v.toFixed(2)}\` },
  ],
  plugins: [
    new MasterDetailPlugin({
      detailHeight: 150, // Fixed height in pixels
      detailRenderer: (row) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 16px; overflow: auto;';
        div.innerHTML = \`
          <h4>Order Items</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              \${row.items.map(item => \`
                <tr>
                  <td style="padding: 4px 8px;">\${item.name}</td>
                  <td style="padding: 4px 8px; text-align: right;">\${item.qty}</td>
                  <td style="padding: 4px 8px; text-align: right;">$\${item.price.toFixed(2)}</td>
                </tr>
              \`).join('')}
            </tbody>
          </table>
        \`;
        return div;
      },
    }),
  ],
};

grid.rows = [
  { id: 1001, customer: 'Alice Corp', date: '2024-01-15', total: 175, items: [{ name: 'Widget A', qty: 2, price: 50 }] },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    detailHeight: 150,
    expandOnRowClick: false,
  },
  render: (args: MasterDetailArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new MasterDetailPlugin({
          detailHeight: args.detailHeight,
          expandOnRowClick: args.expandOnRowClick,
          detailRenderer,
        }),
      ],
    };
    grid.rows = generateOrderData(50);

    return grid;
  },
};

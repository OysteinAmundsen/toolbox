import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { MasterDetailPlugin } from './MasterDetailPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Master-Detail',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    detailHeight: {
      control: { type: 'select' },
      options: ['auto', 100, 150, 200],
      description: 'Height of the detail row (pixels or "auto")',
      table: { category: 'Master-Detail' },
    },
    expandOnRowClick: {
      control: { type: 'boolean' },
      description: 'Expand detail on row click (in addition to toggle icon)',
      table: { category: 'Master-Detail' },
    },
  },
  args: {
    detailHeight: 'auto',
    expandOnRowClick: false,
  },
};
export default meta;

interface MasterDetailArgs {
  detailHeight: 'auto' | number;
  expandOnRowClick: boolean;
}
type Story = StoryObj<MasterDetailArgs>;

/**
 * ## Master-Detail
 *
 * Expand rows to show additional detail content.
 * Click the ▶ icon in the first column to toggle.
 */
export const MasterDetail: Story = {
  render: (args: MasterDetailArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$detailHeight$: 'auto' | number, __$expandOnRowClick$: boolean) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'Order ID', type: 'number' },
          { field: 'customer', header: 'Customer' },
          { field: 'date', header: 'Date' },
          { field: 'total', header: 'Total', type: 'number', format: (v: number) => `$${v.toFixed(2)}` },
        ],
        plugins: [
          new MasterDetailPlugin({
            detailHeight: __$detailHeight$,
            expandOnRowClick: __$expandOnRowClick$,
            detailRenderer: (row: { items: { name: string; qty: number; price: number }[] }) => {
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
                    `
                      )
                      .join('')}
                  </tbody>
                </table>
              `;
              return div;
            },
          }),
        ],
      };

      // Generate 100 rows to test virtualization
      const customers = [
        'Alice Corp',
        'Bob Inc',
        'Carol LLC',
        'Delta Co',
        'Echo Ltd',
        'Foxtrot GmbH',
        'Golf SA',
        'Hotel AG',
        'India Pvt',
        'Juliet BV',
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

      grid.rows = Array.from({ length: 100 }, (_, i) => {
        const itemCount = 1 + (i % 4); // 1-4 items per order
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

      grid.addEventListener('detail-expand', (e: CustomEvent) => {
        console.log('detail-expand', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.detailHeight, args.expandOnRowClick);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-master-detail',
      plugins: [{ className: 'MasterDetailPlugin', path: 'plugins/master-detail' }],
      description: `
        <p>The <strong>Master-Detail</strong> plugin lets you expand rows to reveal additional content.</p>
        <p><strong>Try it:</strong> Click the <code>▶</code> icon on any order row to see its line items.</p>
        <ul>
          <li>Detail height: <code>${args.detailHeight}</code></li>
          <li>Click row to expand: ${args.expandOnRowClick ? 'Enabled' : 'Disabled'}</li>
          <li>The <code>detailRenderer</code> function provides full control over detail content</li>
        </ul>
      `,
    });
  },
};

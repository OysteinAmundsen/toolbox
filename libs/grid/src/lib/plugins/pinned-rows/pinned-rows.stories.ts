import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import type { PinnedRowsPosition } from './types';
import { PinnedRowsPlugin } from './PinnedRowsPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    showAggregators: {
      control: { type: 'boolean' },
      description: 'Show aggregation rows at the bottom',
      table: { category: 'Aggregation' },
    },
    position: {
      control: { type: 'radio' },
      options: ['top', 'bottom'],
      description: 'Position of the info bar',
      table: { category: 'Info Bar' },
    },
    showRowCount: {
      control: { type: 'boolean' },
      description: 'Show total row count in info bar',
      table: { category: 'Info Bar' },
    },
  },
  args: {
    showAggregators: true,
    position: 'bottom',
    showRowCount: true,
  },
};
export default meta;

interface PinnedRowsArgs {
  showAggregators: boolean;
  position: PinnedRowsPosition;
  showRowCount: boolean;
}
type Story = StoryObj<PinnedRowsArgs>;

/**
 * ## Status Bar
 *
 * The status bar plugin provides two types of status displays:
 *
 * ### Aggregation Rows
 * Column-aligned summary rows that display aggregated data (sum, avg, min, max, count).
 * These align with the grid columns and are ideal for totals and statistics.
 *
 * ### Info Bar
 * A flexible bar for arbitrary status information with left/center/right panels.
 * Shows row counts, timestamps, custom calculations, etc.
 *
 * **Features:**
 * - Aggregation rows with built-in aggregators
 * - Info bar with custom panels
 * - Independent positioning for each
 * - Dynamic content via render functions
 */
export const PinnedRows: Story = {
  render: (args: PinnedRowsArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid style="height: 400px; display: block;"></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$showAggregators$: boolean, __$position$: PinnedRowsPosition, __$showRowCount$: boolean) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'quantity', header: 'Qty', type: 'number' },
          { field: 'price', header: 'Price', type: 'number' },
        ],
        plugins: [
          new PinnedRowsPlugin({
            position: __$position$,
            showRowCount: __$showRowCount$,
            // Aggregation rows (column-aligned totals)
            aggregationRows: __$showAggregators$
              ? [
                  {
                    id: 'totals',
                    position: 'bottom',
                    aggregators: {
                      // Custom aggregator: count unique values
                      name: (rows) => `${new Set(rows.map((r) => r.name)).size} unique`,
                      quantity: 'sum',
                      price: 'sum',
                    },
                    cells: { id: 'Totals:' },
                  },
                ]
              : [],
            // Custom panels (info bar content)
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
                  const total = (ctx.grid as GridElement).rows.reduce(
                    (sum: number, row: { quantity: number; price: number }) =>
                      sum + (row.quantity || 0) * (row.price || 0),
                    0
                  );
                  return `<strong>Value: $${total.toFixed(2)}</strong>`;
                },
              },
            ],
          }),
        ],
      };

      // Generate 100 rows for testing scrolling + sticky behavior
      const names = ['Widget', 'Gadget', 'Gizmo', 'Doohickey', 'Thingamabob'];
      grid.rows = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: names[i % names.length],
        quantity: Math.floor(Math.random() * 100) + 10,
        price: Math.round((Math.random() * 50 + 5) * 100) / 100,
      }));
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.showAggregators, args.position, args.showRowCount);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-pinned-rows',
      plugins: [{ className: 'PinnedRowsPlugin', path: 'plugins/pinned-rows' }],
      description: `
        <p>The <strong>Status Bar</strong> plugin provides two display types:</p>
        <ul>
          <li><strong>Aggregation Rows:</strong> ${args.showAggregators ? 'Showing totals at bottom' : 'Hidden'}</li>
          <li><strong>Info Bar:</strong> At ${args.position} with ${
        args.showRowCount ? 'row count,' : ''
      } timestamp, and total value</li>
        </ul>
        <p>Toggle the controls to see each feature in action.</p>
      `,
    });
  },
};

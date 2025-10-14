import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { PivotPlugin } from './PivotPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    showTotals: {
      control: { type: 'boolean' },
      description: 'Show row totals',
      table: { category: 'Pivot' },
    },
    showGrandTotal: {
      control: { type: 'boolean' },
      description: 'Show grand total row',
      table: { category: 'Pivot' },
    },
  },
  args: {
    showTotals: true,
    showGrandTotal: true,
  },
};
export default meta;

interface PivotArgs {
  showTotals: boolean;
  showGrandTotal: boolean;
}
type Story = StoryObj<PivotArgs>;

/**
 * ## Pivot Table
 *
 * Transform flat data into a pivot table view with row groups,
 * column groups, and aggregated values.
 */
export const Pivot: Story = {
  render: (args: PivotArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$showTotals$: boolean, __$showGrandTotal$: boolean) => {
      grid.gridConfig = {
        columns: [
          { field: 'region', header: 'Region' },
          { field: 'product', header: 'Product' },
          { field: 'quarter', header: 'Quarter' },
          { field: 'sales', header: 'Sales', type: 'number' },
        ],
        plugins: [
          new PivotPlugin({
            rowGroupFields: ['region'],
            columnGroupFields: ['quarter'],
            valueFields: [{ field: 'sales', aggFunc: 'sum', header: 'Total Sales' }],
            showTotals: __$showTotals$,
            showGrandTotal: __$showGrandTotal$,
          }),
        ],
      };

      grid.rows = [
        { region: 'North', product: 'Widget A', quarter: 'Q1', sales: 1200 },
        { region: 'North', product: 'Widget B', quarter: 'Q1', sales: 800 },
        { region: 'North', product: 'Widget A', quarter: 'Q2', sales: 1500 },
        { region: 'North', product: 'Widget B', quarter: 'Q2', sales: 950 },
        { region: 'South', product: 'Widget A', quarter: 'Q1', sales: 900 },
        { region: 'South', product: 'Widget B', quarter: 'Q1', sales: 1100 },
        { region: 'South', product: 'Widget A', quarter: 'Q2', sales: 1300 },
        { region: 'South', product: 'Widget B', quarter: 'Q2', sales: 1400 },
        { region: 'East', product: 'Widget A', quarter: 'Q1', sales: 750 },
        { region: 'East', product: 'Widget B', quarter: 'Q1', sales: 650 },
        { region: 'East', product: 'Widget A', quarter: 'Q2', sales: 880 },
        { region: 'East', product: 'Widget B', quarter: 'Q2', sales: 720 },
      ];
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.showTotals, args.showGrandTotal);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-pivot',
      plugins: [{ className: 'PivotPlugin', path: 'plugins/pivot' }],
      description: `
        <p>The <strong>Pivot</strong> plugin transforms flat data into a pivot table view.</p>
        <p>This example groups sales data by <strong>Region</strong> (rows) and <strong>Quarter</strong> (columns), 
        aggregating <strong>Sales</strong> using sum.</p>
        <ul>
          <li>Row totals: ${args.showTotals ? 'Shown' : 'Hidden'}</li>
          <li>Grand total: ${args.showGrandTotal ? 'Shown' : 'Hidden'}</li>
          <li>Supports multiple aggregation functions: sum, avg, count, min, max</li>
        </ul>
      `,
    });
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { PivotPlugin } from './PivotPlugin';

// Import grid component
import '../../../index';

// Sample sales data for pivot demos
const salesData = [
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

const columns = [
  { field: 'region', header: 'Region' },
  { field: 'product', header: 'Product' },
  { field: 'quarter', header: 'Quarter' },
  { field: 'sales', header: 'Sales', type: 'number' as const },
];

/** Generate code snippet for Default/NoTotals stories */
function generatePivotCode(args: PivotArgs): string {
  return `<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';

const grid = queryGrid('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'region', header: 'Region' },
    { field: 'product', header: 'Product' },
    { field: 'quarter', header: 'Quarter' },
    { field: 'sales', header: 'Sales', type: 'number' },
  ],
  plugins: [
    new PivotPlugin({
      rowGroupFields: ['region', 'product'],
      columnGroupFields: ['quarter'],
      valueFields: [{ field: 'sales', aggFunc: 'sum', header: 'Total Sales' }],
      showTotals: ${args.showTotals},
      showGrandTotal: ${args.showGrandTotal},
      showToolPanel: ${args.showToolPanel},
    }),
  ],
};

grid.rows = [
  { region: 'North', product: 'Widget A', quarter: 'Q1', sales: 1200 },
  { region: 'North', product: 'Widget B', quarter: 'Q1', sales: 800 },
  // ... more sales data
];
</script>`;
}

const meta: Meta = {
  title: 'Grid/Plugins/Pivot',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: { type: 'select' },
      options: [false, 'slide', 'fade'],
      description: 'Animation style for expand/collapse',
      table: { category: 'Pivot', defaultValue: { summary: "'slide'" } },
    },
    showTotals: {
      control: { type: 'boolean' },
      description: 'Show row totals',
      table: { category: 'Pivot', defaultValue: { summary: 'true' } },
    },
    showGrandTotal: {
      control: { type: 'boolean' },
      description: 'Show grand total row',
      table: { category: 'Pivot', defaultValue: { summary: 'true' } },
    },
    showToolPanel: {
      control: { type: 'boolean' },
      description: 'Show pivot tool panel for interactive configuration',
      table: { category: 'Pivot', defaultValue: { summary: 'true' } },
    },
  },
  args: {
    animation: 'slide' as const,
    showTotals: true,
    showGrandTotal: true,
    showToolPanel: true,
  },
};
export default meta;

interface PivotArgs {
  animation: false | 'slide' | 'fade';
  showTotals: boolean;
  showGrandTotal: boolean;
  showToolPanel: boolean;
}
type Story = StoryObj<PivotArgs>;

/**
 * Transform flat data into a pivot table view. Groups sales by Region → Product
 * (rows) and Quarter (columns), aggregating with sum.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        transform: (_code: string, ctx: { args: PivotArgs }) => generatePivotCode(ctx.args),
        language: 'html',
      },
    },
  },
  render: (args: PivotArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PivotPlugin({
          animation: args.animation,
          rowGroupFields: ['region', 'product'],
          columnGroupFields: ['quarter'],
          valueFields: [{ field: 'sales', aggFunc: 'sum', header: 'Total Sales' }],
          showTotals: args.showTotals,
          showGrandTotal: args.showGrandTotal,
          showToolPanel: args.showToolPanel,
        }),
      ],
    };
    grid.rows = salesData;

    return grid;
  },
};

/**
 * Pivot without totals - just the raw aggregated values.
 */
export const NoTotals: Story = {
  parameters: {
    docs: {
      source: {
        transform: (_code: string, ctx: { args: PivotArgs }) => generatePivotCode(ctx.args),
        language: 'html',
      },
    },
  },
  args: {
    showTotals: false,
    showGrandTotal: false,
  },
  render: (args: PivotArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PivotPlugin({
          rowGroupFields: ['region', 'product'],
          columnGroupFields: ['quarter'],
          valueFields: [{ field: 'sales', aggFunc: 'sum', header: 'Total Sales' }],
          showTotals: args.showTotals,
          showGrandTotal: args.showGrandTotal,
          showToolPanel: args.showToolPanel,
        }),
      ],
    };
    grid.rows = salesData;

    return grid;
  },
};

/** Generate code snippet for AverageAggregation story */
function generateAvgPivotCode(args: PivotArgs): string {
  return `<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';

const grid = queryGrid('tbw-grid');
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
      valueFields: [{ field: 'sales', aggFunc: 'avg', header: 'Avg Sales' }],
      showTotals: ${args.showTotals},
      showGrandTotal: ${args.showGrandTotal},
      showToolPanel: ${args.showToolPanel},
    }),
  ],
};

grid.rows = [
  { region: 'North', product: 'Widget A', quarter: 'Q1', sales: 1200 },
  // ... more sales data
];
</script>`;
}

/**
 * Average aggregation instead of sum.
 */
export const AverageAggregation: Story = {
  parameters: {
    docs: {
      source: {
        transform: (_code: string, ctx: { args: PivotArgs }) => generateAvgPivotCode(ctx.args),
        language: 'html',
      },
    },
  },
  render: (args: PivotArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    grid.gridConfig = {
      columns,
      plugins: [
        new PivotPlugin({
          rowGroupFields: ['region'],
          columnGroupFields: ['quarter'],
          valueFields: [{ field: 'sales', aggFunc: 'avg', header: 'Avg Sales' }],
          showTotals: args.showTotals,
          showGrandTotal: args.showGrandTotal,
          showToolPanel: args.showToolPanel,
        }),
      ],
    };
    grid.rows = salesData;

    return grid;
  },
};

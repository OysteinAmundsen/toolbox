import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { SelectionPlugin } from '../selection/SelectionPlugin';
import { ExportPlugin } from './ExportPlugin';

// Import grid component
import '../../../index';

// Sample data for export demos
const sampleData = [
  { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, startDate: '2023-01-15' },
  { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, startDate: '2022-06-20' },
  { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, startDate: '2021-03-10' },
  { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, startDate: '2023-08-05' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
  { field: 'startDate', header: 'Start Date' },
];

const meta: Meta = {
  title: 'Grid/Plugins/Export',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    includeHeaders: {
      control: { type: 'boolean' },
      description: 'Include column headers in export',
      table: { category: 'Export', defaultValue: { summary: 'true' } },
    },
    onlyVisible: {
      control: { type: 'boolean' },
      description: 'Only export visible columns',
      table: { category: 'Export', defaultValue: { summary: 'true' } },
    },
    onlySelected: {
      control: { type: 'boolean' },
      description: 'Only export selected rows',
      table: { category: 'Export', defaultValue: { summary: 'false' } },
    },
  },
  args: {
    includeHeaders: true,
    onlyVisible: true,
    onlySelected: false,
  },
};
export default meta;

interface ExportArgs {
  includeHeaders: boolean;
  onlyVisible: boolean;
  onlySelected: boolean;
}
type Story = StoryObj<ExportArgs>;

// Mutable ref so source.transform always reads the latest args
let currentExportArgs: ExportArgs = { includeHeaders: true, onlyVisible: true, onlySelected: false };

function getExportSourceCode(args: ExportArgs): string {
  return `import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';

const grid = document.querySelector('tbw-grid');
const exportPlugin = new ExportPlugin({
  includeHeaders: ${args.includeHeaders},
  onlyVisible: ${args.onlyVisible},
  onlySelected: ${args.onlySelected},
  fileName: 'grid-export',
});

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    exportPlugin,
  ],
};
grid.rows = [...];

// Trigger export
exportPlugin.exportCsv();
exportPlugin.exportExcel();
exportPlugin.exportJson();`;
}

/**
 * Export grid data to CSV, Excel, or JSON formats. Click the export buttons
 * above the grid to download data.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        language: 'typescript',
        transform: () => getExportSourceCode(currentExportArgs),
      },
    },
  },
  render: (args: ExportArgs) => {
    currentExportArgs = args;

    const container = document.createElement('div');

    // Create export buttons
    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 8px; display: flex; gap: 8px; flex-wrap: wrap;';
    controls.innerHTML = `
      <button class="export-csv" style="padding: 6px 12px; cursor: pointer;">Export CSV</button>
      <button class="export-excel" style="padding: 6px 12px; cursor: pointer;">Export Excel</button>
      <button class="export-json" style="padding: 6px 12px; cursor: pointer;">Export JSON</button>
    `;
    container.appendChild(controls);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    container.appendChild(grid);

    const plugin = new ExportPlugin({
      includeHeaders: args.includeHeaders,
      onlyVisible: args.onlyVisible,
      onlySelected: args.onlySelected,
      fileName: 'grid-export',
    });

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'range' }), plugin],
    };
    grid.rows = sampleData;

    // Wire up export buttons
    controls.querySelector('.export-csv')?.addEventListener('click', () => plugin.exportCsv());
    controls.querySelector('.export-excel')?.addEventListener('click', () => plugin.exportExcel());
    controls.querySelector('.export-json')?.addEventListener('click', () => plugin.exportJson());

    return container;
  },
};

/**
 * Export only selected rows. Select rows first, then click export.
 */
export const ExportSelected: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<div>
  <div style="padding: 8px;">
    <button class="export-csv" style="padding: 6px 12px; cursor: pointer;">Export Selected (CSV)</button>
  </div>
  <tbw-grid style="height: 350px;"></tbw-grid>
</div>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';

const grid = document.querySelector('tbw-grid');
const exportPlugin = new ExportPlugin({
  includeHeaders: true,
  onlyVisible: true,
  onlySelected: true, // Only export selected rows
  fileName: 'selected-export',
});

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
    { field: 'startDate', header: 'Start Date' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }), // Enable range selection
    exportPlugin,
  ],
};

grid.rows = [
  { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, startDate: '2023-01-15' },
  { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, startDate: '2022-06-20' },
  { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, startDate: '2021-03-10' },
  { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, startDate: '2023-08-05' },
];

// Select rows first, then export
document.querySelector('.export-csv').addEventListener('click', () => exportPlugin.exportCsv());
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    includeHeaders: true,
    onlyVisible: true,
    onlySelected: true,
  },
  render: (args: ExportArgs) => {
    const container = document.createElement('div');

    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 8px; display: flex; gap: 8px; flex-wrap: wrap;';
    controls.innerHTML = `
      <button class="export-csv" style="padding: 6px 12px; cursor: pointer;">Export Selected (CSV)</button>
    `;
    container.appendChild(controls);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    container.appendChild(grid);

    const plugin = new ExportPlugin({
      includeHeaders: args.includeHeaders,
      onlyVisible: args.onlyVisible,
      onlySelected: args.onlySelected,
      fileName: 'selected-export',
    });

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'range' }), plugin],
    };
    grid.rows = sampleData;

    controls.querySelector('.export-csv')?.addEventListener('click', () => plugin.exportCsv());

    return container;
  },
};

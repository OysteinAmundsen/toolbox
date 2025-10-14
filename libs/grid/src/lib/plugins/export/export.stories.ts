import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { SelectionPlugin } from '../selection/SelectionPlugin';
import { ExportPlugin } from './ExportPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    includeHeaders: {
      control: { type: 'boolean' },
      description: 'Include column headers in export',
      table: { category: 'Export' },
    },
    onlyVisible: {
      control: { type: 'boolean' },
      description: 'Only export visible columns',
      table: { category: 'Export' },
    },
    onlySelected: {
      control: { type: 'boolean' },
      description: 'Only export selected rows',
      table: { category: 'Export' },
    },
    fileName: {
      control: { type: 'text' },
      description: 'Base file name for downloads',
      table: { category: 'Export' },
    },
  },
  args: {
    includeHeaders: true,
    onlyVisible: true,
    onlySelected: false,
    fileName: 'grid-export',
  },
};
export default meta;

interface ExportArgs {
  includeHeaders: boolean;
  onlyVisible: boolean;
  onlySelected: boolean;
  fileName: string;
}
type Story = StoryObj<ExportArgs>;

/**
 * ## Data Export
 *
 * Export grid data to CSV, Excel, or JSON formats.
 * Use the buttons to trigger different export types.
 */
export const Export: Story = {
  render: (args: ExportArgs) => {
    const host = document.createElement('div');

    // Create export buttons
    const controls = document.createElement('div');
    controls.style.cssText = 'padding: 8px; display: flex; gap: 8px; flex-wrap: wrap;';
    controls.innerHTML = `
      <button class="export-csv">Export CSV</button>
      <button class="export-excel">Export Excel</button>
      <button class="export-json">Export JSON</button>
    `;
    host.appendChild(controls);

    const gridContainer = document.createElement('div');
    gridContainer.innerHTML = `<tbw-grid></tbw-grid>`;
    host.appendChild(gridContainer);

    const grid = gridContainer.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (
      __$includeHeaders$: boolean,
      __$onlyVisible$: boolean,
      __$onlySelected$: boolean,
      __$fileName$: string
    ) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'department', header: 'Department' },
          { field: 'salary', header: 'Salary', type: 'number' },
          { field: 'startDate', header: 'Start Date' },
        ],
        plugins: [
          new SelectionPlugin({ mode: 'range' }),
          new ExportPlugin({
            includeHeaders: __$includeHeaders$,
            onlyVisible: __$onlyVisible$,
            onlySelected: __$onlySelected$,
            fileName: '__$fileName$',
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 95000, startDate: '2023-01-15' },
        { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 75000, startDate: '2022-06-20' },
        { id: 3, name: 'Carol Williams', department: 'Engineering', salary: 105000, startDate: '2021-03-10' },
        { id: 4, name: 'Dan Brown', department: 'Sales', salary: 85000, startDate: '2023-08-05' },
      ];

      // Wire up export buttons (use querySelector on container element)
      document.querySelector('.export-csv')?.addEventListener('click', () => {
        grid.getPlugin(ExportPlugin)?.exportCsv();
      });
      document.querySelector('.export-excel')?.addEventListener('click', () => {
        grid.getPlugin(ExportPlugin)?.exportExcel();
      });
      document.querySelector('.export-json')?.addEventListener('click', () => {
        grid.getPlugin(ExportPlugin)?.exportJson();
      });

      grid.addEventListener('export-complete', (e: CustomEvent) => {
        console.log('export-complete', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.includeHeaders, args.onlyVisible, args.onlySelected, args.fileName);

    // Wire up the actual buttons in the host element
    controls.querySelector('.export-csv')?.addEventListener('click', () => {
      grid.getPlugin(ExportPlugin)?.exportCsv();
    });
    controls.querySelector('.export-excel')?.addEventListener('click', () => {
      grid.getPlugin(ExportPlugin)?.exportExcel();
    });
    controls.querySelector('.export-json')?.addEventListener('click', () => {
      grid.getPlugin(ExportPlugin)?.exportJson();
    });

    const htmlSnippet = `<tbw-grid></tbw-grid>`;

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-export',
      plugins: [
        { className: 'SelectionPlugin', path: 'plugins/selection' },
        { className: 'ExportPlugin', path: 'plugins/export' },
      ],
      description: `
        <p>The <strong>Export</strong> plugin enables exporting grid data to various formats.</p>
        <p><strong>Try it:</strong> Click the export buttons above to download data.</p>
        <ul>
          <li><strong>CSV</strong> — Comma-separated values</li>
          <li><strong>Excel</strong> — XLSX format</li>
          <li><strong>JSON</strong> — JavaScript Object Notation</li>
        </ul>
      `,
    });
  },
};

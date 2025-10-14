import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { MultiSortPlugin } from './MultiSortPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    maxSortColumns: {
      control: { type: 'range', min: 1, max: 5, step: 1 },
      description: 'Maximum number of columns to sort by',
      table: { category: 'Sorting' },
    },
    showSortIndex: {
      control: { type: 'boolean' },
      description: 'Show sort order badges (1, 2, 3) on headers',
      table: { category: 'Sorting' },
    },
    initialSort: {
      control: { type: 'boolean' },
      description: 'Apply initial sort (Department ASC, Salary DESC)',
      table: { category: 'Sorting' },
    },
  },
  args: {
    maxSortColumns: 3,
    showSortIndex: true,
    initialSort: false,
  },
};
export default meta;

interface MultiSortArgs {
  maxSortColumns: number;
  showSortIndex: boolean;
  initialSort: boolean;
}
type Story = StoryObj<MultiSortArgs>;

/**
 * ## Multi-Column Sorting
 *
 * Hold Shift and click column headers to sort by multiple columns.
 * The sort order is indicated by badges (1, 2, 3) when enabled.
 */
export const MultiSort: Story = {
  render: (args: MultiSortArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$maxSortColumns$: number, __$showSortIndex$: boolean, __$initialSort$: boolean) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', sortable: true },
          { field: 'name', header: 'Name', sortable: true },
          { field: 'department', header: 'Department', sortable: true },
          { field: 'salary', header: 'Salary', type: 'number', sortable: true },
          { field: 'joined', header: 'Joined', type: 'date', sortable: true },
        ],
        plugins: [
          new MultiSortPlugin({
            maxSortColumns: __$maxSortColumns$,
            showSortIndex: __$showSortIndex$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, joined: '2023-01-15' },
        { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, joined: '2022-06-20' },
        { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, joined: '2021-03-10' },
        { id: 4, name: 'Dan', department: 'Engineering', salary: 85000, joined: '2023-08-05' },
        { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, joined: '2024-01-12' },
        { id: 6, name: 'Frank', department: 'Sales', salary: 82000, joined: '2022-11-30' },
      ];

      // Apply initial sort if enabled
      if (__$initialSort$) {
        setTimeout(() => {
          grid.pluginApi('multiSort', 'setSortModel', [
            { field: 'department', direction: 'asc' },
            { field: 'salary', direction: 'desc' },
          ]);
        }, 100);
      }

      grid.addEventListener('sort-change', (e: CustomEvent) => {
        console.log('sort-change', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.maxSortColumns, args.showSortIndex, args.initialSort);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-multi-sort',
      plugins: [{ className: 'MultiSortPlugin', path: 'plugins/multi-sort' }],
      description: `
        <p>The <strong>Multi-Sort</strong> plugin enables sorting by multiple columns.</p>
        <p><strong>Try it:</strong></p>
        <ul>
          <li>Click a column header to sort by that column</li>
          <li>Hold <code>Shift</code> and click another header to add it as a secondary sort</li>
          <li>Sort badges (1, 2, 3) show the sort priority: ${args.showSortIndex ? 'Enabled' : 'Disabled'}</li>
          <li>Maximum sort columns: ${args.maxSortColumns}</li>
          <li>Initial sort (Department ASC, Salary DESC): ${args.initialSort ? 'Enabled' : 'Disabled'}</li>
        </ul>
      `,
    });
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { GroupingRowsPlugin } from './GroupingRowsPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    defaultExpanded: {
      control: { type: 'boolean' },
      description: 'Whether groups are expanded by default',
      table: { category: 'Row Grouping' },
    },
    showRowCount: {
      control: { type: 'boolean' },
      description: 'Show row count in group headers',
      table: { category: 'Row Grouping' },
    },
    indentWidth: {
      control: { type: 'range', min: 10, max: 40, step: 5 },
      description: 'Indentation width per depth level in pixels',
      table: { category: 'Row Grouping' },
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: 'Render group row as full-width spanning cell',
      table: { category: 'Row Grouping' },
    },
  },
  args: {
    defaultExpanded: false,
    showRowCount: true,
    indentWidth: 20,
    fullWidth: true,
  },
};
export default meta;

interface GroupingRowsArgs {
  defaultExpanded: boolean;
  showRowCount: boolean;
  indentWidth: number;
  fullWidth: boolean;
}
type Story = StoryObj<GroupingRowsArgs>;

/**
 * ## Row Grouping
 *
 * Group rows by one or more fields using the `groupOn` callback.
 * Click group headers to expand/collapse.
 */
export const RowGrouping: Story = {
  render: (args: GroupingRowsArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (
      __$defaultExpanded$: boolean,
      __$showRowCount$: boolean,
      __$indentWidth$: number,
      __$fullWidth$: boolean
    ) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'department', header: 'Department' },
          { field: 'salary', header: 'Salary', type: 'number' },
        ],
        plugins: [
          new GroupingRowsPlugin({
            groupOn: (row: { department: string }) => row.department,
            defaultExpanded: __$defaultExpanded$,
            showRowCount: __$showRowCount$,
            indentWidth: __$indentWidth$,
            fullWidth: __$fullWidth$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
        { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
        { id: 3, name: 'Carol', department: 'Engineering', salary: 105000 },
        { id: 4, name: 'Dan', department: 'Sales', salary: 85000 },
        { id: 5, name: 'Eve', department: 'Marketing', salary: 72000 },
        { id: 6, name: 'Frank', department: 'Engineering', salary: 98000 },
        { id: 7, name: 'Grace', department: 'Sales', salary: 88000 },
      ];

      grid.addEventListener('group-expand', (e: CustomEvent) => {
        console.log('group-expand', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.defaultExpanded, args.showRowCount, args.indentWidth, args.fullWidth);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-grouping-rows',
      plugins: [{ className: 'GroupingRowsPlugin', path: 'plugins/grouping-rows' }],
      description: `
        <p>The <strong>Row Grouping</strong> plugin groups rows by a field value.</p>
        <p><strong>Try it:</strong> Click a group header (e.g., "Engineering") to expand or collapse that group.</p>
        <ul>
          <li>Groups are created using the <code>groupOn</code> callback</li>
          <li>Row count in headers: ${args.showRowCount ? 'Shown' : 'Hidden'}</li>
          <li>Default expanded: ${args.defaultExpanded ? 'Yes' : 'No'}</li>
          <li>You can nest grouping by multiple fields for hierarchies</li>
        </ul>
      `,
    });
  },
};

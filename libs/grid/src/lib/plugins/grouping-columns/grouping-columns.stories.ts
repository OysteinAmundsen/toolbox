import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { GroupingColumnsPlugin } from './GroupingColumnsPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    showGroupBorders: {
      control: { type: 'boolean' },
      description: 'Show borders between column groups',
      table: { category: 'Column Groups' },
    },
  },
  args: {
    showGroupBorders: true,
  },
};
export default meta;

interface GroupingColumnsArgs {
  showGroupBorders: boolean;
}
type Story = StoryObj<GroupingColumnsArgs>;

/**
 * ## Column Header Groups
 *
 * Group related columns under a shared header row.
 * Define groups using the `group` property on column config.
 */
export const ColumnGrouping: Story = {
  render: (args: GroupingColumnsArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$showGroupBorders$: boolean) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          // Personal Info group
          { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
          { field: 'lastName', header: 'Last Name', group: { id: 'personal', label: 'Personal Info' } },
          { field: 'email', header: 'Email', group: { id: 'personal', label: 'Personal Info' } },
          // Work Info group
          { field: 'department', header: 'Department', group: { id: 'work', label: 'Work Info' } },
          { field: 'title', header: 'Title', group: { id: 'work', label: 'Work Info' } },
          { field: 'salary', header: 'Salary', type: 'number', group: { id: 'work', label: 'Work Info' } },
        ],
        plugins: [new GroupingColumnsPlugin({ showGroupBorders: __$showGroupBorders$ })],
      };

      grid.rows = [
        {
          id: 1,
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice@example.com',
          department: 'Engineering',
          title: 'Senior Engineer',
          salary: 95000,
        },
        {
          id: 2,
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob@example.com',
          department: 'Marketing',
          title: 'Marketing Manager',
          salary: 85000,
        },
        {
          id: 3,
          firstName: 'Carol',
          lastName: 'Williams',
          email: 'carol@example.com',
          department: 'Engineering',
          title: 'Lead Engineer',
          salary: 115000,
        },
      ];
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.showGroupBorders);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-column-groups',
      plugins: [{ className: 'GroupingColumnsPlugin', path: 'plugins/grouping-columns' }],
      description: `
        <p>The <strong>Column Groups</strong> plugin adds a header row that spans multiple columns.</p>
        <p>In this example, columns are organized into two groups:</p>
        <ul>
          <li><strong>Personal Info</strong> — First Name, Last Name, Email</li>
          <li><strong>Work Info</strong> — Department, Title, Salary</li>
        </ul>
        <p>Set the <code>group</code> property on column config with matching <code>id</code> values.</p>
      `,
    });
  },
};

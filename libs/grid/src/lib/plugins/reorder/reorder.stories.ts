import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { ReorderPlugin } from './ReorderPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    animation: {
      control: { type: 'boolean' },
      description: 'Animate column movement',
      table: { category: 'Reorder' },
    },
    animationDuration: {
      control: { type: 'range', min: 0, max: 500, step: 50 },
      description: 'Animation duration in milliseconds',
      table: { category: 'Reorder' },
    },
  },
  args: {
    animation: true,
    animationDuration: 200,
  },
};
export default meta;

interface ReorderArgs {
  animation: boolean;
  animationDuration: number;
}
type Story = StoryObj<ReorderArgs>;

/**
 * ## Column Reordering
 *
 * Drag column headers to reorder columns.
 * The reorder plugin enables drag-and-drop column repositioning.
 */
export const ColumnReorder: Story = {
  render: (args: ReorderArgs) => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = (__$animation$: boolean, __$animationDuration$: number) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'department', header: 'Department' },
          { field: 'email', header: 'Email' },
          { field: 'salary', header: 'Salary', type: 'number' },
        ],
        plugins: [
          new ReorderPlugin({
            animation: __$animation$,
            animationDuration: __$animationDuration$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice', department: 'Engineering', email: 'alice@example.com', salary: 95000 },
        { id: 2, name: 'Bob', department: 'Marketing', email: 'bob@example.com', salary: 75000 },
        { id: 3, name: 'Carol', department: 'Engineering', email: 'carol@example.com', salary: 105000 },
      ];

      grid.addEventListener('column-move', (e: CustomEvent) => {
        console.log('column-move', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.animation, args.animationDuration);

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-reorder',
      plugins: [{ className: 'ReorderPlugin', path: 'plugins/reorder' }],
      description: `
        <p>The <strong>Reorder</strong> plugin enables drag-and-drop column repositioning.</p>
        <p><strong>Try it:</strong> Click and drag any column header to move it to a new position.</p>
        <ul>
          <li>A visual indicator shows where the column will be placed</li>
          <li>Animation: ${args.animation ? `Enabled (${args.animationDuration}ms)` : 'Disabled'}</li>
          <li>The <code>column-move</code> event fires when reordering completes</li>
        </ul>
      `,
    });
  },
};

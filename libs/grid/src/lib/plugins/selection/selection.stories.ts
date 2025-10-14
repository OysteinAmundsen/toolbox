import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import type { SelectionChangeDetail, SelectionMode } from './types';
import { SelectionPlugin } from './SelectionPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['cell', 'row', 'range'],
      description: 'Selection mode',
      table: { category: 'Selection', type: { summary: 'SelectionMode' } },
    },
  },
  args: {
    mode: 'cell',
  },
};
export default meta;

interface SelectionArgs {
  mode: SelectionMode;
}
type Story = StoryObj<SelectionArgs>;

const modeDescriptions: Record<SelectionMode, string> = {
  cell: 'Single cell - click to select one cell at a time',
  row: 'Entire row - click any cell to select the full row',
  range: 'Rectangle - shift+click or drag to select cell ranges',
};

/**
 * ## Selection Demo
 *
 * Interactive demo showing all three selection modes with a mode switcher
 * and live selection event output.
 *
 * **Selection Modes:**
 * - `cell` - Single cell selection (default). No special border, just focus highlight.
 * - `row` - Row selection. Uses `--tbw-focus-outline` color for the row border.
 * - `range` - Range selection with shift+click or drag. Uses green border.
 *
 * **Keyboard shortcuts:**
 * - `Escape` - Clear selection
 * - `Ctrl+A` (range mode) - Select all cells
 *
 * **Event:**
 * The `selection-change` event emits `{ mode, ranges }` where ranges are in
 * the format `{ from: { row, col }, to: { row, col } }`.
 */
export const Selection: Story = {
  args: {
    mode: 'cell',
  },
  render: (args: SelectionArgs) => {
    const host = document.createElement('div');
    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.height = '100%';

    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    const gridWrapper = document.createElement('div');
    gridWrapper.style.flex = '1';
    gridWrapper.style.minHeight = '0';
    gridWrapper.innerHTML = htmlSnippet;
    const grid = gridWrapper.querySelector('tbw-grid') as GridElement;

    // Selection output panel
    const outputPanel = document.createElement('div');
    outputPanel.style.cssText = `
      padding: 12px 16px;
      background: #1e1e1e;
      border-top: 1px solid #333;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      color: #d4d4d4;
      max-height: 120px;
      overflow-y: auto;
    `;
    outputPanel.innerHTML = `<span style="color: #6a9955;">// selection-change event output</span>`;

    host.appendChild(gridWrapper);
    host.appendChild(outputPanel);

    const codeSnippet = (__$mode$: SelectionMode) => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number' },
          { field: 'name', header: 'Name' },
          { field: 'department', header: 'Department' },
          { field: 'salary', header: 'Salary', type: 'number' },
          { field: 'email', header: 'Email' },
        ],
        plugins: [
          new SelectionPlugin({
            mode: __$mode$,
          }),
        ],
      };

      grid.rows = [
        { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, email: 'alice@example.com' },
        { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, email: 'bob@example.com' },
        { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, email: 'carol@example.com' },
        { id: 4, name: 'Dan', department: 'Sales', salary: 85000, email: 'dan@example.com' },
        { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, email: 'eve@example.com' },
        { id: 6, name: 'Frank', department: 'Engineering', salary: 98000, email: 'frank@example.com' },
      ];

      // Listen to unified selection-change event
      grid.addEventListener('selection-change', (e: CustomEvent<SelectionChangeDetail>) => {
        console.log('selection-change', e.detail);
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, args)}`;
    codeSnippet(args.mode);

    // Add event listener to update output panel
    grid.addEventListener('selection-change', (e: CustomEvent<SelectionChangeDetail>) => {
      const { mode, ranges } = e.detail;
      const rangesJson = JSON.stringify(ranges, null, 1)
        .replace(/"(\w+)":/g, '<span style="color: #9cdcfe;">$1</span>:')
        .replace(/: (\d+)/g, ': <span style="color: #b5cea8;">$1</span>');
      outputPanel.innerHTML = `
        <div style="margin-bottom: 4px;">
          <span style="color: #c586c0;">mode</span>: <span style="color: #ce9178;">"${mode}"</span>
        </div>
        <div>
          <span style="color: #c586c0;">ranges</span>: <span>${rangesJson}</span>
        </div>
      `;
    });

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-selection-demo',
      plugins: [{ className: 'SelectionPlugin', path: 'plugins/selection' }],
      description: `
        <p><strong>Current mode:</strong> <code>${args.mode}</code> — ${modeDescriptions[args.mode]}</p>
        <p>Use the mode control above to switch between <code>cell</code>, <code>row</code>, and <code>range</code> modes.</p>
        <p>The panel below the grid shows the <code>selection-change</code> event output in real-time.</p>
        <p><strong>Keyboard:</strong> <code>Escape</code> clears selection. In range mode, <code>Ctrl+A</code> selects all.</p>
      `,
    });
  },
};

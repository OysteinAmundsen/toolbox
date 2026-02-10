import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { SelectionPlugin } from './SelectionPlugin';
import type { SelectionMode } from './types';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins/Selection',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Selection plugin enables cell, row, and range selection with full keyboard support.

**Selection Modes:**
- \`cell\` - Single cell selection (click to select one cell)
- \`row\` - Row selection (click any cell to select the entire row)
- \`range\` - Range selection (shift+click or drag to select rectangles)

**Keyboard Shortcuts:**
- \`Escape\` - Clear selection
- \`Ctrl+A\` (range mode) - Select all cells
- \`Shift+Click\` - Extend selection
- Arrow keys - Navigate and extend selection with Shift held
        `,
      },
    },
  },
  argTypes: {
    mode: {
      control: { type: 'radio' },
      options: ['cell', 'row', 'range'],
      description: 'Selection mode determines what gets selected on click',
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

// Sample data for all selection stories
const sampleData = [
  { id: 1, name: 'Alice', department: 'Engineering', salary: 95000, email: 'alice@example.com' },
  { id: 2, name: 'Bob', department: 'Marketing', salary: 75000, email: 'bob@example.com' },
  { id: 3, name: 'Carol', department: 'Engineering', salary: 105000, email: 'carol@example.com' },
  { id: 4, name: 'Dan', department: 'Sales', salary: 85000, email: 'dan@example.com' },
  { id: 5, name: 'Eve', department: 'Marketing', salary: 72000, email: 'eve@example.com' },
  { id: 6, name: 'Frank', department: 'Engineering', salary: 98000, email: 'frank@example.com' },
  { id: 7, name: 'Grace', department: 'Sales', salary: 88000, email: 'grace@example.com' },
  { id: 8, name: 'Henry', department: 'HR', salary: 65000, email: 'henry@example.com' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary', type: 'number' as const },
  { field: 'email', header: 'Email' },
];

// Mutable ref so source.transform always reads the latest mode
let currentMode: SelectionMode = 'cell';

function getSelectionSourceCode(mode: SelectionMode): string {
  const modeHelpers =
    mode === 'row'
      ? `\n  // Row mode helpers\n  console.log('Selected rows:', plugin.getSelectedRowIndices());`
      : mode === 'range'
        ? `\n  // Range/cell helpers\n  console.log('Selected cells:', plugin.getSelectedCells());\n  console.log('Cell count:', plugin.getSelectedCells().length);`
        : `\n  // Cell helpers\n  console.log('Is (2,1) selected?', plugin.isCellSelected(2, 1));`;

  return `import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');
const plugin = new SelectionPlugin({ mode: '${mode}' });

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'salary', header: 'Salary', type: 'number' },
  ],
  plugins: [plugin],
};
grid.rows = [...];

// Listen for selection changes
grid.addEventListener('selection-change', () => {
  const sel = plugin.getSelection();
  console.log('Mode:', sel.mode);
  console.log('Ranges:', sel.ranges);${modeHelpers}
});`;
}

/**
 * Interactive selection demo with mode switcher. Use the controls to switch
 * between cell, row, and range selection modes.
 */
export const Default: Story = {
  args: {
    mode: 'cell',
  },
  parameters: {
    docs: {
      source: {
        language: 'typescript',
        // Dynamic source code based on current mode control
        transform: () => getSelectionSourceCode(currentMode),
      },
    },
  },
  render: (args: SelectionArgs) => {
    currentMode = args.mode;

    const container = document.createElement('div');

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    grid.style.display = 'block';

    const plugin = new SelectionPlugin({ mode: args.mode });
    grid.gridConfig = {
      columns,
      plugins: [plugin],
    };
    grid.rows = sampleData;

    // Selection state panel
    const panel = document.createElement('div');
    panel.style.cssText =
      'margin-top: 12px; padding: 12px; border: 1px solid var(--sb-border, #ccc); border-radius: 4px; font-family: monospace; font-size: 12px; background: var(--sbdocs-bg, #fafafa); max-height: 160px; overflow-y: auto;';
    panel.innerHTML = '<span style="color: var(--sbdocs-fg, #666);">Click or drag to see selection state…</span>';

    const updatePanel = () => {
      const sel = plugin.getSelection();
      const lines: string[] = [`<b>mode:</b> '${sel.mode}'`];

      if (sel.mode === 'row') {
        const indices = plugin.getSelectedRowIndices();
        lines.push(`<b>selectedRows:</b> [${indices.join(', ')}]`);
        if (indices.length > 0) {
          const names = indices.map((i) => sampleData[i]?.name).filter(Boolean);
          lines.push(`<b>rowData:</b> ${names.map((n) => `"${n}"`).join(', ')}`);
        }
      }

      if (sel.ranges.length > 0) {
        const rangeStrs = sel.ranges.map(
          (r) => `{ from: {row:${r.from.row}, col:${r.from.col}}, to: {row:${r.to.row}, col:${r.to.col}} }`,
        );
        lines.push(
          `<b>ranges:</b> [${rangeStrs.length > 2 ? '\n  ' + rangeStrs.join(',\n  ') + '\n' : rangeStrs.join(', ')}]`,
        );

        if (sel.mode === 'range') {
          const cells = plugin.getSelectedCells();
          lines.push(`<b>cellCount:</b> ${cells.length}`);
        }
      } else {
        lines.push('<b>ranges:</b> []');
      }

      if (sel.anchor) {
        lines.push(`<b>anchor:</b> {row:${sel.anchor.row}, col:${sel.anchor.col}}`);
      }

      panel.innerHTML = lines.join('<br>');
    };

    grid.addEventListener('selection-change', updatePanel);

    container.appendChild(grid);
    container.appendChild(panel);
    return container;
  },
};

// Sample data with status for conditional selection demo
const statusData = [
  { id: 1, name: 'Alice', department: 'Engineering', status: 'active' },
  { id: 2, name: 'Bob', department: 'Marketing', status: 'locked' },
  { id: 3, name: 'Carol', department: 'Engineering', status: 'active' },
  { id: 4, name: 'Dan', department: 'Sales', status: 'locked' },
  { id: 5, name: 'Eve', department: 'Marketing', status: 'active' },
  { id: 6, name: 'Frank', department: 'Engineering', status: 'active' },
  { id: 7, name: 'Grace', department: 'Sales', status: 'locked' },
  { id: 8, name: 'Henry', department: 'HR', status: 'active' },
];

/**
 * Conditional selection using `isSelectable` callback.
 *
 * This example demonstrates how to prevent selection of specific rows based on
 * their data. Rows with `status: 'locked'` cannot be selected and are visually
 * dimmed with a `not-allowed` cursor.
 *
 * **Key features:**
 * - Locked rows show muted styling via `[data-selectable="false"]` attribute
 * - Click events are ignored on non-selectable rows
 * - Keyboard navigation skips selection for non-selectable rows
 * - Focus remains navigable (you can still arrow through locked rows)
 */
export const ConditionalSelection: Story = {
  args: { mode: 'row' },
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'department', header: 'Department' },
    { field: 'status', header: 'Status' },
  ],
  plugins: [
    new SelectionPlugin({
      mode: 'row',
      // Prevent selection of locked rows
      isSelectable: (row) => row.status !== 'locked',
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', department: 'Engineering', status: 'active' },
  { id: 2, name: 'Bob', department: 'Marketing', status: 'locked' },
  { id: 3, name: 'Carol', department: 'Engineering', status: 'active' },
  // ...
];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    grid.style.display = 'block';

    const statusColumns = [
      { field: 'id', header: 'ID', type: 'number' as const },
      { field: 'name', header: 'Name' },
      { field: 'department', header: 'Department' },
      { field: 'status', header: 'Status' },
    ];

    grid.gridConfig = {
      columns: statusColumns,
      plugins: [
        new SelectionPlugin({
          mode: 'row',
          isSelectable: (row: { status: string }) => row.status !== 'locked',
        }),
      ],
    };
    grid.rows = statusData;

    return grid;
  },
};

/**
 * Row selection with checkbox column — adds a checkbox as the first column with
 * a "select all" checkbox in the header. Supports Ctrl+Click to toggle individual
 * rows and Shift+Click to select a contiguous range.
 */
export const CheckboxSelection: Story = {
  args: { mode: 'row' },
  parameters: {
    docs: {
      source: {
        code: `
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [
    new SelectionPlugin({ mode: 'row', checkbox: true }),
  ],
};
grid.rows = [...];
`,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';
    grid.style.display = 'block';

    grid.gridConfig = {
      columns,
      plugins: [new SelectionPlugin({ mode: 'row', checkbox: true })],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * ## Selection Events
 *
 * The SelectionPlugin emits events when selection state changes:
 * - `selection-change` - Fired when the selection is modified
 *
 * Click cells or rows, use Shift+Click for ranges, or Ctrl+A to select all.
 */
export const SelectionEvents: Story = {
  args: { mode: 'range' },
  parameters: {
    docs: {
      source: {
        code: `
const grid = document.querySelector('tbw-grid');

grid.addEventListener('selection-change', (e) => {
  console.log('Mode:', e.detail.mode);
  console.log('Ranges:', e.detail.ranges);
  console.log('Selected rows:', e.detail.selectedRows?.length);
});
        `,
        language: 'typescript',
      },
    },
  },
  render: (args) => {
    const container = document.createElement('div');
    container.style.cssText = 'display: grid; grid-template-columns: 1fr 320px; gap: 16px;';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.id = 'selection-events-grid';
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID', type: 'number' as const },
        { field: 'name', header: 'Name' },
        { field: 'department', header: 'Department' },
        { field: 'salary', header: 'Salary', type: 'number' as const },
      ],
      plugins: [new SelectionPlugin({ mode: args.mode as SelectionMode })],
    };

    grid.rows = [
      { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 85000 },
      { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 72000 },
      { id: 3, name: 'Carol White', department: 'Sales', salary: 68000 },
      { id: 4, name: 'David Brown', department: 'Engineering', salary: 92000 },
      { id: 5, name: 'Eve Davis', department: 'HR', salary: 65000 },
    ];

    // Event log panel
    const logPanel = document.createElement('div');
    logPanel.style.cssText =
      'border: 1px solid var(--sb-border); padding: 12px; border-radius: 4px; background: var(--sbdocs-bg); overflow-y: auto; max-height: 300px;';
    logPanel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong>Event Log:</strong>
        <button id="clear-log" style="padding: 4px 8px; cursor: pointer; font-size: 12px;">Clear</button>
      </div>
      <div id="event-log" style="font-family: monospace; font-size: 11px; color: var(--sbdocs-fg);"></div>
    `;

    container.appendChild(grid);
    container.appendChild(logPanel);

    // Setup event listeners
    setTimeout(() => {
      const log = container.querySelector('#event-log');
      const clearBtn = container.querySelector('#clear-log');

      if (!log) return;

      const addLog = (type: string, detail: string) => {
        const msg = document.createElement('div');
        msg.style.cssText = 'padding: 2px 0; border-bottom: 1px solid var(--sb-border);';
        msg.innerHTML = `<span style="color: var(--sb-accent-color);">[${type}]</span> ${detail}`;
        log.insertBefore(msg, log.firstChild);
        while (log.children.length > 15) {
          log.lastChild?.remove();
        }
      };

      clearBtn?.addEventListener('click', () => {
        log.innerHTML = '';
      });

      grid.addEventListener('selection-change', (e: CustomEvent) => {
        const d = e.detail;
        const rangeCount = d.ranges?.length || 0;
        const cellCount = d.ranges?.reduce(
          (sum: number, r: { from: { row: number; col: number }; to: { row: number; col: number } }) => {
            const rows = Math.abs(r.to.row - r.from.row) + 1;
            const cols = Math.abs(r.to.col - r.from.col) + 1;
            return sum + rows * cols;
          },
          0,
        );
        addLog('selection-change', `mode="${d.mode}", ${rangeCount} range(s), ${cellCount} cell(s)`);
      });
    }, 50);

    return container;
  },
};

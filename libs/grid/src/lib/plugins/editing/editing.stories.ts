import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { EditingPlugin } from './EditingPlugin';

// Import grid component for side effects
import '../../../';

const meta: Meta = {
  title: 'Grid/Plugins/Editing',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj;

/**
 * ## Add/Remove Rows
 *
 * Demonstrates how to dynamically add and remove rows from the grid.
 * Click "+ Add Row" to insert a new editable row, or click the delete button to remove a row.
 */
export const AddRemoveRows: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = queryGrid('tbw-grid');
const addButton = document.querySelector('#add-row-btn');

let idCounter = 4;

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name', editable: true },
    { field: 'email', header: 'Email', editable: true },
    {
      field: 'actions',
      header: 'Actions',
      renderer: (ctx) => {
        const btn = document.createElement('button');
        btn.textContent = 'Delete';
        btn.onclick = () => {
          const idx = grid.rows.findIndex(r => r.id === ctx.row.id);
          if (idx >= 0) grid.removeRow(idx);
        };
        return btn;
      },
    },
  ],
  plugins: [new EditingPlugin({ editOn: 'dblclick' })],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Carol', email: 'carol@example.com' },
];

// Add new row when button is clicked
addButton.addEventListener('click', () => {
  grid.insertRow(grid.rows.length, { id: idCounter++, name: '', email: '' });
});
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; height: 350px;';

    // Toolbar with Add Row button
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'padding: 8px; border-bottom: 1px solid #e5e7eb; display: flex; gap: 8px;';

    const addBtn = document.createElement('button');
    addBtn.textContent = '+ Add Row';
    addBtn.style.cssText = `
      padding: 6px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    `;
    toolbar.appendChild(addBtn);
    container.appendChild(toolbar);

    // Grid
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'flex: 1;';

    let idCounter = 4;

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name', editable: true },
        { field: 'email', header: 'Email', editable: true },
        {
          field: 'actions',
          header: 'Actions',
          renderer: (ctx) => {
            const btn = document.createElement('button');
            btn.textContent = 'Delete';
            btn.style.cssText = `
              padding: 4px 8px;
              background: #ef4444;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            `;
            btn.onclick = () => {
              const idx = grid.rows.findIndex((r) => r.id !== undefined && r.id === ctx.row.id);
              if (idx >= 0) grid.removeRow(idx);
            };
            return btn;
          },
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
      { id: 3, name: 'Carol', email: 'carol@example.com' },
    ];

    addBtn.addEventListener('click', () => {
      grid.insertRow(grid.rows.length, { id: idCounter++, name: '', email: '' });
    });

    container.appendChild(grid);
    return container;
  },
};

/**
 * ## Basic Editing
 *
 * Enable inline cell editing with the EditingPlugin. Double-click a cell to edit,
 * press Enter to commit, or Escape to cancel.
 */
export const BasicEditing: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import '@toolbox-web/grid';
import { queryGrid } from '@toolbox-web/grid';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = queryGrid('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name', editable: true },
    { field: 'score', header: 'Score', type: 'number', editable: true },
    { field: 'role', header: 'Role', type: 'select', editable: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
        { label: 'Guest', value: 'guest' },
      ]
    },
  ],
  plugins: [new EditingPlugin({ editOn: 'dblclick' })],
};

grid.rows = [
  { name: 'Alice', score: 95, role: 'admin' },
  { name: 'Bob', score: 82, role: 'user' },
  { name: 'Carol', score: 91, role: 'guest' },
];

grid.addEventListener('cell-commit', (e) => {
  console.log('Edited:', e.detail.field, '→', e.detail.newValue);
});
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        { field: 'score', header: 'Score', type: 'number', editable: true },
        {
          field: 'role',
          header: 'Role',
          type: 'select',
          editable: true,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
            { label: 'Guest', value: 'guest' },
          ],
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { name: 'Alice', score: 95, role: 'admin' },
      { name: 'Bob', score: 82, role: 'user' },
      { name: 'Carol', score: 91, role: 'guest' },
    ];

    grid.addEventListener('cell-commit', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('Edited:', detail.field, '→', detail.newValue);
    });

    return grid;
  },
};

/**
 * ## Click to Edit
 *
 * Configure single-click editing instead of double-click.
 */
export const ClickToEdit: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name', editable: true },
    { field: 'email', header: 'Email', editable: true },
  ],
  plugins: [new EditingPlugin({ editOn: 'click' })],
};
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '250px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        { field: 'email', header: 'Email', editable: true },
      ],
      plugins: [new EditingPlugin({ editOn: 'click' })],
    };

    grid.rows = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Carol', email: 'carol@example.com' },
    ];

    return grid;
  },
};

/**
 * ## All Column Types
 *
 * The EditingPlugin provides built-in editors for all column types:
 * string, number, boolean, date, and select.
 */
export const AllColumnTypes: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name (string)', editable: true },
    { field: 'age', header: 'Age (number)', type: 'number', editable: true },
    { field: 'active', header: 'Active (boolean)', type: 'boolean', editable: true },
    { field: 'joined', header: 'Joined (date)', type: 'date', editable: true },
    { field: 'role', header: 'Role (select)', type: 'select', editable: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ]
    },
  ],
  plugins: [new EditingPlugin()],
};
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name (string)', editable: true },
        { field: 'age', header: 'Age (number)', type: 'number', editable: true },
        { field: 'active', header: 'Active (boolean)', type: 'boolean', editable: true },
        { field: 'joined', header: 'Joined (date)', type: 'date', editable: true },
        {
          field: 'role',
          header: 'Role (select)',
          type: 'select',
          editable: true,
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'User', value: 'user' },
          ],
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { name: 'Alice', age: 28, active: true, joined: new Date('2023-01-15'), role: 'admin' },
      { name: 'Bob', age: 34, active: false, joined: new Date('2023-06-20'), role: 'user' },
      { name: 'Carol', age: 25, active: true, joined: new Date('2024-02-10'), role: 'user' },
    ];

    return grid;
  },
};

/**
 * ## Editor Parameters
 *
 * Use `editorParams` to configure built-in editors with constraints and placeholders.
 * Each editor type has its own set of parameters.
 */
export const EditorParameters: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.gridConfig = {
  columns: [
    // Number with min/max/step
    { field: 'price', header: 'Price', type: 'number', editable: true,
      editorParams: { min: 0, max: 1000, step: 0.01, placeholder: '0.00' }
    },
    // Text with maxLength and pattern
    { field: 'code', header: 'Product Code', editable: true,
      editorParams: { maxLength: 10, pattern: '[A-Z0-9]+', placeholder: 'ABC123' }
    },
    // Date with min/max range
    { field: 'expiry', header: 'Expiry Date', type: 'date', editable: true,
      editorParams: { min: '2024-01-01', max: '2030-12-31' }
    },
    // Select with empty option
    { field: 'status', header: 'Status', type: 'select', editable: true,
      options: [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }],
      editorParams: { includeEmpty: true, emptyLabel: '-- Select --' }
    },
  ],
  plugins: [new EditingPlugin()],
};
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        {
          field: 'price',
          header: 'Price',
          type: 'number',
          editable: true,
          editorParams: { min: 0, max: 1000, step: 0.01, placeholder: '0.00' },
        },
        {
          field: 'code',
          header: 'Product Code',
          editable: true,
          editorParams: { maxLength: 10, pattern: '[A-Z0-9]+', placeholder: 'ABC123' },
        },
        {
          field: 'expiry',
          header: 'Expiry Date',
          type: 'date',
          editable: true,
          editorParams: { min: '2024-01-01', max: '2030-12-31' },
        },
        {
          field: 'status',
          header: 'Status',
          type: 'select',
          editable: true,
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ],
          editorParams: { includeEmpty: true, emptyLabel: '-- Select --' },
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { price: 29.99, code: 'PROD001', expiry: new Date('2025-06-15'), status: 'active' },
      { price: 149.5, code: 'PROD002', expiry: new Date('2026-01-01'), status: 'inactive' },
      { price: null, code: '', expiry: null, status: '' },
    ];

    return grid;
  },
};

/**
 * ## Custom Editor
 *
 * Provide a custom `editor` function for specialized input controls.
 * Use CSS classes to manage selection state instead of inline styles.
 * Register styles via `grid.registerStyles()` to inject CSS for your custom editor.
 */
export const CustomEditor: Story = {
  parameters: {
    docs: {
      source: {
        code: `
// Register custom styles for the editor
grid.registerStyles('priority-editor', \`
  .data-grid-row > .cell.editing:has(.priority-editor) {
    justify-content: start;
  }
  .priority-editor {
    display: flex;
    gap: 4px;
    padding: 2px;
  }
  .priority-editor button {
    --button-background: light-dark(#ffffff, #333333);
    --button-color: light-dark(#333333, #ffffff);
    padding: 2px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: var(--button-background);
    color: var(--button-color);
    cursor: pointer;
    user-select: none;
  }
  .priority-editor button.selected {
    --button-background: #3b82f6;
    --button-color: #ffffff;
  }
\`);

grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name', editable: true },
    {
      field: 'priority',
      header: 'Priority',
      editable: true,
      editor: (ctx) => {
        const container = document.createElement('div');
        container.className = 'priority-editor';

        ['Low', 'Medium', 'High'].forEach(level => {
          const btn = document.createElement('button');
          btn.textContent = level;
          if (ctx.value === level) btn.classList.add('selected');

          btn.onclick = () => {
            // Remove selected from siblings, add to clicked
            container.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            ctx.commit(level);
          };
          container.appendChild(btn);
        });

        return container;
      },
    },
  ],
  plugins: [new EditingPlugin()],
};
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;

    // Register custom styles for the editor
    grid.registerStyles(
      'priority-editor',
      `
      .data-grid-row > .cell.editing:has(.priority-editor) {
        justify-content: start;
      }
      .priority-editor {
        display: flex;
        gap: 4px;
        padding: 2px;
      }
      .priority-editor button {
        --button-background: light-dark(#ffffff, #333333);
        --button-color: light-dark(#333333, #ffffff);
        padding: 2px 8px;
        border: 1px solid #ccc;
        border-radius: 3px;
        background: var(--button-background);
        color: var(--button-color);
        cursor: pointer;
        user-select: none;
      }
      .priority-editor button.selected {
        --button-background: #3b82f6;
        --button-color: #ffffff;
      }
    `,
    );
    grid.style.height = '250px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        {
          field: 'priority',
          header: 'Priority',
          editable: true,
          editor: (ctx) => {
            const editorEl = document.createElement('div');
            editorEl.className = 'priority-editor';

            ['Low', 'Medium', 'High'].forEach((level) => {
              const btn = document.createElement('button');
              btn.textContent = level;
              if (ctx.value === level) btn.classList.add('selected');

              btn.onclick = () => {
                // Remove selected from siblings, add to clicked
                editorEl.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                ctx.commit(level);
              };
              editorEl.appendChild(btn);
            });

            return editorEl;
          },
        },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { name: 'Task A', priority: 'High' },
      { name: 'Task B', priority: 'Medium' },
      { name: 'Task C', priority: 'Low' },
    ];

    return grid;
  },
};

/**
 * ## Editing Events
 *
 * The EditingPlugin emits events during the editing lifecycle:
 * - `edit-open` - Fired when a row enters edit mode (row mode only)
 * - `edit-close` - Fired when a row exits edit mode, whether committed or cancelled (row mode only)
 * - `cell-commit` - Fired when a cell value is committed (Enter, blur, or programmatic)
 * - `row-commit` - Fired when a row is committed after bulk edit mode
 * - `changed-rows-reset` - Fired when the changed rows tracking is reset
 *
 * Double-click a cell to edit, then press Enter or click away to see events.
 */
export const EditingEvents: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import { queryGrid } from '@toolbox-web/grid';

const grid = queryGrid('tbw-grid');

// Row edit session started (row mode only)
grid.addEventListener('edit-open', (e) => {
  console.log('Edit opened: row', e.detail.rowIndex, e.detail.rowId);
});

// Row edit session ended (row mode only, fires on both commit and cancel)
grid.addEventListener('edit-close', (e) => {
  console.log('Edit closed: row', e.detail.rowIndex, 'reverted:', e.detail.reverted);
});

// Cell value committed
grid.addEventListener('cell-commit', (e) => {
  console.log('Committed:', e.detail.field, e.detail.oldValue, '→', e.detail.value);
});

// Row editing session ended
grid.addEventListener('row-commit', (e) => {
  console.log('Row committed:', e.detail.rowId, 'changed:', e.detail.changed);
});

// Changed rows tracking reset
grid.addEventListener('changed-rows-reset', (e) => {
  console.log('Reset:', e.detail.rows.length, 'rows cleared');
});
        `,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: grid; grid-template-columns: 1fr 320px; gap: 16px;';

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.id = 'editing-events-grid';
    grid.style.height = '300px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        { field: 'department', header: 'Department', editable: true },
        { field: 'salary', header: 'Salary', type: 'number' as const, editable: true },
      ],
      plugins: [new EditingPlugin({ editOn: 'dblclick' })],
    };

    grid.rows = [
      { id: 1, name: 'Alice Johnson', department: 'Engineering', salary: 85000 },
      { id: 2, name: 'Bob Smith', department: 'Marketing', salary: 72000 },
      { id: 3, name: 'Carol White', department: 'Sales', salary: 68000 },
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

      grid.addEventListener('edit-open', (e) => {
        const d = e.detail;
        addLog('edit-open', `row ${d.rowIndex} (${d.rowId})`);
      });

      grid.addEventListener('edit-close', (e) => {
        const d = e.detail;
        addLog('edit-close', `row ${d.rowIndex} (${d.rowId}), reverted: ${d.reverted}`);
      });

      grid.addEventListener('cell-commit', (e) => {
        const d = e.detail;
        addLog('cell-commit', `field="${d.field}", "${d.oldValue}" → "${d.value}"`);
      });

      grid.addEventListener('row-commit', (e) => {
        const d = e.detail;
        addLog('row-commit', `row ${d.rowIndex} (${d.rowId}), changed: ${d.changed}`);
      });

      grid.addEventListener('changed-rows-reset', (e) => {
        addLog('changed-rows-reset', `${e.detail.rows?.length || 0} rows cleared`);
      });
    }, 50);

    return container;
  },
};

/**
 * ## Cell Validation
 *
 * Use `setInvalid()` in the `cell-commit` event to mark cells as invalid without
 * canceling the edit. Invalid cells are highlighted and can be styled with CSS.
 *
 * Use `preventDefault()` in `row-commit` to reject the entire row if it has
 * invalid cells, reverting all changes to the original values.
 *
 * - **Email**: Must contain `@`
 * - **Salary**: Must be positive
 *
 * Try entering invalid values, then click away from the row to see validation in action.
 */
export const CellValidation: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import { queryGrid } from '@toolbox-web/grid';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = queryGrid('tbw-grid');
const editingPlugin = new EditingPlugin({ editOn: 'dblclick' });

grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name', editable: true },
    { field: 'email', header: 'Email', editable: true },
    { field: 'salary', header: 'Salary', type: 'number', editable: true },
  ],
  plugins: [editingPlugin],
};

// Mark invalid cells (but don't cancel the edit)
grid.addEventListener('cell-commit', (e) => {
  const { field, value, setInvalid } = e.detail;

  if (field === 'email' && typeof value === 'string' && !value.includes('@')) {
    setInvalid('Email must contain @');
  }

  if (field === 'salary' && typeof value === 'number' && value < 0) {
    setInvalid('Salary must be positive');
  }
});

// Reject row commit if there are invalid cells
grid.addEventListener('row-commit', (e) => {
  const { rowId } = e.detail;
  if (editingPlugin.hasInvalidCells(rowId)) {
    e.preventDefault(); // Reverts entire row to original values
    alert('Please fix validation errors before leaving the row');
  }
});
        `,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const instructions = document.createElement('div');
    instructions.style.cssText =
      'padding: 12px; background: var(--sbdocs-bg); border: 1px solid var(--sb-border); border-radius: 4px; font-size: 13px;';
    instructions.innerHTML = `
      <strong>Validation Rules:</strong>
      <ul style="margin: 8px 0 0 16px; padding: 0;">
        <li><strong>Email</strong>: Must contain @</li>
        <li><strong>Salary</strong>: Must be positive (&gt; 0)</li>
      </ul>
      <p style="margin: 8px 0 0;">Try entering invalid values, then click outside the row.</p>
    `;
    container.appendChild(instructions);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '250px';

    const editingPlugin = new EditingPlugin<{ id: number; name: string; email: string; salary: number }>({
      editOn: 'dblclick',
    });

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        { field: 'email', header: 'Email', editable: true },
        { field: 'salary', header: 'Salary', type: 'number' as const, editable: true },
      ],
      plugins: [editingPlugin],
    };

    grid.rows = [
      { id: 1, name: 'Alice', email: 'alice@example.com', salary: 85000 },
      { id: 2, name: 'Bob', email: 'bob@example.com', salary: 72000 },
      { id: 3, name: 'Carol', email: 'carol@example.com', salary: 68000 },
    ];

    // Mark invalid cells (but don't cancel the edit)
    grid.addEventListener('cell-commit', (e) => {
      const { field, value, setInvalid } = e.detail;

      if (field === 'email' && typeof value === 'string' && !value.includes('@')) {
        setInvalid('Email must contain @');
      }

      if (field === 'salary' && typeof value === 'number' && value < 0) {
        setInvalid('Salary must be positive');
      }
    });

    // Reject row commit if there are invalid cells
    grid.addEventListener('row-commit', (e) => {
      const { rowId } = e.detail;
      if (editingPlugin.hasInvalidCells(rowId)) {
        e.preventDefault(); // Reverts entire row to original values
        // In real app, show a toast or inline message instead of alert
        console.warn('Row reverted due to validation errors');
      }
    });

    container.appendChild(grid);
    return container;
  },
};

/**
 * Grid Mode - All Cells Always Editable
 *
 * Set `mode: 'grid'` to make all editable cells show their editors at all times,
 * similar to a spreadsheet. This mode:
 * - Renders editors immediately on load (no click/dblclick required)
 * - Keeps editors visible after committing values
 * - Ignores Escape and click-outside (no "exit edit mode")
 * - Uses Tab/Shift+Tab for navigation between editable cells
 *
 * Ideal for data entry forms or spreadsheet-like interfaces.
 */
export const GridMode: Story = {
  name: 'Grid Mode (Spreadsheet)',
  tags: ['!autodocs'],
  parameters: {
    docs: {
      source: {
        code: `
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID' }, // Not editable
    { field: 'product', header: 'Product', editable: true },
    { field: 'quantity', header: 'Qty', type: 'number', editable: true },
    { field: 'price', header: 'Price', type: 'number', editable: true },
  ],
  plugins: [new EditingPlugin({ mode: 'grid' })], // All cells always editable
};

// Listen for cell changes
grid.addEventListener('cell-commit', (e) => {
  console.log('Updated:', e.detail.field, '=', e.detail.value);
});
        `,
        language: 'typescript',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const instructions = document.createElement('div');
    instructions.style.cssText =
      'padding: 12px; background: var(--sbdocs-bg); border: 1px solid var(--sb-border); border-radius: 4px; font-size: 13px;';
    instructions.innerHTML = `
      <strong>Grid Mode:</strong> All editable cells show editors immediately.
      <ul style="margin: 8px 0 0 16px; padding: 0;">
        <li><strong>Tab/Shift+Tab</strong>: Move between editable cells</li>
        <li><strong>Enter</strong>: Commit current cell value</li>
        <li>Click outside or press Escape: No effect (always in edit mode)</li>
      </ul>
    `;
    container.appendChild(instructions);

    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '250px';

    const editingPlugin = new EditingPlugin({ mode: 'grid' });

    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'product', header: 'Product', editable: true },
        { field: 'quantity', header: 'Qty', type: 'number' as const, editable: true },
        { field: 'price', header: 'Price', type: 'number' as const, editable: true },
      ],
      plugins: [editingPlugin],
    };

    grid.rows = [
      { id: 1, product: 'Widget A', quantity: 10, price: 9.99 },
      { id: 2, product: 'Widget B', quantity: 5, price: 14.99 },
      { id: 3, product: 'Gadget X', quantity: 3, price: 29.99 },
      { id: 4, product: 'Gadget Y', quantity: 8, price: 19.99 },
    ];

    // Log cell commits
    grid.addEventListener('cell-commit', (e) => {
      const log = container.querySelector('.event-log');
      if (log) {
        const entry = document.createElement('div');
        entry.textContent = `${e.detail.field} = ${JSON.stringify(e.detail.value)}`;
        log.insertBefore(entry, log.firstChild);
        // Keep only last 5 entries
        while (log.children.length > 5) {
          log.removeChild(log.lastChild!);
        }
      }
    });

    container.appendChild(grid);

    const logSection = document.createElement('div');
    logSection.innerHTML = `
      <strong style="font-size: 12px;">Recent Changes:</strong>
      <div class="event-log" style="font-family: monospace; font-size: 11px; max-height: 80px; overflow: auto; padding: 8px; background: var(--sb-low-color); border-radius: 4px; margin-top: 4px;"></div>
    `;
    container.appendChild(logSection);

    return container;
  },
};

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
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = document.querySelector('tbw-grid');
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
          grid.rows = grid.rows.filter(r => r.id !== ctx.row.id);
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
  grid.rows = [
    ...grid.rows,
    { id: idCounter++, name: '', email: '' },
  ];
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
              grid.rows = grid.rows.filter((r) => r.id !== ctx.row.id);
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
      grid.rows = [...grid.rows, { id: idCounter++, name: '', email: '' }];
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
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

const grid = document.querySelector('tbw-grid');

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
 * ## Custom Editor
 *
 * Provide a custom `editor` function for specialized input controls.
 * Use CSS classes to manage selection state instead of inline styles.
 * Register styles via `grid.registerStyles()` to inject CSS into the shadow DOM.
 */
export const CustomEditor: Story = {
  parameters: {
    docs: {
      source: {
        code: `
// Register CSS in the grid's shadow DOM (required for shadow DOM styling)
grid.registerStyles('priority-editor', \`
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

    // Register styles in the grid's shadow DOM using adoptedStyleSheets
    grid.registerStyles(
      'priority-editor',
      `
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

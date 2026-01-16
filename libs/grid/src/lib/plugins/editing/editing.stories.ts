import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { EditingPlugin } from './EditingPlugin';

// Import grid component for side effects
import '../../../';

const meta: Meta = {
  title: 'Grid/Plugins/Editing',
  tags: ['!dev'],
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj;

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
 */
export const CustomEditor: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name', editable: true },
    {
      field: 'priority',
      header: 'Priority',
      editable: true,
      editor: (ctx) => {
        const container = document.createElement('div');
        container.style.cssText = 'display: flex; gap: 4px; padding: 2px;';

        ['Low', 'Medium', 'High'].forEach(level => {
          const btn = document.createElement('button');
          btn.textContent = level;
          btn.style.cssText = \`
            padding: 2px 8px; border: 1px solid #ccc; border-radius: 3px;
            background: \${ctx.value === level ? '#3b82f6' : '#fff'};
            color: \${ctx.value === level ? '#fff' : '#333'};
            cursor: pointer;
          \`;
          btn.onclick = () => ctx.commit(level);
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
    grid.style.height = '250px';

    grid.gridConfig = {
      columns: [
        { field: 'name', header: 'Name', editable: true },
        {
          field: 'priority',
          header: 'Priority',
          editable: true,
          editor: (ctx) => {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; gap: 4px; padding: 2px;';

            ['Low', 'Medium', 'High'].forEach((level) => {
              const btn = document.createElement('button');
              btn.textContent = level;
              btn.style.cssText = `
                padding: 2px 8px; border: 1px solid #ccc; border-radius: 3px;
                background: ${ctx.value === level ? '#3b82f6' : '#fff'};
                color: ${ctx.value === level ? '#fff' : '#333'};
                cursor: pointer;
              `;
              btn.onclick = () => ctx.commit(level);
              container.appendChild(btn);
            });

            return container;
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

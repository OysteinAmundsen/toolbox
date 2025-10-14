import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { VisibilityPlugin } from './VisibilityPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * ## Column Visibility Plugin
 *
 * The visibility plugin adds a collapsible sidebar panel for toggling column visibility.
 * Click the ☰ button in the top-right corner to open the panel.
 *
 * Column visibility is a core grid feature. The plugin provides:
 * - A sidebar UI with checkboxes for each column
 * - A "Show All" button to restore all columns
 * - Columns with `lockVisible: true` cannot be hidden
 *
 * The grid emits `column-visibility` events when visibility changes, allowing you to
 * save user preferences.
 */
export const ColumnVisibility: Story = {
  render: () => {
    const host = document.createElement('div');
    host.style.cssText = 'position: relative; width: 100%; height: 100%;';
    host.innerHTML = `<tbw-grid></tbw-grid>`;

    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', lockVisible: true }, // Cannot be hidden
          { field: 'name', header: 'Name' },
          { field: 'email', header: 'Email', hidden: true }, // Hidden initially
          { field: 'department', header: 'Department' },
          { field: 'salary', header: 'Salary', type: 'number' },
        ],
        plugins: [new VisibilityPlugin()],
      };

      grid.rows = [
        { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', salary: 95000 },
        { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing', salary: 75000 },
        { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering', salary: 105000 },
        { id: 4, name: 'David', email: 'david@example.com', department: 'Sales', salary: 65000 },
        { id: 5, name: 'Eve', email: 'eve@example.com', department: 'HR', salary: 70000 },
      ];

      // Listen for visibility changes (for saving user preferences)
      grid.addEventListener('column-visibility', (e: Event) => {
        console.log('column-visibility', (e as CustomEvent).detail);
        // Here you could save to localStorage, server, etc.
      });
    };

    const jsSnippet = `${extractCode(codeSnippet, {})}`;
    codeSnippet();

    const htmlSnippet = `<tbw-grid></tbw-grid>`;

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-visibility',
      plugins: [{ className: 'VisibilityPlugin', path: 'plugins/visibility' }],
      description: `
        <p><strong>Click the ☰ button</strong> in the top-right corner to open the visibility panel.</p>
        <p>Features:</p>
        <ul>
          <li>Toggle checkboxes to show/hide columns</li>
          <li>"Show All" button restores all columns</li>
          <li>ID column has <code>lockVisible: true</code> (cannot be hidden)</li>
          <li>Email column starts with <code>hidden: true</code></li>
        </ul>
        <p>The grid emits <code>column-visibility</code> events for saving preferences.</p>
      `,
    });
  },
};

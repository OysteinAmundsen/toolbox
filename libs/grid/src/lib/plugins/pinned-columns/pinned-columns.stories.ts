import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { buildExclusiveGridCodeView, extractCode } from '@toolbox/storybook/_utils';
import type { GridElement } from '../../../public';
import { PinnedColumnsPlugin } from './PinnedColumnsPlugin';

// Import grid
import '../../../index';

const meta: Meta = {
  title: 'Grid/Plugins',
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj;

/**
 * ## Pinned (Sticky) Columns
 *
 * Pin columns to the left or right side of the grid.
 * Pinned columns stay visible when scrolling horizontally.
 *
 * Set `sticky: 'left'` or `sticky: 'right'` on column config.
 */
export const PinnedColumns: Story = {
  render: () => {
    const host = document.createElement('div');
    const htmlSnippet = `<tbw-grid></tbw-grid>`;
    host.innerHTML = htmlSnippet;
    const grid = host.querySelector('tbw-grid') as GridElement;

    const codeSnippet = () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
          { field: 'name', header: 'Name', width: 150, sticky: 'left' },
          { field: 'email', header: 'Email', width: 200 },
          { field: 'department', header: 'Department', width: 150 },
          { field: 'phone', header: 'Phone', width: 150 },
          { field: 'address', header: 'Address', width: 250 },
          { field: 'city', header: 'City', width: 120 },
          { field: 'country', header: 'Country', width: 120 },
          { field: 'actions', header: 'Actions', width: 100, sticky: 'right' },
        ],
        fitMode: 'fixed',
        plugins: [new PinnedColumnsPlugin()],
      };

      grid.rows = [
        {
          id: 1,
          name: 'Alice Johnson',
          email: 'alice@example.com',
          department: 'Engineering',
          phone: '+1-555-0101',
          address: '123 Main St',
          city: 'New York',
          country: 'USA',
          actions: '...',
        },
        {
          id: 2,
          name: 'Bob Smith',
          email: 'bob@example.com',
          department: 'Marketing',
          phone: '+1-555-0102',
          address: '456 Oak Ave',
          city: 'Los Angeles',
          country: 'USA',
          actions: '...',
        },
        {
          id: 3,
          name: 'Carol Williams',
          email: 'carol@example.com',
          department: 'Sales',
          phone: '+1-555-0103',
          address: '789 Pine Rd',
          city: 'Chicago',
          country: 'USA',
          actions: '...',
        },
      ];
    };

    const jsSnippet = `${extractCode(codeSnippet, {})}`;
    codeSnippet();

    return buildExclusiveGridCodeView(host, htmlSnippet, jsSnippet, {
      start: 'grid',
      sessionKey: 'grid-pinned-columns',
      plugins: [{ className: 'PinnedColumnsPlugin', path: 'plugins/pinned-columns' }],
      description: `
        <p>The <strong>Pinned Columns</strong> plugin keeps columns fixed while scrolling horizontally.</p>
        <p><strong>Try it:</strong> Scroll the grid horizontally to see the pinned columns stay in place.</p>
        <ul>
          <li><strong>ID</strong> and <strong>Name</strong> are pinned to the left</li>
          <li><strong>Actions</strong> is pinned to the right</li>
          <li>Set <code>sticky: 'left'</code> or <code>sticky: 'right'</code> on column config</li>
        </ul>
      `,
    });
  },
};

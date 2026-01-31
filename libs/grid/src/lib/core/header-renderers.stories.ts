/**
 * Header Renderers Stories
 *
 * Demonstrates custom header rendering using `headerLabelRenderer` and `headerRenderer`.
 */
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ColumnConfig, GridConfig } from '../../public';

// Import from source for HMR
import '../../index';

type GridElement = HTMLElement & {
  columns: ColumnConfig[];
  rows: any[];
  gridConfig: GridConfig<any>;
};

const meta: Meta = {
  title: 'Grid/Header Renderers',
  tags: ['!dev'],
  parameters: {
    layout: 'fullscreen',
  },
};
export default meta;

type Story = StoryObj;

// Sample data
const sampleRows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', score: 85, required: true },
  { id: 2, name: 'Bob', email: 'bob@example.com', score: 72, required: false },
  { id: 3, name: 'Carol', email: 'carol@example.com', score: 91, required: true },
  { id: 4, name: 'Dan', email: 'dan@example.com', score: 68, required: false },
  { id: 5, name: 'Eve', email: 'eve@example.com', score: 95, required: true },
];

/**
 * ## Custom Header Renderers
 *
 * Customize column headers with two levels of control:
 *
 * - **`headerLabelRenderer`**: Customize just the label. Grid handles sort icons and resize handles automatically.
 * - **`headerRenderer`**: Full control over header content. Use `ctx.renderSortIcon()` to include sorting.
 *   Resize handles are added automatically for resizable columns.
 *
 * This example shows both approaches side-by-side:
 * - **Name column**: Uses `headerLabelRenderer` to add a required indicator
 * - **Email column**: Uses `headerRenderer` for complete control with a custom icon prefix
 */
export const CustomHeaderRenderers: Story = {
  parameters: {
    docs: {
      source: {
        code: `
grid.columns = [
  { field: 'id', header: 'ID', sortable: true },
  {
    field: 'name',
    header: 'Name',
    sortable: true,
    resizable: true,
    // headerLabelRenderer: just customize the label, grid adds sort icons
    headerLabelRenderer: ({ value }) => {
      const span = document.createElement('span');
      span.innerHTML = \`\${value} <span style="color: red;">*</span>\`;
      return span;
    },
  },
  {
    field: 'email',
    header: 'Email',
    sortable: true,
    resizable: true,
    // headerRenderer: full control over content, resize handles are automatic
    headerRenderer: (ctx) => {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; width:100%;';

      const icon = document.createElement('span');
      icon.textContent = '📧';
      wrapper.appendChild(icon);

      const label = document.createElement('span');
      label.textContent = ctx.value;
      label.style.flex = '1';
      wrapper.appendChild(label);

      // Use helper to add sort icon
      const sortIcon = ctx.renderSortIcon();
      if (sortIcon) wrapper.appendChild(sortIcon);

      return wrapper;
    },
  },
  { field: 'score', header: 'Score', sortable: true },
];
`,
        language: 'javascript',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '300px';

    grid.columns = [
      { field: 'id', header: 'ID', sortable: true },
      {
        field: 'name',
        header: 'Name',
        sortable: true,
        resizable: true,
        // headerLabelRenderer: just customize the label, grid adds sort icons
        headerLabelRenderer: ({ value }) => {
          const span = document.createElement('span');
          span.innerHTML = `${value} <span style="color: red; font-weight: bold;">*</span>`;
          return span;
        },
      },
      {
        field: 'email',
        header: 'Email',
        sortable: true,
        resizable: true,
        // headerRenderer: full control over content, resize handles are automatic
        headerRenderer: (ctx) => {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; width:100%;';

          const icon = document.createElement('span');
          icon.textContent = '📧';
          wrapper.appendChild(icon);

          const label = document.createElement('span');
          label.textContent = ctx.value;
          label.style.flex = '1';
          wrapper.appendChild(label);

          // Use helper to add sort icon
          const sortIcon = ctx.renderSortIcon();
          if (sortIcon) wrapper.appendChild(sortIcon);

          return wrapper;
        },
      },
      { field: 'score', header: 'Score', sortable: true },
    ];

    grid.rows = sampleRows;
    return grid;
  },
};

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
 * ## Header Label Renderer
 *
 * Use `headerLabelRenderer` to customize just the label content.
 * The grid automatically handles:
 * - Sort icons (if `sortable: true`)
 * - Resize handles (if `resizable: true`)
 * - Keyboard accessibility
 *
 * Common use cases:
 * - Adding required field indicators (asterisks)
 * - Adding units to numeric columns
 * - Custom formatting or icons
 */
export const HeaderLabelRenderer: Story = {
  parameters: {
    docs: {
      source: {
        code: `
const grid = document.querySelector('tbw-grid');

grid.columns = [
  { field: 'id', header: 'ID', sortable: true },
  {
    field: 'name',
    header: 'Name',
    sortable: true,
    resizable: true,
    // Add required indicator with custom styling
    headerLabelRenderer: ({ value }) => {
      const span = document.createElement('span');
      span.innerHTML = value + ' <span style="color: red;">*</span>';
      return span;
    },
  },
  {
    field: 'score',
    header: 'Score',
    sortable: true,
    // Add units to header
    headerLabelRenderer: ({ value }) => \`\${value} (pts)\`,
  },
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
        // Add required indicator with custom styling
        headerLabelRenderer: ({ value }) => {
          const span = document.createElement('span');
          span.innerHTML = `${value} <span style="color: red; font-weight: bold;">*</span>`;
          return span;
        },
      },
      {
        field: 'email',
        header: 'Email',
        resizable: true,
        // Add icon
        headerLabelRenderer: () => {
          const span = document.createElement('span');
          span.innerHTML = '📧 Email';
          return span;
        },
      },
      {
        field: 'score',
        header: 'Score',
        sortable: true,
        // Add units to header
        headerLabelRenderer: ({ value }) => `${value} (pts)`,
      },
    ];

    grid.rows = sampleRows;
    return grid;
  },
};

/**
 * ## Full Header Renderer
 *
 * Use `headerRenderer` for complete control over the header cell content.
 * You receive a context object with:
 * - `column` - The column configuration
 * - `value` - The header text (from `header` property or `field`)
 * - `sortState` - Current sort state (`'asc'`, `'desc'`, or `null`)
 * - `cellEl` - The header cell element
 * - `renderSortIcon()` - Helper to create the sort indicator
 * - `renderResizeHandle()` - Helper to create the resize handle
 *
 * **Note:** When using `headerRenderer`, you must explicitly include
 * sort icons and resize handles if you want them.
 */
export const FullHeaderRenderer: Story = {
  parameters: {
    docs: {
      source: {
        code: `
const grid = document.querySelector('tbw-grid');

grid.columns = [
  { field: 'id', header: 'ID', sortable: true },
  {
    field: 'name',
    header: 'Name',
    sortable: true,
    resizable: true,
    headerRenderer: (ctx) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.gap = '4px';

      // Custom content
      const label = document.createElement('span');
      label.textContent = ctx.value;

      // Badge showing sort state
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:10px; padding:2px 4px; border-radius:3px; background:#e0e0e0;';
      badge.textContent = ctx.sortState ? ctx.sortState.toUpperCase() : 'unsorted';

      container.appendChild(label);
      container.appendChild(badge);

      // Use helpers to add standard elements
      const sortIcon = ctx.renderSortIcon();
      if (sortIcon) container.appendChild(sortIcon);

      const resizeHandle = ctx.renderResizeHandle();
      if (resizeHandle) container.appendChild(resizeHandle);

      return container;
    },
  },
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
        headerRenderer: (ctx) => {
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.gap = '4px';

          // Custom content
          const label = document.createElement('span');
          label.textContent = ctx.value;

          // Badge showing sort state
          const badge = document.createElement('span');
          badge.style.cssText =
            'font-size:10px; padding:2px 4px; border-radius:3px; background: var(--tbw-color-bg-alt, #e0e0e0);';
          badge.textContent = ctx.sortState ? ctx.sortState.toUpperCase() : 'unsorted';

          container.appendChild(label);
          container.appendChild(badge);

          // Use helpers to add standard elements
          const sortIcon = ctx.renderSortIcon();
          if (sortIcon) container.appendChild(sortIcon);

          const resizeHandle = ctx.renderResizeHandle();
          if (resizeHandle) container.appendChild(resizeHandle);

          return container;
        },
      },
      {
        field: 'email',
        header: 'Email',
        resizable: true,
        // Custom layout with icon before text
        headerRenderer: (ctx) => {
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.gap = '6px';

          const icon = document.createElement('span');
          icon.textContent = '📧';
          icon.style.fontSize = '14px';

          const label = document.createElement('span');
          label.textContent = ctx.value;
          label.style.fontWeight = '600';

          container.appendChild(icon);
          container.appendChild(label);

          // Add resize handle
          const resizeHandle = ctx.renderResizeHandle();
          if (resizeHandle) container.appendChild(resizeHandle);

          return container;
        },
      },
      {
        field: 'score',
        header: 'Score',
        sortable: true,
        // Custom header with tooltip
        headerRenderer: (ctx) => {
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.alignItems = 'center';
          container.style.gap = '4px';

          const label = document.createElement('span');
          label.textContent = ctx.value;

          const info = document.createElement('span');
          info.textContent = 'ⓘ';
          info.title = 'Score out of 100 points';
          info.style.cursor = 'help';
          info.style.opacity = '0.6';

          container.appendChild(label);
          container.appendChild(info);

          const sortIcon = ctx.renderSortIcon();
          if (sortIcon) container.appendChild(sortIcon);

          return container;
        },
      },
    ];

    grid.rows = sampleRows;
    return grid;
  },
};

/**
 * ## Comparing Both Approaches
 *
 * This example shows when to use each approach:
 *
 * - **headerLabelRenderer**: Simple customizations where you want the grid to handle interactions
 * - **headerRenderer**: Complex layouts or when you need full control
 */
export const ComparingApproaches: Story = {
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.columns = [
      {
        field: 'id',
        header: 'ID',
        sortable: true,
        // Default rendering - no custom renderer
      },
      {
        field: 'name',
        header: 'Name',
        sortable: true,
        resizable: true,
        // headerLabelRenderer - just customize label, grid adds icons
        headerLabelRenderer: ({ value }) => {
          const span = document.createElement('span');
          span.innerHTML = `<strong>${value}</strong> <sup style="color:red">*</sup>`;
          return span;
        },
      },
      {
        field: 'email',
        header: 'Email',
        sortable: true,
        resizable: true,
        // headerRenderer - full control, must add icons manually
        headerRenderer: (ctx) => {
          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'display:flex; align-items:center; gap:6px; width:100%;';

          // Custom icon prefix
          const icon = document.createElement('span');
          icon.innerHTML = '✉️';
          wrapper.appendChild(icon);

          // Label
          const label = document.createElement('span');
          label.textContent = ctx.value;
          label.style.flex = '1';
          wrapper.appendChild(label);

          // Use helper for sort icon
          const sortIcon = ctx.renderSortIcon();
          if (sortIcon) wrapper.appendChild(sortIcon);

          // Use helper for resize handle
          const handle = ctx.renderResizeHandle();
          if (handle) wrapper.appendChild(handle);

          return wrapper;
        },
      },
      {
        field: 'score',
        header: 'Score (pts)',
        sortable: true,
        // Simple string return works too
        headerLabelRenderer: () => '📊 Score (pts)',
      },
    ];

    grid.rows = sampleRows;
    return grid;
  },
};

import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { SelectionPlugin } from '../selection/SelectionPlugin';
import { ClipboardPlugin } from './ClipboardPlugin';

// Import grid component
import '../../../index';

// Sample data for clipboard demos
const sampleData = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering' },
  { id: 4, name: 'Dan', email: 'dan@example.com', department: 'Sales' },
];

const columns = [
  { field: 'id', header: 'ID', type: 'number' as const },
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
  { field: 'department', header: 'Department' },
];

const meta: Meta = {
  title: 'Grid/Plugins/Clipboard',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    includeHeaders: {
      control: { type: 'boolean' },
      description: 'Include column headers when copying',
      table: { category: 'Clipboard', defaultValue: { summary: 'false' } },
    },
    quoteStrings: {
      control: { type: 'boolean' },
      description: 'Wrap string values in quotes',
      table: { category: 'Clipboard', defaultValue: { summary: 'false' } },
    },
  },
  args: {
    includeHeaders: false,
    quoteStrings: false,
  },
};
export default meta;

interface ClipboardArgs {
  includeHeaders: boolean;
  quoteStrings: boolean;
}
type Story = StoryObj<ClipboardArgs>;

/**
 * Select cells with range selection, then use Ctrl+C to copy.
 * Paste into Excel, Google Sheets, or any text editor.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new ClipboardPlugin({
      includeHeaders: false,
      quoteStrings: false,
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering' },
  { id: 4, name: 'Dan', email: 'dan@example.com', department: 'Sales' },
];

// Select cells with mouse drag, then Ctrl+C to copy
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: ClipboardArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({
          includeHeaders: args.includeHeaders,
          quoteStrings: args.quoteStrings,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Copy includes column headers in the first row.
 */
export const WithHeaders: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new ClipboardPlugin({
      includeHeaders: true, // Headers included in copy
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering' },
  { id: 4, name: 'Dan', email: 'dan@example.com', department: 'Sales' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    includeHeaders: true,
    quoteStrings: false,
  },
  render: (args: ClipboardArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({
          includeHeaders: args.includeHeaders,
          quoteStrings: args.quoteStrings,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * String values are wrapped in double quotes for CSV compatibility.
 */
export const QuotedStrings: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number' },
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email' },
    { field: 'department', header: 'Department' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new ClipboardPlugin({
      quoteStrings: true, // Wrap strings in quotes for CSV compatibility
    }),
  ],
};

grid.rows = [
  { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering' },
  { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Marketing' },
  { id: 3, name: 'Carol', email: 'carol@example.com', department: 'Engineering' },
  { id: 4, name: 'Dan', email: 'dan@example.com', department: 'Sales' },
];
</script>
`,
        language: 'html',
      },
    },
  },
  args: {
    includeHeaders: false,
    quoteStrings: true,
  },
  render: (args: ClipboardArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin({
          includeHeaders: args.includeHeaders,
          quoteStrings: args.quoteStrings,
        }),
      ],
    };
    grid.rows = sampleData;

    return grid;
  },
};

/**
 * Single cell copy mode (no selection plugin).
 * Click a cell and press Ctrl+C to copy just that cell's value.
 */
export const SingleCellMode: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 350px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [...],
  plugins: [
    new ClipboardPlugin(), // No selection plugin = single cell copy
  ],
};
grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: () => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '350px';

    grid.gridConfig = {
      columns,
      plugins: [new ClipboardPlugin()],
    };
    grid.rows = sampleData;

    return grid;
  },
};

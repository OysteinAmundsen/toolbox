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

/**
 * ## Copy & Paste (Auto-Paste)
 *
 * By default, the ClipboardPlugin handles paste operations automatically!
 * Just add the plugin and pasting works out of the box - no event handling needed.
 *
 * The plugin will:
 * - Parse clipboard data (tab/comma separated)
 * - Apply values starting at the selected cell
 * - Add new rows if pasting beyond the current data
 *
 * **Try it:**
 * 1. Select cells and Ctrl+C to copy
 * 2. Click a target cell and Ctrl+V to paste
 * 3. Or paste data from Excel/Sheets!
 */
export const CopyPaste: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'col1', header: 'Column 1' },
    { field: 'col2', header: 'Column 2' },
    { field: 'col3', header: 'Column 3' },
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new ClipboardPlugin(), // Auto-paste is enabled by default!
  ],
};

grid.rows = [
  { col1: 'A1', col2: 'B1', col3: 'C1' },
  { col1: 'A2', col2: 'B2', col3: 'C2' },
  { col1: 'A3', col2: 'B3', col3: 'C3' },
];

// That's it! Paste just works. No event handling needed.
// The plugin automatically updates grid.rows when you paste.
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; height: 450px;';

    // Sample data to copy
    const sampleDataBox = document.createElement('div');
    sampleDataBox.style.cssText = `
      padding: 12px;
      background: var(--demo-sample-bg);
      border-bottom: 1px solid var(--demo-sample-border);
      font-family: monospace;
      font-size: 13px;
      white-space: pre;
      user-select: all;
      cursor: text;
    `;
    sampleDataBox.textContent = `X1\tY1\tZ1
X2\tY2\tZ2`;
    sampleDataBox.title = 'Select this text and Ctrl+C to copy, then paste into the grid below';
    container.appendChild(sampleDataBox);

    // Instructions banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      padding: 12px;
      background: var(--demo-info-bg);
      border-bottom: 1px solid var(--demo-info-border);
      font-size: 14px;
      color: var(--demo-info-fg);
    `;
    banner.innerHTML = `
      <strong>Try it:</strong> Select the sample data above → Ctrl+C → Click a cell in the grid → Ctrl+V to paste.
      <br>Or paste tab/comma-separated data from Excel or Sheets!
    `;
    container.appendChild(banner);

    // Grid
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'flex: 1;';

    grid.gridConfig = {
      columns: [
        { field: 'col1', header: 'Column 1' },
        { field: 'col2', header: 'Column 2' },
        { field: 'col3', header: 'Column 3' },
      ],
      plugins: [
        new SelectionPlugin({ mode: 'range' }),
        new ClipboardPlugin(), // Auto-paste enabled by default!
      ],
    };

    grid.rows = [
      { col1: 'A1', col2: 'B1', col3: 'C1' },
      { col1: 'A2', col2: 'B2', col3: 'C2' },
      { col1: 'A3', col2: 'B3', col3: 'C3' },
      { col1: 'A4', col2: 'B4', col3: 'C4' },
    ];

    // No paste event handler needed - the plugin handles it automatically!

    container.appendChild(grid);
    return container;
  },
};

/**
 * ## Custom Paste Handler
 *
 * For advanced use cases, you can provide a custom `pasteHandler` to control
 * how pasted data is applied. This is useful when you need to:
 * - Validate data before pasting
 * - Transform values (e.g., parse numbers, dates)
 * - Apply business logic or constraints
 * - Integrate with state management
 *
 * Set `pasteHandler: null` to disable auto-paste entirely and handle the
 * `paste` event manually.
 */
export const CustomPasteHandler: Story = {
  parameters: {
    docs: {
      source: {
        code: `
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { ClipboardPlugin, type PasteHandler } from '@toolbox-web/grid/plugins/clipboard';

// Custom handler that validates and transforms values
const customPasteHandler: PasteHandler = (detail, grid) => {
  if (!detail.target) return;

  const { rows: pastedRows, target, fields } = detail;
  const currentRows = [...grid.rows] as Record<string, string>[];

  pastedRows.forEach((rowData, rowOffset) => {
    const targetRowIndex = target.row + rowOffset;
    if (targetRowIndex >= currentRows.length) return; // Don't add new rows

    currentRows[targetRowIndex] = { ...currentRows[targetRowIndex] };
    rowData.forEach((value, colOffset) => {
      const field = fields[colOffset];
      if (field) {
        // Transform: uppercase all values
        currentRows[targetRowIndex][field] = value.toUpperCase();
      }
    });
  });

  grid.rows = currentRows;
};

grid.gridConfig = {
  columns: [...],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new ClipboardPlugin({ pasteHandler: customPasteHandler }),
  ],
};
`,
        language: 'ts',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-direction: column; height: 450px;';

    // Sample data to copy
    const sampleDataBox = document.createElement('div');
    sampleDataBox.style.cssText = `
      padding: 12px;
      background: var(--demo-sample-bg);
      border-bottom: 1px solid var(--demo-sample-border);
      font-family: monospace;
      font-size: 13px;
      white-space: pre;
      user-select: all;
      cursor: text;
    `;
    sampleDataBox.textContent = `hello\tworld
foo\tbar`;
    sampleDataBox.title = 'Paste this into the grid - values will be uppercased!';
    container.appendChild(sampleDataBox);

    // Instructions banner
    const banner = document.createElement('div');
    banner.style.cssText = `
      padding: 12px;
      background: var(--demo-info-bg);
      border-bottom: 1px solid var(--demo-info-border);
      font-size: 14px;
      color: var(--demo-info-fg);
    `;
    banner.innerHTML = `
      <strong>Custom Handler:</strong> Pasted values are automatically UPPERCASED.
      <br>This demo also prevents adding new rows when pasting beyond the grid.
    `;
    container.appendChild(banner);

    // Grid
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'flex: 1;';

    // Custom paste handler that uppercases values and prevents adding rows
    const customPasteHandler: import('./types').PasteHandler = (detail, gridEl) => {
      if (!detail.target) return;

      const { rows: pastedRows, target, fields } = detail;
      const columns = gridEl.effectiveConfig.columns ?? [];
      const allFields = columns.map((c) => c.field);
      const currentRows = [...(gridEl.rows as Record<string, string>[])];

      pastedRows.forEach((rowData, rowOffset) => {
        const targetRowIndex = target.row + rowOffset;

        // This handler allows adding rows (unlike the code sample which doesn't)
        while (targetRowIndex >= currentRows.length) {
          const emptyRow: Record<string, string> = {};
          allFields.forEach((f) => (emptyRow[f] = ''));
          currentRows.push(emptyRow);
        }

        currentRows[targetRowIndex] = { ...currentRows[targetRowIndex] };
        rowData.forEach((value, colOffset) => {
          const field = fields[colOffset];
          if (field) {
            // Transform: uppercase all values
            currentRows[targetRowIndex][field] = value.toUpperCase();
          }
        });
      });

      gridEl.rows = currentRows;
    };

    grid.gridConfig = {
      columns: [
        { field: 'col1', header: 'Column 1' },
        { field: 'col2', header: 'Column 2' },
        { field: 'col3', header: 'Column 3' },
      ],
      plugins: [new SelectionPlugin({ mode: 'range' }), new ClipboardPlugin({ pasteHandler: customPasteHandler })],
    };

    grid.rows = [
      { col1: 'A1', col2: 'B1', col3: 'C1' },
      { col1: 'A2', col2: 'B2', col3: 'C2' },
      { col1: 'A3', col2: 'B3', col3: 'C3' },
    ];

    container.appendChild(grid);
    return container;
  },
};

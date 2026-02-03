import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../../public';
import { ColumnVirtualizationPlugin } from './ColumnVirtualizationPlugin';

// Import grid component
import '../../../index';

// Generate columns dynamically
function generateColumns(count: number) {
  const columns = [{ field: 'id', header: 'ID', type: 'number' as const, width: 60 }];
  for (let i = 1; i < count; i++) {
    columns.push({
      field: `col${i}`,
      header: `Column ${i}`,
      type: 'number' as const,
      width: 100,
    });
  }
  return columns;
}

// Generate rows dynamically
function generateRows(rowCount: number, colCount: number) {
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const row: Record<string, number> = { id: r + 1 };
    for (let c = 1; c < colCount; c++) {
      row[`col${c}`] = Math.floor(Math.random() * 1000);
    }
    rows.push(row);
  }
  return rows;
}

const meta: Meta = {
  title: 'Grid/Plugins/Column-Virtualization',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    columnCount: {
      control: { type: 'range', min: 10, max: 1000, step: 10 },
      description: 'Number of columns to generate',
      table: { category: 'Data', defaultValue: { summary: '50' } },
    },
    autoEnable: {
      control: { type: 'boolean' },
      description: 'Auto-enable when column count exceeds threshold',
      table: { category: 'Column Virtualization', defaultValue: { summary: 'true' } },
    },
    threshold: {
      control: { type: 'range', min: 10, max: 100, step: 5 },
      description: 'Column count threshold for auto-enabling',
      table: { category: 'Column Virtualization', defaultValue: { summary: '30' } },
    },
    overscan: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Extra columns to render on each side',
      table: { category: 'Column Virtualization', defaultValue: { summary: '3' } },
    },
  },
  args: {
    columnCount: 50,
    autoEnable: true,
    threshold: 30,
    overscan: 3,
  },
};
export default meta;

interface ColumnVirtualizationArgs {
  columnCount: number;
  autoEnable: boolean;
  threshold: number;
  overscan: number;
}
type Story = StoryObj<ColumnVirtualizationArgs>;

/**
 * Only visible columns are rendered for better performance.
 * This demo has 50 columns and 100 rows — scroll horizontally to see virtualization.
 */
export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid style="height: 400px;"></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';

// Generate many columns for demo
function generateColumns(count) {
  const columns = [{ field: 'id', header: 'ID', type: 'number', width: 60 }];
  for (let i = 1; i < count; i++) {
    columns.push({ field: \`col\${i}\`, header: \`Column \${i}\`, type: 'number', width: 100 });
  }
  return columns;
}

// Generate sample data
function generateRows(rowCount, colCount) {
  const rows = [];
  for (let r = 0; r < rowCount; r++) {
    const row = { id: r + 1 };
    for (let c = 1; c < colCount; c++) {
      row[\`col\${c}\`] = Math.floor(Math.random() * 1000);
    }
    rows.push(row);
  }
  return rows;
}

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: generateColumns(50),
  fitMode: 'fixed',
  plugins: [
    new ColumnVirtualizationPlugin({
      autoEnable: true,
      threshold: 30,
      overscan: 3,
    }),
  ],
};

grid.rows = generateRows(100, 50);
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: ColumnVirtualizationArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.height = '400px';

    const columns = generateColumns(args.columnCount);
    const rows = generateRows(100, args.columnCount);

    grid.gridConfig = {
      columns,
      fitMode: 'fixed',
      plugins: [
        new ColumnVirtualizationPlugin({
          autoEnable: args.autoEnable,
          threshold: args.threshold,
          overscan: args.overscan,
        }),
      ],
    };
    grid.rows = rows;

    return grid;
  },
};

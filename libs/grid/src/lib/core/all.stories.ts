import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { GridElement } from '../../public';

// Import grid + all plugins
import '../../index';
import { ClipboardPlugin } from '../plugins/clipboard/ClipboardPlugin';
import { ContextMenuPlugin } from '../plugins/context-menu/ContextMenuPlugin';
import { ExportPlugin } from '../plugins/export/ExportPlugin';
import { FilteringPlugin } from '../plugins/filtering/FilteringPlugin';
import { GroupingColumnsPlugin } from '../plugins/grouping-columns/GroupingColumnsPlugin';
import { MultiSortPlugin } from '../plugins/multi-sort/MultiSortPlugin';
import { PinnedColumnsPlugin } from '../plugins/pinned-columns/PinnedColumnsPlugin';
import { PinnedRowsPlugin } from '../plugins/pinned-rows/PinnedRowsPlugin';
import { ReorderPlugin } from '../plugins/reorder/ReorderPlugin';
import { SelectionPlugin } from '../plugins/selection/SelectionPlugin';
import { UndoRedoPlugin } from '../plugins/undo-redo/UndoRedoPlugin';
import { VisibilityPlugin } from '../plugins/visibility/VisibilityPlugin';

const meta: Meta = {
  title: 'Grid/All Features',
  tags: ['!dev'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    rowCount: {
      control: { type: 'range', min: 10, max: 100, step: 10 },
      description: 'Number of data rows',
      table: { category: 'Data' },
    },
    enableSelection: {
      control: 'boolean',
      description: 'Enable cell/row selection',
      table: { category: 'Features' },
    },
    enableFiltering: {
      control: 'boolean',
      description: 'Enable column filtering',
      table: { category: 'Features' },
    },
    enableSorting: {
      control: 'boolean',
      description: 'Enable multi-column sorting',
      table: { category: 'Features' },
    },
    enableEditing: {
      control: 'boolean',
      description: 'Enable inline editing',
      table: { category: 'Features' },
    },
  },
  args: {
    rowCount: 50,
    enableSelection: true,
    enableFiltering: true,
    enableSorting: true,
    enableEditing: true,
  },
};
export default meta;

interface AllFeaturesArgs {
  rowCount: number;
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
}
type Story = StoryObj<AllFeaturesArgs>;

// Sample data generator
function generateEmployees(count: number) {
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const statuses = ['Active', 'On Leave', 'Remote', 'Contract'];
  const levels = ['Junior', 'Mid', 'Senior', 'Lead', 'Principal'];
  const firstNames = ['Alice', 'Bob', 'Carol', 'Dan', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack'];
  const lastNames = ['Johnson', 'Smith', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson', 'Lee', 'Chen', 'Taylor'];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`,
    department: departments[i % departments.length],
    level: levels[i % levels.length],
    salary: 50000 + Math.floor(Math.random() * 80000),
    status: statuses[i % statuses.length],
    startDate: new Date(2020 + (i % 5), i % 12, (i % 28) + 1).toISOString().split('T')[0],
    rating: Math.round((3 + Math.random() * 2) * 10) / 10,
  }));
}

/**
 * ## All Features Combined
 *
 * This story demonstrates a grid with **all major plugins enabled simultaneously**:
 *
 * - **Selection**: Click cells, Shift+Click for range, Ctrl+Click for multi-select
 * - **Multi-Sort**: Click headers to sort; Shift+Click for multi-column sort
 * - **Filtering**: Click the filter icon (⊻) in headers to filter by column values
 * - **Editing**: Double-click a cell to edit; Escape to cancel, Enter to commit
 * - **Undo/Redo**: Ctrl+Z / Ctrl+Y to undo/redo edits
 * - **Clipboard**: Ctrl+C to copy, Ctrl+V to paste
 * - **Context Menu**: Right-click for options (copy, export, etc.)
 * - **Column Reorder**: Drag column headers to reorder
 * - **Column Groups**: "Employee Info" and "Work Details" header groups
 * - **Pinned Columns**: ID column pinned to the left
 * - **Pinned Rows**: Footer with aggregation (row count, avg salary)
 * - **Export**: Use context menu to export CSV/JSON
 * - **Visibility**: Use context menu → "Hide Column" to toggle visibility
 */
export const AllFeatures: Story = {
  parameters: {
    docs: {
      source: {
        code: `
<!-- HTML -->
<tbw-grid></tbw-grid>

<script type="module">
import '@toolbox-web/grid';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

const grid = document.querySelector('tbw-grid');

grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID', type: 'number', sticky: 'left' },
    { field: 'name', header: 'Name', editable: true },
    { field: 'department', header: 'Dept', editable: true },
    { field: 'salary', header: 'Salary', type: 'number', editable: true },
    // ...
  ],
  plugins: [
    new SelectionPlugin({ mode: 'range' }),
    new MultiSortPlugin(),
    new FilteringPlugin({ debounceMs: 150 }),
    new ClipboardPlugin(),
    new ContextMenuPlugin(),
    new ReorderPlugin(),
    new PinnedColumnsPlugin(),
    new UndoRedoPlugin({ maxHistory: 50 }),
    new VisibilityPlugin(),
    new ExportPlugin(),
    new PinnedRowsPlugin({ position: 'bottom', showRowCount: true }),
  ],
};

grid.rows = [...];
</script>
`,
        language: 'html',
      },
    },
  },
  render: (args: AllFeaturesArgs) => {
    const grid = document.createElement('tbw-grid') as GridElement;
    grid.style.cssText = 'height: 500px; display: block;';

    grid.gridConfig = {
      columnGroups: [
        { id: 'employee', header: 'Employee Info', children: ['id', 'name', 'department'] },
        { id: 'work', header: 'Work Details', children: ['level', 'salary', 'status', 'startDate', 'rating'] },
      ],
      columns: [
        { field: 'id', header: 'ID', type: 'number', width: 60, sticky: 'left' },
        { field: 'name', header: 'Name', minWidth: 120, editable: args.enableEditing },
        { field: 'department', header: 'Dept', width: 120, editable: args.enableEditing },
        { field: 'level', header: 'Level', width: 100, editable: args.enableEditing },
        {
          field: 'salary',
          header: 'Salary',
          type: 'number',
          width: 100,
          editable: args.enableEditing,
          template:
            '${value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}',
        },
        { field: 'status', header: 'Status', width: 100, editable: args.enableEditing },
        { field: 'startDate', header: 'Start Date', type: 'date', width: 110 },
        { field: 'rating', header: 'Rating', type: 'number', width: 80 },
      ],
      plugins: [
        ...(args.enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
        ...(args.enableSorting ? [new MultiSortPlugin()] : []),
        ...(args.enableFiltering ? [new FilteringPlugin({ debounceMs: 150 })] : []),
        new ClipboardPlugin(),
        new ContextMenuPlugin(),
        new ReorderPlugin(),
        new GroupingColumnsPlugin(),
        new PinnedColumnsPlugin(),
        ...(args.enableEditing ? [new UndoRedoPlugin({ maxHistory: 50 })] : []),
        new VisibilityPlugin(),
        new ExportPlugin(),
        new PinnedRowsPlugin({
          position: 'bottom',
          showRowCount: true,
          showFilteredCount: true,
          aggregationRows: [
            {
              id: 'summary',
              position: 'bottom',
              cells: {
                id: 'Totals:',
                salary: (rows: unknown[]) => {
                  const sum = (rows as { salary: number }[]).reduce((acc, r) => acc + (r.salary || 0), 0);
                  return sum.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  });
                },
                rating: (rows: unknown[]) => {
                  const vals = (rows as { rating: number }[]).map((r) => r.rating).filter(Boolean);
                  return vals.length ? `Avg: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)}` : '';
                },
              },
            },
          ],
        }),
      ],
    };

    grid.rows = generateEmployees(args.rowCount);

    return grid;
  },
};

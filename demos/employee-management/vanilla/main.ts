/**
 * Employee Management Demo - Vanilla TypeScript Implementation
 *
 * This demo showcases @toolbox-web/grid in a pure vanilla TypeScript setup.
 * No frameworks - just web standards and the grid component.
 *
 * Features demonstrated:
 * - Complete grid configuration with 15+ plugins
 * - Custom editors (star rating, bonus slider, status select, date picker)
 * - Custom view renderers (status badges, rating colors)
 * - Master-detail with expandable rows
 * - Shell integration (header, tool panels)
 * - Row grouping and aggregation
 */

// Import shared demo styles (applies to document)
import '@demo/shared/demo-styles.css';

// Import the grid component (registers <tbw-grid> custom element)
import '@toolbox-web/grid';

// Import all plugins from the all-in-one bundle
import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
  createGrid,
  EditingPlugin,
  ExportPlugin,
  FilteringPlugin,
  GroupingColumnsPlugin,
  GroupingRowsPlugin,
  MasterDetailPlugin,
  MultiSortPlugin,
  PinnedColumnsPlugin,
  PinnedRowsPlugin,
  ReorderPlugin,
  SelectionPlugin,
  UndoRedoPlugin,
  VisibilityPlugin,
  type ColumnMoveDetail,
  type DataGridElement,
} from '@toolbox-web/grid/all';

// Import shared data generators and types
import { DEPARTMENTS, generateEmployees, type Employee } from '@demo/shared';

// Import demo-specific components
import { bonusSliderEditor, dateEditor, starRatingEditor, statusSelectEditor } from './editors';
import { createDetailRenderer, ratingRenderer, statusViewRenderer, topPerformerRenderer } from './renderers';
import { injectToolPanelStyles, registerAnalyticsPanel, registerQuickFiltersPanel } from './tool-panels';

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

/**
 * Column groups for the employee grid.
 * Exported so the column-move constraint handler can reference them.
 */
export const COLUMN_GROUPS = [
  { id: 'employee', header: 'Employee Info', children: ['firstName', 'lastName', 'email'] },
  { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
  { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
  {
    id: 'status',
    header: 'Status & Performance',
    children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
  },
];

/**
 * Grid configuration options for the demo.
 */
export interface GridConfigOptions {
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  enableRowGrouping?: boolean;
  /** Callback to get the grid element (for toolbar button actions) */
  getGrid?: () => DataGridElement<Employee> | null;
}

/**
 * Creates the grid configuration object.
 * Exported so Storybook stories can reuse the same configuration.
 */
export function createGridConfig(options: GridConfigOptions) {
  const {
    enableSelection,
    enableFiltering,
    enableSorting,
    enableEditing,
    enableMasterDetail,
    enableRowGrouping = false,
    getGrid,
  } = options;

  // Default getGrid falls back to DOM lookup
  const resolveGrid = getGrid ?? (() => document.getElementById('employee-grid') as DataGridElement<Employee> | null);

  return {
    shell: {
      header: {
        title: 'Employee Management System (JS)',
        // Toolbar buttons are now provided via light-dom HTML (see index.html)
      },
      toolPanel: { position: 'right' as const, width: 300 },
    },
    columnGroups: COLUMN_GROUPS,
    columns: [
      { field: 'id', header: 'ID', type: 'number', width: 70, sortable: true },
      {
        field: 'firstName',
        header: 'First Name',
        minWidth: 100,
        editable: enableEditing,
        sortable: true,
        resizable: true,
      },
      {
        field: 'lastName',
        header: 'Last Name',
        minWidth: 100,
        editable: enableEditing,
        sortable: true,
        resizable: true,
      },
      { field: 'email', header: 'Email', minWidth: 200, resizable: true },
      {
        field: 'department',
        header: 'Dept',
        width: 120,
        sortable: true,
        editable: enableEditing,
        type: 'select',
        options: DEPARTMENTS.map((d) => ({ label: d, value: d })),
      },
      { field: 'team', header: 'Team', width: 110, sortable: true },
      { field: 'title', header: 'Title', minWidth: 160, editable: enableEditing, resizable: true },
      {
        field: 'level',
        header: 'Level',
        width: 90,
        sortable: true,
        editable: enableEditing,
        type: 'select',
        options: ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'].map((l) => ({ label: l, value: l })),
      },
      {
        field: 'salary',
        header: 'Salary',
        type: 'number',
        width: 110,
        editable: enableEditing,
        sortable: true,
        resizable: true,
        format: (v: number) =>
          v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      },
      {
        field: 'bonus',
        header: 'Bonus',
        type: 'number',
        width: 180,
        sortable: true,
        editable: enableEditing,
        editor: bonusSliderEditor,
        format: (v: number) =>
          v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      },
      {
        field: 'status',
        header: 'Status',
        width: 140,
        sortable: true,
        editable: enableEditing,
        editor: statusSelectEditor,
        renderer: statusViewRenderer,
      },
      {
        field: 'hireDate',
        header: 'Hire Date',
        type: 'date',
        width: 130,
        sortable: true,
        editable: enableEditing,
        editor: dateEditor,
      },
      {
        field: 'rating',
        header: 'Rating',
        type: 'number',
        width: 120,
        sortable: true,
        editable: enableEditing,
        editor: starRatingEditor,
        renderer: ratingRenderer,
      },
      { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50, renderer: topPerformerRenderer },
      { field: 'location', header: 'Location', width: 110, sortable: true },
    ],
    plugins: [
      ...(enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
      ...(enableSorting ? [new MultiSortPlugin()] : []),
      ...(enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
      ...(enableEditing ? [new EditingPlugin({ editOn: 'dblclick' })] : []),
      new ClipboardPlugin(),
      new ContextMenuPlugin(),
      new ReorderPlugin(),
      new GroupingColumnsPlugin(),
      new PinnedColumnsPlugin(),
      new ColumnVirtualizationPlugin(),
      new VisibilityPlugin(),
      // Row grouping and master-detail are mutually exclusive
      ...(enableRowGrouping
        ? [
            new GroupingRowsPlugin({
              groupOn: (row: unknown) => (row as Employee).department,
              defaultExpanded: true,
              showRowCount: true,
              aggregators: { salary: 'sum', rating: 'avg' },
            }),
          ]
        : []),
      ...(!enableRowGrouping && enableMasterDetail
        ? [
            new MasterDetailPlugin({
              detailRenderer: (row: unknown) => createDetailRenderer(row as Employee),
              showExpandColumn: true,
              animation: 'slide',
            }),
          ]
        : []),
      ...(enableEditing ? [new UndoRedoPlugin({ maxHistorySize: 100 })] : []),
      new ExportPlugin(),
      new PinnedRowsPlugin({
        position: 'bottom',
        showRowCount: true,
        showFilteredCount: true,
        aggregationRows: [
          {
            id: 'totals',
            position: 'bottom',
            cells: {
              id: 'Summary:',
              salary: (rows: unknown[]) =>
                (rows as Employee[])
                  .reduce((acc, r) => acc + (r.salary || 0), 0)
                  .toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
              bonus: (rows: unknown[]) =>
                (rows as Employee[])
                  .reduce((acc, r) => acc + (r.bonus || 0), 0)
                  .toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
              rating: (rows: unknown[]) => {
                const vals = (rows as Employee[]).map((r) => r.rating).filter(Boolean);
                return vals.length ? `Avg: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}` : '';
              },
            },
          },
        ],
      }),
    ],
  };
}

// =============================================================================
// GRID FACTORY - Creates a fully configured employee grid
// =============================================================================

/**
 * Options for creating an employee grid.
 * Extends GridConfigOptions with row count.
 */
export interface EmployeeGridOptions extends Omit<GridConfigOptions, 'getGrid'> {
  rowCount: number;
}

/**
 * Creates a fully configured employee management grid.
 * This is the main entry point for both the vanilla demo and Storybook stories.
 *
 * @param options - Configuration options for the grid
 * @returns The configured grid element
 */
export function createEmployeeGrid(options: EmployeeGridOptions): DataGridElement<Employee> {
  const {
    rowCount,
    enableSelection,
    enableFiltering,
    enableSorting,
    enableEditing,
    enableMasterDetail,
    enableRowGrouping,
  } = options;

  // Create the grid element using the typed factory function
  const grid = createGrid<Employee>();
  grid.id = 'employee-grid';
  grid.className = 'demo-grid';

  // Create toolbar buttons container (users have full control over button HTML)
  const toolButtons = document.createElement('tbw-grid-tool-buttons');

  const exportCsvBtn = document.createElement('button');
  exportCsvBtn.className = 'tbw-toolbar-btn';
  exportCsvBtn.setAttribute('title', 'Export CSV');
  exportCsvBtn.setAttribute('aria-label', 'Export CSV');
  exportCsvBtn.textContent = '📄';
  exportCsvBtn.onclick = () => grid.getPlugin?.(ExportPlugin)?.exportCsv?.({ fileName: 'employees' });

  const exportExcelBtn = document.createElement('button');
  exportExcelBtn.className = 'tbw-toolbar-btn';
  exportExcelBtn.setAttribute('title', 'Export Excel');
  exportExcelBtn.setAttribute('aria-label', 'Export Excel');
  exportExcelBtn.textContent = '📊';
  exportExcelBtn.onclick = () => grid.getPlugin?.(ExportPlugin)?.exportExcel?.({ fileName: 'employees' });

  toolButtons.appendChild(exportCsvBtn);
  toolButtons.appendChild(exportExcelBtn);
  grid.appendChild(toolButtons);

  // Apply configuration with self-reference for toolbar actions
  grid.gridConfig = createGridConfig({
    enableSelection,
    enableFiltering,
    enableSorting,
    enableEditing,
    enableMasterDetail,
    enableRowGrouping,
    getGrid: () => grid,
  });

  // Set initial data
  grid.rows = generateEmployees(rowCount);

  // Demonstrate cancelable events: prevent columns from moving outside their groups
  // This shows the error flash animation when a move would break group contiguity
  grid.addEventListener('column-move', (e) => {
    const event = e as CustomEvent<ColumnMoveDetail>;
    const { field, columnOrder } = event.detail;

    // Find which group this field belongs to
    const sourceGroup = COLUMN_GROUPS.find((g) => g.children.includes(field));
    if (!sourceGroup) return; // Not in a group, allow the move

    // Get the indices of all columns in the source group (in the new/proposed order)
    const groupColumnIndices = sourceGroup.children
      .map((f) => columnOrder.indexOf(f))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);

    if (groupColumnIndices.length <= 1) return;

    // Check if the group columns are contiguous (no gaps between them)
    const minIndex = groupColumnIndices[0];
    const maxIndex = groupColumnIndices[groupColumnIndices.length - 1];
    const isContiguous = groupColumnIndices.length === maxIndex - minIndex + 1;

    if (!isContiguous) {
      console.log(`[Column Move Cancelled] Cannot move "${field}" outside its group "${sourceGroup.id}"`);
      event.preventDefault();

      // Flash the column header with error color to indicate cancellation
      const headerCell = grid.querySelector(`.header-row .cell[data-field="${field}"]`) as HTMLElement;
      if (headerCell) {
        headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
        headerCell.animate(
          [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
          { duration: 400, easing: 'ease-out' },
        );
      }
    }
  });

  // Register tool panels and inject styles after grid is ready
  (grid as { ready?: () => Promise<void>; refreshShellHeader?: () => void }).ready?.().then(() => {
    registerQuickFiltersPanel(grid);
    registerAnalyticsPanel(grid);
    (grid as { refreshShellHeader?: () => void }).refreshShellHeader?.();
    injectToolPanelStyles(grid);
  });

  return grid;
}

// =============================================================================
// STANDALONE PAGE INITIALIZATION
// =============================================================================

/**
 * Initializes the demo when running as a standalone HTML page.
 * Wires up the control panel to dynamically reconfigure the grid.
 */
function initializeDemo() {
  // Get control panel elements (only exist in standalone HTML page)
  const rowCountSlider = document.getElementById('row-count') as HTMLInputElement | null;
  const rowCountValue = document.getElementById('row-count-value') as HTMLElement | null;

  if (!rowCountSlider) {
    // Not running as standalone page - skip initialization
    return;
  }

  // Get initial control values
  const getControlValues = (): EmployeeGridOptions => ({
    rowCount: parseInt(rowCountSlider.value, 10),
    enableSelection: (document.getElementById('enable-selection') as HTMLInputElement).checked,
    enableFiltering: (document.getElementById('enable-filtering') as HTMLInputElement).checked,
    enableSorting: (document.getElementById('enable-sorting') as HTMLInputElement).checked,
    enableEditing: (document.getElementById('enable-editing') as HTMLInputElement).checked,
    enableMasterDetail: (document.getElementById('enable-detail') as HTMLInputElement).checked,
  });

  // Create the grid and add it to the page
  const container = document.querySelector('.grid-wrapper');
  if (!container) return;

  let grid = createEmployeeGrid(getControlValues());
  container.appendChild(grid as unknown as HTMLElement);

  // Wire up row count slider
  rowCountSlider.addEventListener('input', () => {
    if (rowCountValue) rowCountValue.textContent = rowCountSlider.value;
  });

  rowCountSlider.addEventListener('change', () => {
    grid.rows = generateEmployees(parseInt(rowCountSlider.value, 10));
  });

  // Checkbox controls require full re-creation (plugins change)
  ['enable-selection', 'enable-filtering', 'enable-sorting', 'enable-editing', 'enable-detail'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      // Remove old grid and create new one
      (grid as unknown as HTMLElement).remove();
      grid = createEmployeeGrid(getControlValues());
      container.appendChild(grid as unknown as HTMLElement);
    });
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeDemo);
} else {
  initializeDemo();
}

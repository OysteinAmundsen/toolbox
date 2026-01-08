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
import '../shared/demo-styles.css';

// Import the grid component (registers <tbw-grid> custom element)
import '@toolbox-web/grid';

// Import all plugins from the all-in-one bundle
import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
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
} from '@toolbox-web/grid/all';

// Import shared data generators and types
import { DEPARTMENTS, generateEmployees, type Employee } from '@demo/shared';
import type { GridElement } from '@toolbox-web/grid';

// Import demo-specific components
import { bonusSliderEditor, dateEditor, starRatingEditor, statusSelectEditor } from './editors';
import { createDetailRenderer, ratingRenderer, statusViewRenderer, topPerformerRenderer } from './renderers';
import { injectToolPanelStyles, registerAnalyticsPanel, registerQuickFiltersPanel } from './tool-panels';

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

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
  getGrid?: () => GridElement | null;
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
  const resolveGrid = getGrid ?? (() => document.getElementById('employee-grid') as GridElement | null);

  return {
    shell: {
      header: {
        title: 'Employee Management System',
        toolbarButtons: [
          {
            id: 'export-csv',
            label: 'Export CSV',
            icon: '📄',
            order: 10,
            action: () => {
              const grid = resolveGrid();
              grid?.getPlugin?.(ExportPlugin)?.exportCsv?.({ fileName: 'employees' });
            },
          },
          {
            id: 'export-excel',
            label: 'Export Excel',
            icon: '📊',
            order: 11,
            action: () => {
              const grid = resolveGrid();
              grid?.getPlugin?.(ExportPlugin)?.exportExcel?.({ fileName: 'employees' });
            },
          },
        ],
      },
      toolPanel: { position: 'right' as const, width: 300 },
    },
    columnGroups: [
      { id: 'employee', header: 'Employee Info', children: ['id', 'firstName', 'lastName', 'email'] },
      { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
      { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
      {
        id: 'status',
        header: 'Status & Performance',
        children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
      },
    ],
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
        viewRenderer: statusViewRenderer,
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
        viewRenderer: ratingRenderer,
      },
      { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50, viewRenderer: topPerformerRenderer },
      { field: 'location', header: 'Location', width: 110, sortable: true },
    ],
    editOn: 'dblClick' as const,
    plugins: [
      ...(enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
      ...(enableSorting ? [new MultiSortPlugin()] : []),
      ...(enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
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
export function createEmployeeGrid(options: EmployeeGridOptions): GridElement {
  const {
    rowCount,
    enableSelection,
    enableFiltering,
    enableSorting,
    enableEditing,
    enableMasterDetail,
    enableRowGrouping,
  } = options;

  // Create the grid element
  const grid = document.createElement('tbw-grid') as unknown as GridElement;
  (grid as unknown as HTMLElement).id = 'employee-grid';
  (grid as unknown as HTMLElement).className = 'demo-grid';

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

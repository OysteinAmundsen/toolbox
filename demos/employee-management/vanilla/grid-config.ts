/**
 * Grid Configuration for Employee Management Demo
 *
 * This file contains the grid column definitions, plugin setup, and configuration factory.
 * Separated from main.ts to make the configuration easy to find and copy.
 */

import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
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
  ResponsivePlugin,
  SelectionPlugin,
  UndoRedoPlugin,
  VisibilityPlugin,
  type GridConfig,
} from '@toolbox-web/grid/all';

import { DEPARTMENTS, type Employee } from '@demo/shared';

import { bonusSliderEditor, dateEditor, starRatingEditor, statusSelectEditor } from './editors';
import {
  createDetailRenderer,
  createResponsiveCardRenderer,
  ratingRenderer,
  statusViewRenderer,
  topPerformerRenderer,
} from './renderers';

// =============================================================================
// COLUMN GROUPS
// =============================================================================

/**
 * Column groups for the employee grid.
 * Used by GroupingColumnsPlugin to create grouped headers.
 * Also used by column-move handler to enforce group constraints.
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

// =============================================================================
// CONFIGURATION OPTIONS
// =============================================================================

/**
 * Options for configuring the grid.
 * Toggle features on/off based on demo requirements.
 */
export interface GridConfigOptions {
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  enableRowGrouping?: boolean;
}

// =============================================================================
// GRID CONFIGURATION FACTORY
// =============================================================================

/**
 * Creates a complete grid configuration for the employee management demo.
 *
 * This configuration includes:
 * - 15 columns with various types (text, number, date, select, boolean)
 * - Custom editors (star rating, bonus slider, status select, date picker)
 * - Custom renderers (status badges, rating colors, top performer badge)
 * - Shell header with title
 * - Multiple plugins for advanced features
 *
 * @example
 * ```ts
 * const config = createGridConfig({
 *   enableSelection: true,
 *   enableFiltering: true,
 *   enableSorting: true,
 *   enableEditing: true,
 *   enableMasterDetail: true,
 * });
 *
 * grid.gridConfig = config;
 * ```
 */
export function createGridConfig(options: GridConfigOptions): GridConfig<Employee> {
  const {
    enableSelection,
    enableFiltering,
    enableSorting,
    enableEditing,
    enableMasterDetail,
    enableRowGrouping = false,
  } = options;

  return {
    // Shell configuration (header, tool panels)
    shell: {
      header: {
        title: 'Employee Management System (JS)',
      },
      toolPanel: { position: 'right' as const, width: 300 },
    },

    // Column groups for grouped headers
    columnGroups: COLUMN_GROUPS,

    // Column definitions
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
      {
        field: 'isTopPerformer',
        header: '⭐',
        type: 'boolean',
        width: 50,
        sortable: false,
        renderer: topPerformerRenderer,
      },
      { field: 'location', header: 'Location', width: 110, sortable: true },
    ],

    // Plugins - advanced features
    plugins: [
      // Core interaction plugins
      ...(enableSelection ? [new SelectionPlugin({ mode: 'range' })] : []),
      ...(enableSorting ? [new MultiSortPlugin()] : []),
      ...(enableFiltering ? [new FilteringPlugin({ debounceMs: 200 })] : []),
      ...(enableEditing ? [new EditingPlugin({ editOn: 'dblclick' })] : []),

      // Always-on utility plugins
      new ClipboardPlugin(),
      new ContextMenuPlugin(),
      new ReorderPlugin(),
      new GroupingColumnsPlugin(),
      new PinnedColumnsPlugin(),
      new ColumnVirtualizationPlugin(),
      new VisibilityPlugin(),

      // Responsive plugin for mobile/narrow layouts
      // Disabled when row grouping is enabled (incompatible combination)
      ...(!enableRowGrouping
        ? [
            new ResponsivePlugin<Employee>({
              breakpoint: 700,
              cardRenderer: (row) => createResponsiveCardRenderer(row),
              cardRowHeight: 80,
              hiddenColumns: ['id', 'email', 'team', 'level', 'bonus', 'hireDate', 'isTopPerformer', 'location'],
            }),
          ]
        : []),

      // Row grouping (mutually exclusive with master-detail)
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

      // Master-detail (mutually exclusive with row grouping)
      ...(!enableRowGrouping && enableMasterDetail
        ? [
            new MasterDetailPlugin({
              detailRenderer: (row: unknown) => createDetailRenderer(row as Employee),
              showExpandColumn: true,
              animation: 'slide',
            }),
          ]
        : []),

      // Undo/redo for editing
      ...(enableEditing ? [new UndoRedoPlugin({ maxHistorySize: 100 })] : []),

      // Export functionality
      new ExportPlugin(),

      // Footer row with aggregations
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

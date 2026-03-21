/**
 * Grid Configuration for Employee Management Demo
 *
 * This file demonstrates the `features` configuration API for @toolbox-web/grid.
 * Most plugins are configured declaratively via `features: { ... }` on the grid config.
 * The PinnedRowsPlugin is configured manually via `plugins: [...]` to show both approaches.
 */

// Feature side-effect imports — register feature factories in the core registry.
// Each import is tiny (~200-300 bytes) and only includes the factory + type augmentation.
import '@toolbox-web/grid/features/clipboard';
import '@toolbox-web/grid/features/column-virtualization';
import '@toolbox-web/grid/features/context-menu';
import '@toolbox-web/grid/features/editing';
import '@toolbox-web/grid/features/export';
import '@toolbox-web/grid/features/filtering';
import '@toolbox-web/grid/features/grouping-columns';
import '@toolbox-web/grid/features/grouping-rows';
import '@toolbox-web/grid/features/master-detail';
import '@toolbox-web/grid/features/multi-sort';
import '@toolbox-web/grid/features/pinned-columns';
import '@toolbox-web/grid/features/pinned-rows';
import '@toolbox-web/grid/features/reorder-columns';
import '@toolbox-web/grid/features/responsive';
import '@toolbox-web/grid/features/selection';
import '@toolbox-web/grid/features/undo-redo';
import '@toolbox-web/grid/features/visibility';

// PinnedRowsPlugin is imported directly to demonstrate the manual plugins approach
import type { GridConfig } from '@toolbox-web/grid';
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

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
    fitMode: 'fixed',

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

    // Grid-wide feature toggles (used by plugins that support enable/disable)
    sortable: enableSorting,
    filterable: enableFiltering,
    selectable: enableSelection,

    // Declarative feature configuration — the recommended approach.
    // Each key corresponds to a feature side-effect import above.
    // The grid creates plugin instances from these configs automatically.
    features: {
      selection: 'range',
      multiSort: true,
      filtering: { debounceMs: 200 },
      // EditingPlugin always loaded; toggle via editOn to avoid validation errors
      // when columns have `editable: true`
      editing: enableEditing ? 'dblclick' : { editOn: false },
      clipboard: true,
      contextMenu: true,
      reorderColumns: true,
      groupingColumns: true,
      pinnedColumns: true,
      columnVirtualization: true,
      visibility: true,
      // Responsive plugin for mobile/narrow layouts
      responsive: {
        breakpoint: 700,
        cardRenderer: (row: Employee) => createResponsiveCardRenderer(row),
        cardRowHeight: 80,
        hiddenColumns: ['id', 'email', 'team', 'level', 'bonus', 'hireDate', 'isTopPerformer', 'location'],
      },
      // Row grouping (works alongside master-detail)
      ...(enableRowGrouping
        ? {
            groupingRows: {
              groupOn: (row: unknown) => (row as Employee).department,
              defaultExpanded: false,
              showRowCount: true,
              aggregators: {
                salary: 'sum',
                rating: (rows: Record<string, unknown>[], field: string) => {
                  const sum = rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
                  return rows.length ? (sum / rows.length).toFixed(1) : '';
                },
              },
            },
          }
        : {}),
      // Master-detail (works alongside row grouping — details appear on data rows within groups)
      ...(enableMasterDetail
        ? {
            masterDetail: {
              detailRenderer: (row: unknown) => createDetailRenderer(row as Employee),
              showExpandColumn: true,
              animation: 'slide' as const,
            },
          }
        : {}),
      undoRedo: { maxHistorySize: 100 },
      export: true,
    },

    // Manual plugins array — PinnedRowsPlugin kept here to demonstrate
    // that `features` and `plugins` can be mixed in the same config.
    plugins: [
      new PinnedRowsPlugin({
        position: 'bottom',
        showRowCount: true,
        showFilteredCount: true,
        aggregationRows: [
          {
            id: 'totals',
            position: 'bottom',
            label: 'Summary:',
            cells: {
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

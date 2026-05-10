/**
 * Grid Configuration for Employee Management Demo - Vue
 *
 * This file contains:
 * - Column groups for multi-level headers
 * - Grid configuration factory function
 * - Pinned rows configuration
 * - Responsive layout configuration
 *
 * Renderers and editors are passed in as options since they use Vue components.
 */

import { DEPARTMENTS, type Employee } from '@demo/shared/employee-management';
// Import Vue-specific GridConfig that accepts VNode renderers/editors
import type { GridConfig } from '@toolbox-web/grid-vue';
import { filteredCountPanel, rowCountPanel } from '@toolbox-web/grid/plugins/pinned-rows';
import type { VNode } from 'vue';

// ═════════════════════════════════════════════════════════════════════════════
// FEATURE IMPORTS — register the features used in `gridConfig.features` below.
// Each side-effect import calls `registerFeature(name, factory)` so the grid
// can look the factory up by string key when it walks `features`.
// Tree-shakeable: only imported features ship in the bundle.
// ═════════════════════════════════════════════════════════════════════════════
import '@toolbox-web/grid-vue/features/clipboard';
import '@toolbox-web/grid-vue/features/column-virtualization';
import '@toolbox-web/grid-vue/features/context-menu';
import '@toolbox-web/grid-vue/features/editing';
import '@toolbox-web/grid-vue/features/export';
import '@toolbox-web/grid-vue/features/filtering';
import '@toolbox-web/grid-vue/features/grouping-columns';
import '@toolbox-web/grid-vue/features/master-detail';
import '@toolbox-web/grid-vue/features/multi-sort';
import '@toolbox-web/grid-vue/features/pinned-columns';
import '@toolbox-web/grid-vue/features/pinned-rows';
import '@toolbox-web/grid-vue/features/reorder-columns';
import '@toolbox-web/grid-vue/features/responsive';
import '@toolbox-web/grid-vue/features/selection';
import '@toolbox-web/grid-vue/features/undo-redo';
import '@toolbox-web/grid-vue/features/visibility';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GridConfigOptions {
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
  /** Custom renderers/editors - passed in from component to keep Vue components in .vue files */
  renderers: {
    status: (value: Employee['status']) => VNode;
    rating: (value: number) => VNode;
    topPerformer: (value: boolean) => VNode;
  };
  editors: {
    bonus: (value: number, salary: number, commit: (v: number) => void, cancel: () => void) => VNode;
    status: (value: Employee['status'], commit: (v: Employee['status']) => void, cancel: () => void) => VNode;
    date: (value: string, commit: (v: string) => void, cancel: () => void) => VNode;
    rating: (value: number, commit: (v: number) => void, cancel: () => void) => VNode;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLUMN GROUPS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Column groups for multi-level headers.
 */
const COLUMN_GROUPS = [
  { id: 'employee', header: 'Employee Info', children: ['firstName', 'lastName', 'email'] },
  { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
  { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
  {
    id: 'status',
    header: 'Status & Performance',
    children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// GRID CONFIG FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the grid configuration for the employee management demo.
 */
export function createGridConfig(options: GridConfigOptions): GridConfig<Employee> {
  const { enableSelection, enableFiltering, enableSorting, enableEditing, enableMasterDetail, renderers, editors } =
    options;

  return {
    shell: {
      header: {
        title: 'Employee Management System (Vue)',
      },
    },
    columnGroups: COLUMN_GROUPS,
    // Declarative feature configuration — features themselves are loaded via
    // side-effect imports in `EmployeeManagement.vue`. Configuring them here
    // (instead of as `<TbwGrid ...>` props) keeps the template tidy and
    // mirrors the React/Angular demos.
    features: {
      selection: enableSelection ? 'range' : undefined,
      multiSort: enableSorting ? 'multi' : undefined,
      filtering: enableFiltering ? { debounceMs: 200 } : undefined,
      editing: enableEditing ? 'dblclick' : undefined,
      undoRedo: enableEditing ? { maxHistorySize: 100 } : undefined,
      clipboard: true,
      contextMenu: true,
      reorderColumns: true,
      visibility: true,
      pinnedColumns: true,
      groupingColumns: { lockGroupOrder: true },
      columnVirtualization: true,
      export: true,
      responsive: RESPONSIVE_CONFIG,
      masterDetail: enableMasterDetail ? { showExpandColumn: true, animation: 'slide' } : undefined,
      pinnedRows: PINNED_ROWS_CONFIG,
    },
    columns: [
      { field: 'id', header: 'ID', type: 'number', width: 70, sortable: enableSorting },
      {
        field: 'firstName',
        header: 'First Name',
        minWidth: 100,
        editable: enableEditing,
        sortable: enableSorting,
        resizable: true,
      },
      {
        field: 'lastName',
        header: 'Last Name',
        minWidth: 100,
        editable: enableEditing,
        sortable: enableSorting,
        resizable: true,
      },
      { field: 'email', header: 'Email', minWidth: 200, resizable: true },
      {
        field: 'department',
        header: 'Dept',
        width: 120,
        sortable: enableSorting,
        editable: enableEditing,
        type: 'select',
        options: DEPARTMENTS.map((d) => ({ label: d, value: d })),
      },
      { field: 'team', header: 'Team', width: 110, sortable: enableSorting },
      { field: 'title', header: 'Title', minWidth: 160, editable: enableEditing, resizable: true },
      {
        field: 'level',
        header: 'Level',
        width: 90,
        sortable: enableSorting,
        editable: enableEditing,
        type: 'select',
        options: ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'].map((l) => ({ label: l, value: l })),
      },
      {
        field: 'salary',
        header: 'Salary',
        width: 110,
        type: 'number',
        sortable: enableSorting,
        format: (v: number) => `$${v.toLocaleString()}`,
      },
      {
        field: 'bonus',
        header: 'Bonus',
        width: 180,
        type: 'number',
        editable: enableEditing,
        sortable: enableSorting,
        format: (v: number) =>
          v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
        editor: (ctx) => editors.bonus(ctx.value as number, (ctx.row as Employee).salary, ctx.commit, ctx.cancel),
      },
      {
        field: 'status',
        header: 'Status',
        width: 140,
        sortable: enableSorting,
        editable: enableEditing,
        renderer: (ctx) => renderers.status(ctx.value as Employee['status']),
        editor: (ctx) => editors.status(ctx.value as Employee['status'], ctx.commit, ctx.cancel),
      },
      {
        field: 'hireDate',
        header: 'Hire Date',
        width: 130,
        type: 'date',
        sortable: enableSorting,
        editable: enableEditing,
        editor: (ctx) => editors.date(ctx.value as string, ctx.commit, ctx.cancel),
      },
      {
        field: 'rating',
        header: 'Rating',
        width: 120,
        type: 'number',
        sortable: enableSorting,
        editable: enableEditing,
        renderer: (ctx) => renderers.rating(ctx.value as number),
        editor: (ctx) => editors.rating(ctx.value as number, ctx.commit, ctx.cancel),
      },
      {
        field: 'isTopPerformer',
        header: '⭐',
        width: 50,
        type: 'boolean',
        sortable: false,
        renderer: (ctx) => renderers.topPerformer(ctx.value as boolean),
      },
      { field: 'location', header: 'Location', width: 110, sortable: enableSorting },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PINNED ROWS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pinned rows configuration for aggregation footer.
 */
export const PINNED_ROWS_CONFIG = {
  slots: [
    {
      id: 'totals',
      position: 'bottom' as const,
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
    { id: 'count', position: 'bottom' as const, render: rowCountPanel() },
    { id: 'filtered', position: 'bottom' as const, render: filteredCountPanel() },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSIVE CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Responsive plugin configuration.
 */
export const RESPONSIVE_CONFIG = {
  breakpoint: 700,
  cardRowHeight: 80,
  hiddenColumns: ['id', 'email', 'team', 'level', 'bonus', 'hireDate', 'isTopPerformer', 'location'],
};

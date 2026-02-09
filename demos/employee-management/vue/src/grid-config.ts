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

import { DEPARTMENTS, type Employee } from '@demo/shared';
// Import Vue-specific GridConfig that accepts VNode renderers/editors
import type { GridConfig } from '@toolbox-web/grid-vue';
import type { VNode } from 'vue';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GridConfigOptions {
  enableSorting: boolean;
  enableEditing: boolean;
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

// ═══════════════════════════════════════════════════════════════════════════════
// GRID CONFIG FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the grid configuration for the employee management demo.
 */
export function createGridConfig(options: GridConfigOptions): GridConfig<Employee> {
  const { enableSorting, enableEditing, renderers, editors } = options;

  return {
    shell: {
      header: {
        title: 'Employee Management System (Vue)',
      },
    },
    columnGroups: COLUMN_GROUPS,
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
  position: 'bottom' as const,
  showRowCount: true,
  showFilteredCount: true,
  aggregationRows: [
    {
      id: 'totals',
      position: 'bottom' as const,
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

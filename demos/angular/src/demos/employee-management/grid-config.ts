/**
 * Grid Configuration for the Employee Management Demo
 *
 * Features are configured declaratively via `gridConfig.features` here.
 * Custom rendering/editing for individual cells uses Angular component classes
 * (e.g. `RatingDisplayComponent`, `StarRatingEditorComponent`) attached to
 * specific column definitions.
 *
 * The Angular template only retains directive bindings that own event
 * outputs the demo subscribes to (e.g. `(filterChange)` via
 * `GridFilteringDirective`).
 */
// ═════════════════════════════════════════════════════════════════════════════
// FEATURE IMPORTS — register the features used in `gridConfig.features` below.
// Each side-effect import calls `registerFeature(name, factory)` so the grid
// can look the factory up by string key when it walks `features`.
// Tree-shakeable: only imported features ship in the bundle.
//
// `editing`, `filtering`, `master-detail`, and `responsive` are imported in
// `employee-management.component.ts` instead because they are also referenced
// from the component's `imports` array (event-bearing directives) or its
// template (`<tbw-grid-detail>`, `<tbw-grid-responsive-card>`).
// ═════════════════════════════════════════════════════════════════════════════
import '@toolbox-web/grid-angular/features/clipboard';
import '@toolbox-web/grid-angular/features/column-virtualization';
import '@toolbox-web/grid-angular/features/context-menu';
import '@toolbox-web/grid-angular/features/export';
import '@toolbox-web/grid-angular/features/grouping-columns';
import '@toolbox-web/grid-angular/features/multi-sort';
import '@toolbox-web/grid-angular/features/pinned-columns';
import '@toolbox-web/grid-angular/features/pinned-rows';
import '@toolbox-web/grid-angular/features/reorder-columns';
import '@toolbox-web/grid-angular/features/selection';
import '@toolbox-web/grid-angular/features/undo-redo';
import '@toolbox-web/grid-angular/features/visibility';

import { DEPARTMENTS, type Employee } from '@demo/shared/employee-management';
import type { GridConfig } from '@toolbox-web/grid-angular';
import { filteredCountPanel, rowCountPanel } from '@toolbox-web/grid/plugins/pinned-rows';
import { StarRatingEditorComponent } from './editors/star-rating-editor.component';
import { RatingDisplayComponent } from './renderers/rating-display.component';

export interface GridConfigOptions {
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
}

/**
 * Column groups for the employee grid.
 * Used in the gridConfig.columnGroups configuration.
 */
export const COLUMN_GROUPS = [
  { id: 'employee', header: 'Employee Info', children: ['firstName', 'lastName', 'email'] },
  {
    id: 'organization',
    header: 'Organization',
    children: ['department', 'team', 'title', 'level'],
  },
  { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
  {
    id: 'status',
    header: 'Status & Performance',
    children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
  },
];

export function createGridConfig(options: GridConfigOptions): GridConfig<Employee> {
  const { enableSelection, enableFiltering, enableSorting, enableEditing, enableMasterDetail } =
    options;

  return {
    // Column groups (augmented by GroupingColumnsPlugin)
    columnGroups: COLUMN_GROUPS,
    // Column definitions - templates come from light DOM via Angular adapter
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
        options: ['Junior', 'Mid', 'Senior', 'Lead', 'Principal', 'Director'].map((l) => ({
          label: l,
          value: l,
        })),
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
          v.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }),
      },
      {
        field: 'bonus',
        header: 'Bonus',
        type: 'number',
        width: 180,
        sortable: true,
        editable: enableEditing,
        // editor comes from light DOM template
        format: (v: number) =>
          v.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }),
      },
      {
        field: 'status',
        header: 'Status',
        width: 140,
        sortable: true,
        editable: enableEditing,
        // editor and viewRenderer come from light DOM templates
      },
      {
        field: 'hireDate',
        header: 'Hire Date',
        type: 'date',
        width: 130,
        sortable: true,
        editable: enableEditing,
        // editor comes from light DOM template
      },
      {
        field: 'rating',
        header: 'Rating',
        type: 'number',
        width: 120,
        sortable: true,
        editable: enableEditing,
        // Component-class based renderer and editor (no template needed!)
        renderer: RatingDisplayComponent,
        editor: StarRatingEditorComponent,
      },
      { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50, sortable: false },
      { field: 'location', header: 'Location', width: 110, sortable: true },
    ],
    // Shell configuration
    shell: {
      toolPanel: { position: 'right', width: 300 },
    },

    // Grid-wide feature toggles (used by plugins that support enable/disable)
    sortable: enableSorting,
    filterable: enableFiltering,
    selectable: enableSelection,

    // Declarative feature configuration. The Angular template no longer
    // carries `[clipboard]` / `[contextMenu]` / `[reorderColumns]` / etc.
    // bindings — those features are configured here. Directives that own
    // event outputs the demo subscribes to (e.g. `GridFilteringDirective`
    // → `(filterChange)`) remain in the component's `imports`, but their
    // input is empty and feature config flows through here.
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
      columnVirtualization: true,
      export: true,
      groupingColumns: { lockGroupOrder: true },
      responsive: {
        breakpoint: 700,
        cardRowHeight: 80,
        hiddenColumns: [
          'id',
          'email',
          'team',
          'level',
          'bonus',
          'hireDate',
          'isTopPerformer',
          'location',
        ],
      },
      masterDetail: enableMasterDetail
        ? { showExpandColumn: true, animation: 'slide' as const }
        : undefined,
      pinnedRows: {
        slots: [
          {
            id: 'totals',
            position: 'bottom',
            label: 'Summary:',
            cells: {
              salary: (rows: unknown[]) =>
                (rows as Employee[])
                  .reduce((acc, r) => acc + (r.salary || 0), 0)
                  .toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }),
              bonus: (rows: unknown[]) =>
                (rows as Employee[])
                  .reduce((acc, r) => acc + (r.bonus || 0), 0)
                  .toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }),
              rating: (rows: unknown[]) => {
                const vals = (rows as Employee[]).map((r) => r.rating).filter(Boolean);
                return vals.length
                  ? `Avg: ${(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)}`
                  : '';
              },
            },
          },
          { id: 'count', position: 'bottom', render: rowCountPanel() },
          { id: 'filtered', position: 'bottom', render: filteredCountPanel() },
        ],
      },
    },
  };
}

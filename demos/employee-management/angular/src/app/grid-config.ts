/**
 * Grid Configuration for the Employee Management Demo
 *
 * This demo uses a **hybrid pattern** combining both approaches:
 *
 * **Feature Inputs** (in template) for always-on features:
 * ```html
 * <tbw-grid [clipboard]="true" [contextMenu]="true" [reorder]="true" ... />
 * ```
 *
 * **Plugin-based** (here) for features that need:
 * - Dynamic toggling via checkboxes (selection, filtering, sorting, editing)
 * - Complex configuration (pinned-rows with aggregation)
 * - Conditional loading (master-detail, undo-redo)
 *
 * Both patterns merge seamlessly - plugins from feature inputs are combined with gridConfig.plugins.
 */
import { DEPARTMENTS, type Employee } from '@demo/shared';
import type { GridConfig } from '@toolbox-web/grid-angular';
// Only import plugins needed for dynamic toggling or complex configuration.
// Always-on features use feature inputs in app.component.ts instead.
// Exceptions: GroupingColumnsPlugin (columnGroups config), ResponsivePlugin (<tbw-grid-responsive-card>)
import {
  EditingPlugin,
  FilteringPlugin,
  GroupingColumnsPlugin,
  MasterDetailPlugin,
  MultiSortPlugin,
  PinnedRowsPlugin,
  ResponsivePlugin,
  SelectionPlugin,
  UndoRedoPlugin,
} from '@toolbox-web/grid/all';
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
 * Exported so the column-move constraint handler can reference them.
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

    // Always-on features configured via feature inputs in the template:
    // [clipboard], [contextMenu], [reorder], [visibility], [pinnedColumns],
    // [columnVirtualization], [export]
    //
    // Dynamic features (toggled via checkboxes) configured via plugins:
    plugins: [
      // GroupingColumnsPlugin: uses columnGroups config property
      new GroupingColumnsPlugin(),
      // ResponsivePlugin: uses <tbw-grid-responsive-card> template element
      new ResponsivePlugin({
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
      }),
      // Core interaction plugins - always loaded, controlled via config flags above
      new SelectionPlugin({ mode: 'range' }),
      new MultiSortPlugin(),
      new FilteringPlugin({ debounceMs: 200 }),
      // EditingPlugin always loaded; toggle via editOn to avoid validation errors
      new EditingPlugin({ editOn: enableEditing ? 'dblclick' : false }),
      // MasterDetailPlugin - detail renderer comes from <tbw-grid-detail> in Angular component
      ...(enableMasterDetail
        ? [
            new MasterDetailPlugin({
              showExpandColumn: true,
              animation: 'slide',
            }),
          ]
        : []),
      // UndoRedoPlugin always loaded since EditingPlugin is always loaded
      new UndoRedoPlugin({ maxHistorySize: 100 }),
      // PinnedRowsPlugin has complex aggregation config, keeping as plugin
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
        ],
      }),
    ],
  };
}

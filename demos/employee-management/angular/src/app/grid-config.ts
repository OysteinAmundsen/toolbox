import { DEPARTMENTS, type Employee } from '@demo/shared';
import type { GridConfig } from '@toolbox-web/grid';
import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
  EditingPlugin,
  ExportPlugin,
  FilteringPlugin,
  GroupingColumnsPlugin,
  MultiSortPlugin,
  PinnedColumnsPlugin,
  PinnedRowsPlugin,
  ReorderPlugin,
  SelectionPlugin,
  UndoRedoPlugin,
  VisibilityPlugin,
} from '@toolbox-web/grid/all';

export interface GridConfigOptions {
  enableSelection: boolean;
  enableFiltering: boolean;
  enableSorting: boolean;
  enableEditing: boolean;
  enableMasterDetail: boolean;
}

export function createGridConfig(options: GridConfigOptions): GridConfig {
  const { enableSelection, enableFiltering, enableSorting, enableEditing } = options;

  return {
    // Column groups (augmented by GroupingColumnsPlugin)
    columnGroups: [
      {
        id: 'employee',
        header: 'Employee Info',
        children: ['id', 'firstName', 'lastName', 'email'],
      },
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
    ],
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
        // editor and viewRenderer come from light DOM templates
      },
      { field: 'isTopPerformer', header: '⭐', type: 'boolean', width: 50 },
      { field: 'location', header: 'Location', width: 110, sortable: true },
    ],
    // Shell configuration
    shell: {
      toolPanel: { position: 'right', width: 300 },
    },
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
      // MasterDetailPlugin is added automatically by Grid directive when <tbw-grid-detail> is present
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

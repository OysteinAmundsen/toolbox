/**
 * Employee Management Demo - React Implementation
 *
 * This demo showcases @toolbox-web/grid-react in a React application.
 * It matches the visual design and functionality of the vanilla and Angular demos.
 *
 * Uses the "React way" with:
 * - ReactGridConfig with `renderer` and `editor` for inline React components
 *   (same property names as vanilla JS - ReactGridConfig wraps them for React)
 * - GridDetailPanel for declarative master-detail panels
 * - GridToolPanel for custom sidebar panels
 * - GridToolButtons for toolbar actions
 * - customStyles for shadow DOM styling
 *
 * Alternative: GridColumn components can also define renderers/editors in JSX.
 */

import type { TbwGrid } from '@toolbox-web/grid';
import {
  DataGrid,
  GridDetailPanel,
  GridToolButtons,
  GridToolPanel,
  useGrid,
  type ReactGridConfig,
} from '@toolbox-web/grid-react';
import {
  ClipboardPlugin,
  ColumnVirtualizationPlugin,
  ContextMenuPlugin,
  EditingPlugin,
  ExportPlugin,
  FilteringPlugin,
  GroupingColumnsPlugin,
  MasterDetailPlugin,
  MultiSortPlugin,
  PinnedColumnsPlugin,
  PinnedRowsPlugin,
  ReorderPlugin,
  SelectionPlugin,
  UndoRedoPlugin,
  VisibilityPlugin,
} from '@toolbox-web/grid/all';
import { useCallback, useMemo, useState } from 'react';

// Import shared data, types, and styles
import { DEPARTMENTS, generateEmployees, type Employee } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';

// Import React-specific renderers and editors (matching Angular pattern)
import { BonusSliderEditor } from './components/editors/BonusSliderEditor';
import { DateEditor } from './components/editors/DateEditor';
import { StarRatingEditor } from './components/editors/StarRatingEditor';
import { StatusSelectEditor } from './components/editors/StatusSelectEditor';
import { DetailPanel } from './components/renderers/DetailPanel';
import { RatingDisplay } from './components/renderers/RatingDisplay';
import { StatusBadge } from './components/renderers/StatusBadge';
import { TopPerformerStar } from './components/renderers/TopPerformerStar';
import { AnalyticsPanel, QuickFiltersPanel } from './components/tool-panels';

export function App() {
  // Generate demo data
  const [rowCount, setRowCount] = useState(200);
  const [employees, setEmployees] = useState<Employee[]>(() => generateEmployees(rowCount));

  // Grid ref for programmatic access
  const { ref, isReady } = useGrid<Employee>();

  // Demo options
  const [enableSelection, setEnableSelection] = useState(true);
  const [enableFiltering, setEnableFiltering] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [enableEditing, setEnableEditing] = useState(true);
  const [enableMasterDetail, setEnableMasterDetail] = useState(true);

  // Handle row count change
  const handleRowCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = parseInt(e.target.value, 10);
    setRowCount(newCount);
    setEmployees(generateEmployees(newCount));
  }, []);

  // Create grid config with plugins and React renderers/editors inline
  // Using ReactGridConfig allows reactRenderer/reactEditor properties
  const gridConfig = useMemo<ReactGridConfig<Employee>>(
    () => ({
      shell: {
        header: {
          title: 'Employee Management System',
        },
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
        { field: 'team', header: 'Team', minWidth: 100, resizable: true },
        { field: 'title', header: 'Title', minWidth: 150, resizable: true },
        {
          field: 'level',
          header: 'Level',
          width: 100,
          sortable: enableSorting,
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
        // bonus, status, hireDate, rating, isTopPerformer - using renderer/editor inline
        // Same property names as vanilla JS - ReactGridConfig wraps them for React
        {
          field: 'bonus',
          header: 'Bonus',
          width: 180,
          type: 'number',
          editable: enableEditing,
          sortable: enableSorting,
          format: (v: number) =>
            v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
          // React editor defined inline - same syntax as vanilla!
          editor: (ctx) => (
            <BonusSliderEditor value={ctx.value} salary={ctx.row.salary} onCommit={ctx.commit} onCancel={ctx.cancel} />
          ),
        },
        {
          field: 'status',
          header: 'Status',
          width: 140,
          sortable: enableSorting,
          editable: enableEditing,
          // Both renderer and editor inline
          renderer: (ctx) => <StatusBadge value={ctx.value} />,
          editor: (ctx) => <StatusSelectEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />,
        },
        {
          field: 'hireDate',
          header: 'Hire Date',
          width: 130,
          type: 'date',
          sortable: enableSorting,
          editable: enableEditing,
          // Only custom editor - grid uses type="date" formatting for display
          editor: (ctx) => <DateEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />,
        },
        {
          field: 'rating',
          header: 'Rating',
          width: 120,
          type: 'number',
          sortable: enableSorting,
          editable: enableEditing,
          // Both renderer and editor inline
          renderer: (ctx) => <RatingDisplay value={ctx.value} />,
          editor: (ctx) => <StarRatingEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />,
        },
        {
          field: 'isTopPerformer',
          header: '⭐',
          width: 50,
          type: 'boolean',
          // Only renderer - no editor needed
          renderer: (ctx) => <TopPerformerStar value={ctx.value} />,
        },
        { field: 'location', header: 'Location', width: 110, sortable: enableSorting },
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
        // MasterDetailPlugin is added when enableMasterDetail is true
        // The detail renderer is provided declaratively via GridDetailPanel
        ...(enableMasterDetail
          ? [
              new MasterDetailPlugin({
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
    }),
    [enableSelection, enableFiltering, enableSorting, enableEditing, enableMasterDetail, ref],
  );

  // Handle row changes
  const handleRowsChange = useCallback((rows: Employee[]) => {
    setEmployees(rows);
  }, []);

  return (
    <div id="app">
      <div className="demo-container">
        <header className="demo-header">
          <div className="demo-controls">
            <label>
              <span className="row-count-display">
                Rows: <strong>{rowCount}</strong>
              </span>
              <input type="range" min="50" max="1000" step="50" value={rowCount} onChange={handleRowCountChange} />
            </label>
            <label>
              <input type="checkbox" checked={enableSelection} onChange={(e) => setEnableSelection(e.target.checked)} />{' '}
              Selection
            </label>
            <label>
              <input type="checkbox" checked={enableFiltering} onChange={(e) => setEnableFiltering(e.target.checked)} />{' '}
              Filtering
            </label>
            <label>
              <input type="checkbox" checked={enableSorting} onChange={(e) => setEnableSorting(e.target.checked)} />{' '}
              Sorting
            </label>
            <label>
              <input type="checkbox" checked={enableEditing} onChange={(e) => setEnableEditing(e.target.checked)} />{' '}
              Editing
            </label>
            <label>
              <input
                type="checkbox"
                checked={enableMasterDetail}
                onChange={(e) => setEnableMasterDetail(e.target.checked)}
              />{' '}
              Master-Detail
            </label>
          </div>
        </header>

        <div className="grid-wrapper">
          <DataGrid
            ref={ref}
            rows={employees}
            gridConfig={gridConfig}
            onRowsChange={handleRowsChange}
            customStyles={shadowDomStyles}
            className="demo-grid"
          >
            {/* Toolbar buttons via declarative light DOM container */}
            <GridToolButtons>
              <button
                className="tbw-toolbar-btn"
                title="Export CSV"
                aria-label="Export CSV"
                onClick={() => {
                  const grid = ref.current as TbwGrid<Employee> | null;
                  grid?.getPlugin?.(ExportPlugin)?.exportCsv?.({ fileName: 'employees' });
                }}
              >
                📄
              </button>
              <button
                className="tbw-toolbar-btn"
                title="Export Excel"
                aria-label="Export Excel"
                onClick={() => {
                  const grid = ref.current as TbwGrid<Employee> | null;
                  grid?.getPlugin?.(ExportPlugin)?.exportExcel?.({ fileName: 'employees' });
                }}
              >
                📊
              </button>
            </GridToolButtons>

            {/* Custom tool panels for sidebar */}
            <GridToolPanel id="quick-filters" title="Quick Filters" icon="🔍" order={10}>
              {({ grid }) => <QuickFiltersPanel grid={grid} />}
            </GridToolPanel>

            <GridToolPanel id="analytics" title="Analytics" icon="📈" order={20}>
              {({ grid }) => <AnalyticsPanel grid={grid} />}
            </GridToolPanel>

            {/*
             * NOTE: Custom renderers/editors for status, bonus, rating, hireDate, isTopPerformer
             * are now defined inline in gridConfig.columns using reactRenderer/reactEditor!
             * This eliminates the need for separate GridColumn elements for these fields.
             *
             * Alternative approach (also supported):
             *   <GridColumn field="status" editor={(ctx) => <Editor ... />}>
             *     {(ctx) => <Renderer ... />}
             *   </GridColumn>
             *
             * Both approaches work and can be mixed. Use gridConfig for collocated config,
             * or GridColumn JSX for more complex scenarios requiring React context/hooks.
             */}

            {/* Master-detail panel with declarative React component */}
            {enableMasterDetail && (
              <GridDetailPanel<Employee> showExpandColumn animation="slide">
                {({ row }) => <DetailPanel employee={row} />}
              </GridDetailPanel>
            )}
          </DataGrid>
        </div>
      </div>
    </div>
  );
}

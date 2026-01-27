/**
 * Employee Management Demo - React Implementation
 *
 * This demo showcases @toolbox-web/grid-react best practices:
 * - Feature props for declarative plugin configuration (no manual plugin imports)
 * - Event props for automatic cleanup (no useEffect for events)
 * - ReactGridConfig for inline React renderers/editors
 * - GridDetailPanel for declarative master-detail panels
 * - GridToolPanel for custom sidebar panels
 * - GridToolButtons for toolbar actions
 * - Enhanced useGrid with convenience methods
 *
 * The grid matches visual design and functionality across all framework demos.
 */

import {
  DataGrid,
  GridDetailPanel,
  GridResponsiveCard,
  GridToolButtons,
  GridToolPanel,
  useGrid,
  type ReactGridConfig,
} from '@toolbox-web/grid-react';
import type { ColumnMoveDetail } from '@toolbox-web/grid/plugins/reorder';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Import shared data, types, and styles
import { DEPARTMENTS, generateEmployees, type Employee } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';

// Import React-specific renderers and editors
import { BonusSliderEditor } from './components/editors/BonusSliderEditor';
import { DateEditor } from './components/editors/DateEditor';
import { StarRatingEditor } from './components/editors/StarRatingEditor';
import { StatusSelectEditor } from './components/editors/StatusSelectEditor';
import { DetailPanel } from './components/renderers/DetailPanel';
import { RatingDisplay } from './components/renderers/RatingDisplay';
import { ResponsiveEmployeeCard } from './components/renderers/ResponsiveEmployeeCard';
import { StatusBadge } from './components/renderers/StatusBadge';
import { TopPerformerStar } from './components/renderers/TopPerformerStar';
import { AnalyticsPanel, QuickFiltersPanel } from './components/tool-panels';

export function App() {
  // Generate demo data
  const [rowCount, setRowCount] = useState(200);
  const [employees, setEmployees] = useState<Employee[]>(() => generateEmployees(rowCount));

  // Enhanced useGrid with convenience methods
  const { ref, isReady, exportToCsv } = useGrid<Employee>();

  // Demo options - toggle features dynamically
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

  // Column groups for multi-level headers
  const columnGroups = useMemo(
    () => [
      { id: 'employee', header: 'Employee Info', children: ['firstName', 'lastName', 'email'] },
      { id: 'organization', header: 'Organization', children: ['department', 'team', 'title', 'level'] },
      { id: 'compensation', header: 'Compensation', children: ['salary', 'bonus'] },
      {
        id: 'status',
        header: 'Status & Performance',
        children: ['status', 'hireDate', 'rating', 'isTopPerformer', 'location'],
      },
    ],
    [],
  );

  // Cancelable column-move handler: enforce group contiguity
  // This is the one event that needs useEffect because it calls preventDefault()
  useEffect(() => {
    const grid = ref.current?.element;
    if (!grid || !isReady) return;

    const handler = (e: Event) => {
      const event = e as CustomEvent<ColumnMoveDetail>;
      const { field, columnOrder } = event.detail;

      // Find which group this field belongs to
      const sourceGroup = columnGroups.find((g) => g.children.includes(field));
      if (!sourceGroup) return;

      // Get the indices of all columns in the source group
      const groupColumnIndices = sourceGroup.children
        .map((f) => columnOrder.indexOf(f))
        .filter((i) => i !== -1)
        .sort((a, b) => a - b);

      if (groupColumnIndices.length <= 1) return;

      // Check if the group columns are contiguous
      const minIndex = groupColumnIndices[0];
      const maxIndex = groupColumnIndices[groupColumnIndices.length - 1];
      const isContiguous = groupColumnIndices.length === maxIndex - minIndex + 1;

      if (!isContiguous) {
        console.log(`[Column Move Cancelled] Cannot move "${field}" outside its group "${sourceGroup.id}"`);
        event.preventDefault();

        // Flash error animation
        const headerCell = grid.querySelector(`.header-row .cell[data-field="${field}"]`) as HTMLElement;
        if (headerCell) {
          headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
          headerCell.animate(
            [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
            { duration: 400, easing: 'ease-out' },
          );
        }
      }
    };

    grid.addEventListener('column-move', handler);
    return () => grid.removeEventListener('column-move', handler);
  }, [ref, columnGroups, isReady]);

  // Grid configuration with React renderers/editors
  const gridConfig = useMemo<ReactGridConfig<Employee>>(
    () => ({
      shell: {
        header: {
          title: 'Employee Management System (React)',
        },
      },
      columnGroups,
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
          editor: (ctx) => <DateEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />,
        },
        {
          field: 'rating',
          header: 'Rating',
          width: 120,
          type: 'number',
          sortable: enableSorting,
          editable: enableEditing,
          renderer: (ctx) => <RatingDisplay value={ctx.value} />,
          editor: (ctx) => <StarRatingEditor value={ctx.value} onCommit={ctx.commit} onCancel={ctx.cancel} />,
        },
        {
          field: 'isTopPerformer',
          header: '⭐',
          width: 50,
          type: 'boolean',
          sortable: false,
          renderer: (ctx) => <TopPerformerStar value={ctx.value} />,
        },
        { field: 'location', header: 'Location', width: 110, sortable: enableSorting },
      ],
    }),
    [columnGroups, enableSorting, enableEditing],
  );

  // Pinned rows config for aggregation
  const pinnedRowsConfig = useMemo(
    () => ({
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
    }),
    [],
  );

  // Responsive config for mobile/narrow layouts
  const responsiveConfig = useMemo(
    () => ({
      breakpoint: 700,
      cardRowHeight: 80,
      hiddenColumns: ['id', 'email', 'team', 'level', 'bonus', 'hireDate', 'isTopPerformer', 'location'],
    }),
    [],
  );

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
            customStyles={shadowDomStyles}
            className="demo-grid"
            // ═══════════════════════════════════════════════════════════════
            // FEATURE PROPS - Declarative plugin configuration
            // No plugin imports needed - plugins are lazy-loaded automatically
            // ═══════════════════════════════════════════════════════════════
            selection={enableSelection ? 'range' : undefined}
            sorting={enableSorting ? 'multi' : undefined}
            filtering={enableFiltering ? { debounceMs: 200 } : undefined}
            editing={enableEditing ? 'dblclick' : undefined}
            undoRedo={enableEditing ? { maxHistorySize: 100 } : undefined}
            clipboard
            contextMenu
            reorder
            visibility
            pinnedColumns
            groupingColumns
            columnVirtualization
            export
            responsive={responsiveConfig}
            masterDetail={enableMasterDetail ? { showExpandColumn: true, animation: 'slide' } : undefined}
            pinnedRows={pinnedRowsConfig}
            // ═══════════════════════════════════════════════════════════════
            // EVENT PROPS - Automatic cleanup, no useEffect needed
            // ═══════════════════════════════════════════════════════════════
            onRowsChange={setEmployees}
          >
            {/* Toolbar buttons using enhanced useGrid methods */}
            <GridToolButtons>
              <button
                className="tbw-toolbar-btn"
                title="Export CSV"
                aria-label="Export CSV"
                onClick={() => exportToCsv('employees.csv')}
              >
                📄
              </button>
              <button
                className="tbw-toolbar-btn"
                title="Export Excel"
                aria-label="Export Excel"
                onClick={() => {
                  // Excel export still needs plugin access for advanced options
                  const grid = ref.current?.element as any;
                  grid?.getPluginByName?.('export')?.exportExcel?.({ fileName: 'employees' });
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

            {/* Master-detail panel with declarative React component */}
            {enableMasterDetail && (
              <GridDetailPanel<Employee>>{({ row }) => <DetailPanel employee={row} />}</GridDetailPanel>
            )}

            {/* Responsive card for mobile/narrow layouts */}
            <GridResponsiveCard<Employee>>{({ row }) => <ResponsiveEmployeeCard employee={row} />}</GridResponsiveCard>
          </DataGrid>
        </div>
      </div>
    </div>
  );
}

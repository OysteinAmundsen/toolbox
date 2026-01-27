/**
 * Employee Management Demo - React Implementation
 *
 * This demo showcases @toolbox-web/grid-react best practices:
 * - Feature imports for tree-shakeable plugin loading (side-effect imports)
 * - Feature props for declarative plugin configuration
 * - Event props for automatic cleanup (no useEffect for events)
 * - ReactGridConfig for inline React renderers/editors
 * - GridDetailPanel for declarative master-detail panels
 * - GridToolPanel for custom sidebar panels
 * - GridToolButtons for toolbar actions
 * - Enhanced useGrid with convenience methods
 *
 * The grid matches visual design and functionality across all framework demos.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE IMPORTS - Register features you want to use (tree-shakeable)
// Each import adds ~50 bytes + the plugin itself to your bundle.
// Only import what you need - unused features are not bundled.
// ═══════════════════════════════════════════════════════════════════════════════
import '@toolbox-web/grid-react/features/clipboard';
import '@toolbox-web/grid-react/features/column-virtualization';
import '@toolbox-web/grid-react/features/context-menu';
import '@toolbox-web/grid-react/features/editing';
import '@toolbox-web/grid-react/features/export';
import '@toolbox-web/grid-react/features/filtering';
import '@toolbox-web/grid-react/features/grouping-columns';
import '@toolbox-web/grid-react/features/master-detail';
import '@toolbox-web/grid-react/features/pinned-columns';
import '@toolbox-web/grid-react/features/pinned-rows';
import '@toolbox-web/grid-react/features/reorder';
import '@toolbox-web/grid-react/features/responsive';
import '@toolbox-web/grid-react/features/selection';
import '@toolbox-web/grid-react/features/sorting';
import '@toolbox-web/grid-react/features/undo-redo';
import '@toolbox-web/grid-react/features/visibility';

import {
  DataGrid,
  GridDetailPanel,
  GridResponsiveCard,
  GridToolButtons,
  GridToolPanel,
  useGrid,
  type DetailPanelContext,
  type ResponsiveCardContext,
  type ToolPanelContext,
} from '@toolbox-web/grid-react';
import type { ColumnMoveDetail } from '@toolbox-web/grid/plugins/reorder';
import { useCallback, useMemo, useState } from 'react';

// Import shared data, types, and styles
import { generateEmployees, type Employee } from '@demo/shared';
import { shadowDomStyles } from '@demo/shared/styles';

// Grid configuration (columns, groups, pinned rows, responsive)
import { COLUMN_GROUPS, createGridConfig, PINNED_ROWS_CONFIG, RESPONSIVE_CONFIG } from './grid-config';

// React-specific renderers and editors
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
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [rowCount, setRowCount] = useState(200);
  const [employees, setEmployees] = useState<Employee[]>(() => generateEmployees(rowCount));

  // Demo options - toggle features dynamically
  const [enableSelection, setEnableSelection] = useState(true);
  const [enableFiltering, setEnableFiltering] = useState(true);
  const [enableSorting, setEnableSorting] = useState(true);
  const [enableEditing, setEnableEditing] = useState(true);
  const [enableMasterDetail, setEnableMasterDetail] = useState(true);

  // Enhanced useGrid with convenience methods
  const { ref, exportToCsv } = useGrid<Employee>();

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleRowCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = parseInt(e.target.value, 10);
    setRowCount(newCount);
    setEmployees(generateEmployees(newCount));
  }, []);

  /**
   * Column group contiguity constraint.
   * Prevents moving columns outside their group.
   */
  const handleColumnMove = useCallback(
    (detail: ColumnMoveDetail, event?: Event) => {
      const { field, columnOrder } = detail;

      // Find which group this field belongs to
      const sourceGroup = COLUMN_GROUPS.find((g) => g.children.includes(field));
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
        event?.preventDefault();

        // Flash error animation
        const grid = ref.current?.element;
        const headerCell = grid?.querySelector(`.header-row .cell[data-field="${field}"]`) as HTMLElement;
        if (headerCell) {
          headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
          headerCell.animate(
            [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
            { duration: 400, easing: 'ease-out' },
          );
        }
      }
    },
    [ref],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const gridConfig = useMemo(
    () =>
      createGridConfig({
        enableSorting,
        enableEditing,
        // Renderers - map value to JSX
        renderers: {
          status: (value) => <StatusBadge value={value} />,
          rating: (value) => <RatingDisplay value={value} />,
          topPerformer: (value) => <TopPerformerStar value={value} />,
        },
        // Editors - map value + callbacks to JSX
        editors: {
          bonus: (value, salary, commit, cancel) => (
            <BonusSliderEditor value={value} salary={salary} onCommit={commit} onCancel={cancel} />
          ),
          status: (value, commit, cancel) => <StatusSelectEditor value={value} onCommit={commit} onCancel={cancel} />,
          date: (value, commit, cancel) => <DateEditor value={value} onCommit={commit} onCancel={cancel} />,
          rating: (value, commit, cancel) => <StarRatingEditor value={value} onCommit={commit} onCancel={cancel} />,
        },
      }),
    [enableSorting, enableEditing],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div id="app">
      <div className="demo-container">
        {/* Demo Controls Header */}
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

        {/* Grid */}
        <div className="grid-wrapper">
          <DataGrid
            ref={ref}
            rows={employees}
            gridConfig={gridConfig}
            customStyles={shadowDomStyles}
            className="demo-grid"
            // ═══════════════════════════════════════════════════════════════
            // FEATURE PROPS - Declarative plugin configuration
            // Features are registered via imports at the top of this file.
            // Props configure the plugins - no async loading, no HTTP requests!
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
            responsive={RESPONSIVE_CONFIG}
            masterDetail={enableMasterDetail ? { showExpandColumn: true, animation: 'slide' } : undefined}
            pinnedRows={PINNED_ROWS_CONFIG}
            // ═══════════════════════════════════════════════════════════════
            // EVENT PROPS - Automatic cleanup, no useEffect needed
            // ═══════════════════════════════════════════════════════════════
            onRowsChange={setEmployees}
            onColumnMove={handleColumnMove}
          >
            {/* Toolbar buttons */}
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
                  const grid = ref.current?.element as any;
                  grid?.getPluginByName?.('export')?.exportExcel?.({ fileName: 'employees' });
                }}
              >
                📊
              </button>
            </GridToolButtons>

            {/* Custom tool panels */}
            <GridToolPanel id="quick-filters" title="Quick Filters" icon="🔍" order={10}>
              {({ grid }: ToolPanelContext) => <QuickFiltersPanel grid={grid} />}
            </GridToolPanel>

            <GridToolPanel id="analytics" title="Analytics" icon="📈" order={20}>
              {({ grid }: ToolPanelContext) => <AnalyticsPanel grid={grid} />}
            </GridToolPanel>

            {/* Master-detail panel */}
            {enableMasterDetail && (
              <GridDetailPanel<Employee>>
                {({ row }: DetailPanelContext<Employee>) => <DetailPanel employee={row} />}
              </GridDetailPanel>
            )}

            {/* Responsive card for mobile/narrow layouts */}
            <GridResponsiveCard<Employee>>
              {({ row }: ResponsiveCardContext<Employee>) => <ResponsiveEmployeeCard employee={row} />}
            </GridResponsiveCard>
          </DataGrid>
        </div>
      </div>
    </div>
  );
}

/**
 * Employee Management Demo - React Implementation
 *
 * This demo showcases @toolbox-web/grid-react best practices:
 * - Feature imports for tree-shakeable plugin loading (side-effect imports)
 * - Feature props for declarative plugin configuration
 * - Event props for automatic cleanup (no useEffect for events)
 * - GridConfig for inline React renderers/editors
 * - GridDetailPanel for declarative master-detail panels
 * - GridToolPanel for custom sidebar panels
 * - GridToolButtons for toolbar actions
 * - Enhanced useGrid with convenience methods
 *
 * The grid matches visual design and functionality across all framework demos.
 *
 * NOTE: Feature side-effect imports (`@toolbox-web/grid-react/features/*`) live
 * next to the configuration in `./grid-config.ts`, since that's where the
 * matching `gridConfig.features` keys are declared.
 */

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
import { useGridExport } from '@toolbox-web/grid-react/features/export';
import { useCallback, useMemo, useState } from 'react';

// Import shared data, types, and styles
import { generateEmployees, type Employee } from '@demo/shared/employee-management';
import { shadowDomStyles } from '@demo/shared/employee-management/styles';

// Grid configuration (columns, groups, pinned rows, responsive, features)
import { createGridConfig } from './grid-config';

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

export function EmployeeManagement() {
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

  // Enhanced useGrid for ref access
  const { ref } = useGrid<Employee>();

  // Feature-scoped hook for export control
  const { exportToCsv, exportToExcel } = useGridExport<Employee>();

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  const handleRowCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newCount = parseInt(e.target.value, 10);
    setRowCount(newCount);
    setEmployees(generateEmployees(newCount));
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // GRID CONFIG
  // ═══════════════════════════════════════════════════════════════════════════
  const gridConfig = useMemo(
    () =>
      createGridConfig({
        enableSelection,
        enableFiltering,
        enableSorting,
        enableEditing,
        enableMasterDetail,
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
    [enableSelection, enableFiltering, enableSorting, enableEditing, enableMasterDetail],
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
            // Features are configured declaratively inside `gridConfig.features`
            // (see `grid-config.ts`). Keeps the template tidy and lets the same
            // config drive the docs demo.
            // ═══════════════════════════════════════════════════════════════
            // EVENT PROPS - Automatic cleanup, no useEffect needed
            // ═══════════════════════════════════════════════════════════════
            onRowsChange={setEmployees}
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
                onClick={() => exportToExcel('employees.xlsx')}
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

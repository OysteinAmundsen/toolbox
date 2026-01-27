/**
 * Feature props type definitions for declarative grid plugin configuration.
 *
 * These types allow developers to enable grid features using simple props
 * instead of manual plugin instantiation.
 *
 * @example
 * ```tsx
 * <DataGrid
 *   rows={data}
 *   columns={columns}
 *   selection="range"
 *   editing="dblclick"
 *   filtering
 *   sorting="multi"
 * />
 * ```
 */

import type { ReactNode } from 'react';

// Import plugin config types from the all bundle for monorepo compatibility
import type {
  ClipboardConfig,
  ColumnVirtualizationConfig,
  ContextMenuConfig,
  ExportConfig,
  FilterConfig,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  MasterDetailConfig,
  MultiSortConfig,
  PinnedRowsConfig,
  PivotConfig,
  PrintConfig,
  ReorderConfig,
  ResponsivePluginConfig,
  RowReorderConfig,
  SelectionConfig,
  ServerSideConfig,
  TreeConfig,
  UndoRedoConfig,
  VisibilityConfig,
} from '@toolbox-web/grid/all';

/**
 * Feature props for declarative plugin configuration.
 * Each prop lazily loads its corresponding plugin when used.
 *
 * @template TRow - The row data type
 */
export interface FeatureProps<TRow = unknown> {
  // ═══════════════════════════════════════════════════════════════════
  // SELECTION & INTERACTION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable cell/row/range selection.
   *
   * @example
   * ```tsx
   * // Shorthand - just the mode
   * <DataGrid selection="range" />
   *
   * // Full config
   * <DataGrid selection={{ mode: 'range', checkbox: true }} />
   * ```
   */
  selection?: 'cell' | 'row' | 'range' | SelectionConfig<TRow>;

  /**
   * Enable inline cell editing.
   *
   * @example
   * ```tsx
   * // Enable with default trigger (dblclick)
   * <DataGrid editing />
   *
   * // Specify trigger
   * <DataGrid editing="click" />
   * <DataGrid editing="dblclick" />
   * <DataGrid editing="manual" />
   * ```
   */
  editing?: boolean | 'click' | 'dblclick' | 'manual';

  /**
   * Enable clipboard copy/paste.
   * Requires selection to be enabled (will be auto-added).
   *
   * @example
   * ```tsx
   * <DataGrid selection="range" clipboard />
   * ```
   */
  clipboard?: boolean | ClipboardConfig;

  /**
   * Enable right-click context menu.
   *
   * @example
   * ```tsx
   * <DataGrid contextMenu />
   * <DataGrid contextMenu={{ items: customItems }} />
   * ```
   */
  contextMenu?: boolean | ContextMenuConfig;

  // ═══════════════════════════════════════════════════════════════════
  // SORTING & FILTERING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable column sorting.
   *
   * @example
   * ```tsx
   * // Enable with default (multi-sort)
   * <DataGrid sorting />
   *
   * // Single column sort only
   * <DataGrid sorting="single" />
   *
   * // Multi-column sort
   * <DataGrid sorting="multi" />
   *
   * // Full config
   * <DataGrid sorting={{ maxSortLevels: 3 }} />
   * ```
   */
  sorting?: boolean | 'single' | 'multi' | MultiSortConfig;

  /**
   * Enable column filtering.
   *
   * @example
   * ```tsx
   * <DataGrid filtering />
   * <DataGrid filtering={{ debounceMs: 200 }} />
   * ```
   */
  filtering?: boolean | FilterConfig<TRow>;

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable column drag-to-reorder.
   *
   * @example
   * ```tsx
   * <DataGrid reorder />
   * ```
   */
  reorder?: boolean | ReorderConfig;

  /**
   * Enable column visibility toggle panel.
   *
   * @example
   * ```tsx
   * <DataGrid visibility />
   * ```
   */
  visibility?: boolean | VisibilityConfig;

  /**
   * Enable pinned/sticky columns.
   * Columns are pinned via the `sticky` column property.
   *
   * @example
   * ```tsx
   * <DataGrid pinnedColumns columns={[
   *   { field: 'id', sticky: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', sticky: 'right' },
   * ]} />
   * ```
   */
  pinnedColumns?: boolean;

  /**
   * Enable multi-level column headers (column groups).
   *
   * @example
   * ```tsx
   * <DataGrid groupingColumns={{
   *   columnGroups: [
   *     { header: 'Personal Info', children: ['firstName', 'lastName'] },
   *   ],
   * }} />
   * ```
   */
  groupingColumns?: boolean | GroupingColumnsConfig;

  /**
   * Enable horizontal column virtualization for wide grids.
   *
   * @example
   * ```tsx
   * <DataGrid columnVirtualization />
   * ```
   */
  columnVirtualization?: boolean | ColumnVirtualizationConfig;

  // ═══════════════════════════════════════════════════════════════════
  // ROW FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable row drag-to-reorder.
   *
   * @example
   * ```tsx
   * <DataGrid rowReorder />
   * ```
   */
  rowReorder?: boolean | RowReorderConfig;

  /**
   * Enable row grouping by field values.
   *
   * @example
   * ```tsx
   * <DataGrid groupingRows={{
   *   groupBy: ['department', 'team'],
   *   defaultExpanded: true,
   * }} />
   * ```
   */
  groupingRows?: GroupingRowsConfig;

  /**
   * Enable pinned rows (aggregation/status bar).
   *
   * @example
   * ```tsx
   * <DataGrid pinnedRows={{
   *   bottom: [{ type: 'aggregation', aggregator: 'sum' }],
   * }} />
   * ```
   */
  pinnedRows?: boolean | PinnedRowsConfig;

  // ═══════════════════════════════════════════════════════════════════
  // HIERARCHICAL DATA
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable hierarchical tree view.
   *
   * @example
   * ```tsx
   * <DataGrid tree={{
   *   childrenField: 'children',
   *   defaultExpanded: true,
   * }} />
   * ```
   */
  tree?: boolean | TreeConfig;

  /**
   * Enable master-detail expandable rows.
   *
   * @example
   * ```tsx
   * <DataGrid masterDetail={{
   *   renderer: (row) => <OrderDetails order={row} />,
   * }} />
   * ```
   */
  masterDetail?: MasterDetailConfig;

  // ═══════════════════════════════════════════════════════════════════
  // RESPONSIVE & LAYOUT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable responsive card layout for narrow viewports.
   *
   * @example
   * ```tsx
   * <DataGrid responsive={{
   *   breakpoint: 768,
   *   cardRenderer: (row) => <EmployeeCard employee={row} />,
   * }} />
   * ```
   */
  responsive?: boolean | ResponsivePluginConfig;

  // ═══════════════════════════════════════════════════════════════════
  // UNDO/REDO
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable undo/redo for cell edits.
   * Requires editing to be enabled (will be auto-added).
   *
   * @example
   * ```tsx
   * <DataGrid editing="dblclick" undoRedo />
   * ```
   */
  undoRedo?: boolean | UndoRedoConfig;

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT & PRINT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable CSV/JSON export functionality.
   *
   * @example
   * ```tsx
   * <DataGrid export />
   * <DataGrid export={{ filename: 'data.csv' }} />
   * ```
   */
  export?: boolean | ExportConfig;

  /**
   * Enable print functionality.
   *
   * @example
   * ```tsx
   * <DataGrid print />
   * ```
   */
  print?: boolean | PrintConfig;

  // ═══════════════════════════════════════════════════════════════════
  // ADVANCED FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable pivot table functionality.
   *
   * @example
   * ```tsx
   * <DataGrid pivot={{
   *   rowFields: ['category'],
   *   columnFields: ['year'],
   *   valueField: 'sales',
   * }} />
   * ```
   */
  pivot?: PivotConfig;

  /**
   * Enable server-side data operations.
   *
   * @example
   * ```tsx
   * <DataGrid serverSide={{
   *   dataSource: async (params) => fetchData(params),
   * }} />
   * ```
   */
  serverSide?: ServerSideConfig;
}

/**
 * Preset configuration names.
 * Presets provide sensible defaults for common use cases.
 */
export type PresetName = 'minimal' | 'standard' | 'full';

/**
 * Props for controlling loading states and SSR behavior.
 */
export interface LoadingProps {
  /**
   * Custom loading component shown during plugin loading.
   * @default Built-in skeleton loader
   */
  loadingComponent?: ReactNode;

  /**
   * Custom loading component for individual rows (async operations).
   * @default Subtle row shimmer
   */
  rowLoadingComponent?: ReactNode;

  /**
   * Custom loading component for individual cells (async operations).
   * @default Cell spinner
   */
  cellLoadingComponent?: ReactNode;

  /**
   * Enable SSR mode - disables lazy loading for server-side rendering.
   * In SSR mode, plugins are not loaded (grid renders without features).
   * @default false
   */
  ssr?: boolean;
}

/**
 * All feature-related props combined.
 */
export type AllFeatureProps<TRow = unknown> = FeatureProps<TRow> &
  LoadingProps & {
    /**
     * Use a preset configuration.
     * Individual props override preset values.
     *
     * @example
     * ```tsx
     * // Use full preset but disable editing
     * <DataGrid preset="full" editing={false} />
     * ```
     */
    preset?: PresetName;
  };

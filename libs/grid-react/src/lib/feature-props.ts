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
   * @requires `import '@toolbox-web/grid-react/features/selection';`
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
   * @requires `import '@toolbox-web/grid-react/features/editing';`
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
   * @requires `import '@toolbox-web/grid-react/features/clipboard';`
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
   * @requires `import '@toolbox-web/grid-react/features/context-menu';`
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
   * @requires `import '@toolbox-web/grid-react/features/sorting';`
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
   * @requires `import '@toolbox-web/grid-react/features/filtering';`
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
   * @requires `import '@toolbox-web/grid-react/features/reorder';`
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
   * @requires `import '@toolbox-web/grid-react/features/visibility';`
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
   * @requires `import '@toolbox-web/grid-react/features/pinned-columns';`
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
   * @requires `import '@toolbox-web/grid-react/features/grouping-columns';`
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
   * @requires `import '@toolbox-web/grid-react/features/column-virtualization';`
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
   * @requires `import '@toolbox-web/grid-react/features/row-reorder';`
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
   * @requires `import '@toolbox-web/grid-react/features/grouping-rows';`
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
   * @requires `import '@toolbox-web/grid-react/features/pinned-rows';`
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
   * @requires `import '@toolbox-web/grid-react/features/tree';`
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
   * @requires `import '@toolbox-web/grid-react/features/master-detail';`
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
   * @requires `import '@toolbox-web/grid-react/features/responsive';`
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
   * @requires `import '@toolbox-web/grid-react/features/undo-redo';`
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
   * @requires `import '@toolbox-web/grid-react/features/export';`
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
   * @requires `import '@toolbox-web/grid-react/features/print';`
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
   * @requires `import '@toolbox-web/grid-react/features/pivot';`
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
   * @requires `import '@toolbox-web/grid-react/features/server-side';`
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
 * Props for controlling SSR behavior.
 */
export interface SSRProps {
  /**
   * Enable SSR mode - disables feature plugins for server-side rendering.
   * In SSR mode, the grid renders without interactive features.
   * @default false
   */
  ssr?: boolean;
}

/**
 * All feature-related props combined.
 */
export type AllFeatureProps<TRow = unknown> = FeatureProps<TRow> & SSRProps;

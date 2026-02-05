/**
 * Feature props type definitions for declarative grid plugin configuration.
 *
 * These types allow developers to enable grid features using simple props
 * instead of manual plugin instantiation.
 *
 * @example
 * ```vue
 * <TbwGrid
 *   :rows="data"
 *   :columns="columns"
 *   selection="range"
 *   editing="dblclick"
 *   filtering
 *   multiSort
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
import type { EditingConfig } from '@toolbox-web/grid/plugins/editing';

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
   * @requires `import '@toolbox-web/grid-vue/features/selection';`
   *
   * @example
   * ```vue
   * <!-- Shorthand - just the mode -->
   * <TbwGrid selection="range" />
   *
   * <!-- Full config -->
   * <TbwGrid :selection="{ mode: 'range', checkbox: true }" />
   * ```
   */
  selection?: 'cell' | 'row' | 'range' | SelectionConfig<TRow>;

  /**
   * Enable inline cell editing.
   *
   * @requires `import '@toolbox-web/grid-vue/features/editing';`
   *
   * @example
   * ```vue
   * <!-- Enable with default trigger (dblclick) -->
   * <TbwGrid editing />
   *
   * <!-- Specify trigger -->
   * <TbwGrid editing="click" />
   * <TbwGrid editing="dblclick" />
   * <TbwGrid editing="manual" />
   *
   * // Full config with callbacks
   * <TbwGrid :editing="{ editOn: 'dblclick', onBeforeEditClose: myCallback }" />
   * ```
   */
  editing?: boolean | 'click' | 'dblclick' | 'manual' | EditingConfig;

  /**
   * Enable clipboard copy/paste.
   * Requires selection to be enabled (will be auto-added).
   *
   * @requires `import '@toolbox-web/grid-vue/features/clipboard';`
   *
   * @example
   * ```vue
   * <TbwGrid selection="range" clipboard />
   * ```
   */
  clipboard?: boolean | ClipboardConfig;

  /**
   * Enable right-click context menu.
   *
   * @requires `import '@toolbox-web/grid-vue/features/context-menu';`
   *
   * @example
   * ```vue
   * <TbwGrid contextMenu />
   * <TbwGrid :contextMenu="{ items: customItems }" />
   * ```
   */
  contextMenu?: boolean | ContextMenuConfig;

  // ═══════════════════════════════════════════════════════════════════
  // SORTING & FILTERING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable multi-column sorting.
   *
   * Multi-sort allows users to sort by multiple columns simultaneously.
   * For basic single-column sorting, columns with `sortable: true` work without this plugin.
   *
   * @requires `import '@toolbox-web/grid-vue/features/multi-sort';`
   *
   * @example
   * ```vue
   * <!-- Enable multi-column sorting -->
   * <TbwGrid multiSort />
   *
   * <!-- Limit to single column (uses plugin but restricts to 1) -->
   * <TbwGrid multiSort="single" />
   *
   * <!-- Full config -->
   * <TbwGrid :multiSort="{ maxSortColumns: 3 }" />
   * ```
   */
  multiSort?: boolean | 'single' | 'multi' | MultiSortConfig;

  /**
   * @deprecated Use `multiSort` instead. Will be removed in a future version.
   *
   * Enable column sorting. This is an alias for `multiSort`.
   *
   * @requires `import '@toolbox-web/grid-vue/features/multi-sort';`
   */
  sorting?: boolean | 'single' | 'multi' | MultiSortConfig;

  /**
   * Enable column filtering.
   *
   * @requires `import '@toolbox-web/grid-vue/features/filtering';`
   *
   * @example
   * ```vue
   * <TbwGrid filtering />
   * <TbwGrid :filtering="{ debounceMs: 200 }" />
   * ```
   */
  filtering?: boolean | FilterConfig<TRow>;

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable column drag-to-reorder.
   *
   * @requires `import '@toolbox-web/grid-vue/features/reorder';`
   *
   * @example
   * ```vue
   * <TbwGrid reorder />
   * ```
   */
  reorder?: boolean | ReorderConfig;

  /**
   * Enable column visibility toggle panel.
   *
   * @requires `import '@toolbox-web/grid-vue/features/visibility';`
   *
   * @example
   * ```vue
   * <TbwGrid visibility />
   * ```
   */
  visibility?: boolean | VisibilityConfig;

  /**
   * Enable pinned/sticky columns.
   * Columns are pinned via the `sticky` column property.
   *
   * @requires `import '@toolbox-web/grid-vue/features/pinned-columns';`
   *
   * @example
   * ```vue
   * <TbwGrid pinnedColumns :columns="[
   *   { field: 'id', sticky: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', sticky: 'right' },
   * ]" />
   * ```
   */
  pinnedColumns?: boolean;

  /**
   * Enable multi-level column headers (column groups).
   *
   * @requires `import '@toolbox-web/grid-vue/features/grouping-columns';`
   *
   * @example
   * ```vue
   * <TbwGrid :groupingColumns="{
   *   columnGroups: [
   *     { header: 'Personal Info', children: ['firstName', 'lastName'] },
   *   ],
   * }" />
   * ```
   */
  groupingColumns?: boolean | GroupingColumnsConfig;

  /**
   * Enable horizontal column virtualization for wide grids.
   *
   * @requires `import '@toolbox-web/grid-vue/features/column-virtualization';`
   *
   * @example
   * ```vue
   * <TbwGrid columnVirtualization />
   * ```
   */
  columnVirtualization?: boolean | ColumnVirtualizationConfig;

  // ═══════════════════════════════════════════════════════════════════
  // ROW FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable row drag-to-reorder.
   *
   * @requires `import '@toolbox-web/grid-vue/features/row-reorder';`
   *
   * @example
   * ```vue
   * <TbwGrid rowReorder />
   * ```
   */
  rowReorder?: boolean | RowReorderConfig;

  /**
   * Enable row grouping by field values.
   *
   * @requires `import '@toolbox-web/grid-vue/features/grouping-rows';`
   *
   * @example
   * ```vue
   * <TbwGrid :groupingRows="{
   *   groupBy: ['department', 'team'],
   *   defaultExpanded: true,
   * }" />
   * ```
   */
  groupingRows?: GroupingRowsConfig;

  /**
   * Enable pinned rows (aggregation/status bar).
   *
   * @requires `import '@toolbox-web/grid-vue/features/pinned-rows';`
   *
   * @example
   * ```vue
   * <TbwGrid :pinnedRows="{
   *   bottom: [{ type: 'aggregation', aggregator: 'sum' }],
   * }" />
   * ```
   */
  pinnedRows?: boolean | PinnedRowsConfig;

  // ═══════════════════════════════════════════════════════════════════
  // HIERARCHICAL DATA
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable hierarchical tree view.
   *
   * @requires `import '@toolbox-web/grid-vue/features/tree';`
   *
   * @example
   * ```vue
   * <TbwGrid :tree="{
   *   childrenField: 'children',
   *   defaultExpanded: true,
   * }" />
   * ```
   */
  tree?: boolean | TreeConfig;

  /**
   * Enable master-detail expandable rows.
   *
   * @requires `import '@toolbox-web/grid-vue/features/master-detail';`
   *
   * @example
   * ```vue
   * <TbwGrid :masterDetail="{
   *   renderer: (row) => h(OrderDetails, { order: row }),
   * }" />
   * ```
   */
  masterDetail?: MasterDetailConfig;

  // ═══════════════════════════════════════════════════════════════════
  // RESPONSIVE & LAYOUT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable responsive card layout for narrow viewports.
   *
   * @requires `import '@toolbox-web/grid-vue/features/responsive';`
   *
   * @example
   * ```vue
   * <TbwGrid :responsive="{
   *   breakpoint: 768,
   *   cardRenderer: (row) => h(EmployeeCard, { employee: row }),
   * }" />
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
   * @requires `import '@toolbox-web/grid-vue/features/undo-redo';`
   *
   * @example
   * ```vue
   * <TbwGrid editing="dblclick" undoRedo />
   * ```
   */
  undoRedo?: boolean | UndoRedoConfig;

  // ═══════════════════════════════════════════════════════════════════
  // EXPORT & PRINT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable CSV/JSON export functionality.
   *
   * @requires `import '@toolbox-web/grid-vue/features/export';`
   *
   * @example
   * ```vue
   * <TbwGrid export />
   * <TbwGrid :export="{ filename: 'data.csv' }" />
   * ```
   */
  export?: boolean | ExportConfig;

  /**
   * Enable print functionality.
   *
   * @requires `import '@toolbox-web/grid-vue/features/print';`
   *
   * @example
   * ```vue
   * <TbwGrid print />
   * ```
   */
  print?: boolean | PrintConfig;

  // ═══════════════════════════════════════════════════════════════════
  // ADVANCED FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable pivot table functionality.
   *
   * @requires `import '@toolbox-web/grid-vue/features/pivot';`
   *
   * @example
   * ```vue
   * <TbwGrid :pivot="{
   *   rowFields: ['category'],
   *   columnFields: ['year'],
   *   valueField: 'sales',
   * }" />
   * ```
   */
  pivot?: PivotConfig;

  /**
   * Enable server-side data operations.
   *
   * @requires `import '@toolbox-web/grid-vue/features/server-side';`
   *
   * @example
   * ```vue
   * <TbwGrid :serverSide="{
   *   dataSource: async (params) => fetchData(params),
   * }" />
   * ```
   */
  serverSide?: ServerSideConfig;
}

/**
 * All feature-related props combined.
 */
export type AllFeatureProps<TRow = unknown> = FeatureProps<TRow>;

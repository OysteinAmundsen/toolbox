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
  RowDragDropConfig,
  RowReorderConfig,
  SelectionConfig,
  ServerSideConfig,
  TooltipConfig,
  TreeConfig,
  UndoRedoConfig,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import type { EditingConfig } from '@toolbox-web/grid/plugins/editing';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import type { VNode } from 'vue';

/**
 * Vue-specific filter configuration that extends `FilterConfig` to accept
 * Vue render functions for `filterPanelRenderer`.
 *
 * The `filterPanelRenderer` property accepts either:
 * - The core imperative signature: `(container: HTMLElement, params: FilterPanelParams) => void`
 * - A Vue render function: `(params: FilterPanelParams) => VNode`
 *
 * @template TRow - The row data type
 */
export type VueFilterConfig<TRow = unknown> = Omit<FilterConfig<TRow>, 'filterPanelRenderer'> & {
  filterPanelRenderer?: FilterConfig<TRow>['filterPanelRenderer'] | ((params: FilterPanelParams) => VNode);
};

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
   * Enable column filtering.
   *
   * The `filterPanelRenderer` property accepts either the core imperative signature
   * `(container, params) => void` or a Vue render function `(params) => VNode`.
   *
   * @requires `import '@toolbox-web/grid-vue/features/filtering';`
   *
   * @example
   * ```vue
   * <TbwGrid filtering />
   * <TbwGrid :filtering="{ debounceMs: 200 }" />
   * ```
   */
  filtering?: boolean | VueFilterConfig<TRow>;

  // ═══════════════════════════════════════════════════════════════════
  // COLUMN FEATURES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable column drag-to-reorder.
   *
   * @requires `import '@toolbox-web/grid-vue/features/reorder-columns';`
   *
   * @example
   * ```vue
   * <TbwGrid reorder-columns />
   * ```
   */
  reorderColumns?: boolean | ReorderConfig;

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
   *   { field: 'id', pinned: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', pinned: 'right' },
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
   * @deprecated Use `rowDragDrop` instead. `reorderRows` remains as an alias
   *             until V3 and forwards to the same plugin.
   * @requires `import '@toolbox-web/grid-vue/features/reorder-rows';`
   *
   * @example
   * ```vue
   * <TbwGrid reorder-rows />
   * ```
   */
  reorderRows?: boolean | RowReorderConfig;

  /**
   * Enable row drag-and-drop, both within a single grid (reorder) and
   * across grids that share a `dropZone`.
   *
   * @requires `import '@toolbox-web/grid-vue/features/row-drag-drop';`
   *
   * @example
   * ```vue
   * <TbwGrid :row-drag-drop="{ dropZone: 'employees', operation: 'move' }" />
   * ```
   */
  rowDragDrop?: boolean | RowDragDropConfig<TRow>;

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

  /**
   * Enable tooltip display for header and cell content.
   *
   * @requires `import '@toolbox-web/grid-vue/features/tooltip';`
   *
   * @example
   * ```vue
   * <TbwGrid :tooltip="true" />
   * <TbwGrid :tooltip="{ header: true, cell: false }" />
   * ```
   */
  tooltip?: boolean | TooltipConfig;
}

/**
 * Props for controlling SSR behavior.
 *
 * @deprecated This prop is a no-op in any meaningful sense and will be removed
 * in a future major release. Features in the Vue adapter are registered via
 * synchronous side-effect imports (`import '@toolbox-web/grid-vue/features/...'`),
 * which are SSR-safe by construction. Setting `ssr={true}` today only skips
 * Vue-side plugin instantiation; `<tbw-grid>` itself is a custom element that
 * requires a custom-elements polyfill to render anything server-side, and upon
 * client hydration the grid mounts and renders normally regardless of this
 * flag. Exported for cross-adapter symmetry with `@toolbox-web/grid-react`.
 * If you need real SSR support (Nuxt / Vike / Astro), open an issue describing
 * your hydration requirements so we can design a proper cross-adapter story
 * rather than relying on this flag.
 */
export interface SSRProps {
  /**
   * Enable SSR mode — skips Vue-side plugin instantiation.
   *
   * @deprecated No-op in practice — see {@link SSRProps} for details. Will be
   * removed in a future major release.
   * @default false
   */
  ssr?: boolean;
}

/**
 * All feature-related props combined.
 */
export type AllFeatureProps<TRow = unknown> = FeatureProps<TRow> & SSRProps;

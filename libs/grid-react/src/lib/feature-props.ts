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

// Import plugin config types from the all bundle for monorepo compatibility.
// Types that the React adapter re-exports under their canonical (unprefixed)
// name are imported with a `Core*` alias to avoid a local naming collision.
import type {
  ClipboardConfig,
  ColumnVirtualizationConfig,
  ContextMenuConfig,
  FilterConfig as CoreFilterConfig,
  GroupingColumnsConfig as CoreGroupingColumnsConfig,
  GroupingRowsConfig as CoreGroupingRowsConfig,
  MasterDetailConfig as CoreMasterDetailConfig,
  PinnedRowsConfig as CorePinnedRowsConfig,
  ResponsivePluginConfig as CoreResponsivePluginConfig,
  ExportConfig,
  FeatureConfig,
  MultiSortConfig,
  PivotConfig,
  PrintConfig,
  ReorderConfig,
  RowDragDropConfig,
  SelectionConfig,
  ServerSideConfig,
  StickyRowsConfig,
  TooltipConfig,
  TreeConfig,
  UndoRedoConfig,
  VisibilityConfig,
} from '@toolbox-web/grid/all';
import type { EditingConfig } from '@toolbox-web/grid/plugins/editing';
import type { FilterPanelParams } from '@toolbox-web/grid/plugins/filtering';
import type { ColumnGroupDefinition as CoreColumnGroupDefinition } from '@toolbox-web/grid/plugins/grouping-columns';
import type { GroupRowRenderParams } from '@toolbox-web/grid/plugins/grouping-rows';
import type { AggregationSlot, PanelZone, PinnedRowsContext } from '@toolbox-web/grid/plugins/pinned-rows';
import type { ShellConfig } from '@toolbox-web/grid/plugins/shell';
import type { ReactNode } from 'react';

// #region React-specific Config Overrides
//
// Naming policy: each adapter-widened config is exported under the SAME
// canonical name as its core counterpart (`FilterConfig`, `MasterDetailConfig`,
// `PinnedRowsConfig`, ...). The colliding core import is renamed to `Core*`.
// Historical `React*` aliases remain as `@deprecated` re-exports for one or
// two minor cycles. See `.github/instructions/framework-adapters.instructions.md`.

/**
 * Filter config widened to accept a React render function as `filterPanelRenderer`.
 *
 * Extends the core `FilterConfig` so consumers can return a `ReactNode`
 * `(params: FilterPanelParams) => ReactNode` in addition to the vanilla
 * `(container: HTMLElement, params: FilterPanelParams) => void` signature.
 */
export type FilterConfig<TRow = unknown> = Omit<CoreFilterConfig<TRow>, 'filterPanelRenderer'> & {
  filterPanelRenderer?: CoreFilterConfig<TRow>['filterPanelRenderer'] | ((params: FilterPanelParams) => ReactNode);
};

/**
 * Column group definition widened to accept a React `renderer`.
 */
export type ColumnGroupDefinition = Omit<CoreColumnGroupDefinition, 'renderer'> & {
  renderer?:
    | CoreColumnGroupDefinition['renderer']
    | ((...args: Parameters<NonNullable<CoreColumnGroupDefinition['renderer']>>) => ReactNode);
};

/**
 * Grouping-columns config widened to accept React render functions for
 * `groupHeaderRenderer` and per-group `renderer` entries in `columnGroups`.
 */
export type GroupingColumnsConfig = Omit<CoreGroupingColumnsConfig, 'groupHeaderRenderer' | 'columnGroups'> & {
  columnGroups?: ColumnGroupDefinition[];
  groupHeaderRenderer?:
    | CoreGroupingColumnsConfig['groupHeaderRenderer']
    | ((...args: Parameters<NonNullable<CoreGroupingColumnsConfig['groupHeaderRenderer']>>) => ReactNode);
};

/**
 * Grouping-rows config widened to accept a React `groupRowRenderer`
 * `(params: GroupRowRenderParams) => ReactNode` in addition to the vanilla
 * `(params) => HTMLElement | string | void` signature.
 *
 * @since 1.8.0
 */
export type GroupingRowsConfig = Omit<CoreGroupingRowsConfig, 'groupRowRenderer'> & {
  groupRowRenderer?: CoreGroupingRowsConfig['groupRowRenderer'] | ((params: GroupRowRenderParams) => ReactNode);
};

/**
 * React-typed render function for a pinned-row panel slot.
 *
 * Mirrors the vanilla `PanelRender` signature but returns a `ReactNode`
 * instead of `HTMLElement | null`. The React adapter (see
 * `features/pinned-rows.ts`) wraps the returned node in a portal so the
 * pinned-rows plugin can keep its host-element reference stable across
 * grid re-renders.
 *
 * @since 1.8.2
 */
export type PanelRender = (ctx: PinnedRowsContext) => ReactNode;

/**
 * React-typed zoned panel render entry.
 *
 * @since 1.8.2
 */
export interface ZonedPanelRender {
  zone?: PanelZone;
  render: PanelRender;
}

/**
 * React-typed panel slot — same shape as the vanilla `PanelSlot` but with
 * `ReactNode` render returns.
 *
 * @since 1.8.2
 */
export interface PanelSlot {
  id?: string;
  position?: 'top' | 'bottom';
  render: PanelRender | ZonedPanelRender[];
}

/**
 * React-typed pinned-rows slot — either a panel slot (with React renderers)
 * or a passthrough aggregation slot.
 *
 * @since 1.8.2
 */
export type PinnedRowSlot = PanelSlot | AggregationSlot;

/**
 * Pinned-rows config widened to accept React components as panel
 * `render` functions inside `slots[]`.
 *
 * Extends the core `PinnedRowsConfig` to accept React render functions
 * returning `ReactNode` instead of only `HTMLElement | null`. Bridging to
 * vanilla DOM is handled by the side-effect import
 * `@toolbox-web/grid-react/features/pinned-rows`.
 *
 * @since 1.8.2
 */
export type PinnedRowsConfig = Omit<CorePinnedRowsConfig, 'slots'> & {
  slots?: PinnedRowSlot[];
};

/**
 * Master-detail config widened to accept a React `detailRenderer`
 * `(row, rowIndex) => ReactNode` in addition to the vanilla
 * `(row, rowIndex) => HTMLElement | string` signature. Bridging to vanilla
 * DOM is handled by the side-effect import
 * `@toolbox-web/grid-react/features/master-detail`.
 *
 * Re-exported under the same name as the core type so React users see a
 * single canonical `MasterDetailConfig` from `@toolbox-web/grid-react`.
 *
 * @since 1.8.2
 */
export type MasterDetailConfig = Omit<CoreMasterDetailConfig, 'detailRenderer'> & {
  detailRenderer?:
    | CoreMasterDetailConfig['detailRenderer']
    | ((row: Record<string, unknown>, rowIndex: number) => ReactNode);
};

/**
 * Responsive config widened to accept a React `cardRenderer`
 * `(row, rowIndex, column?) => ReactNode` in addition to the vanilla
 * `(row, rowIndex, column?) => HTMLElement` signature. Bridging to vanilla
 * DOM is handled by the side-effect import
 * `@toolbox-web/grid-react/features/responsive`.
 *
 * Re-exported under the same name as the core type so React users see a
 * single canonical `ResponsivePluginConfig` from `@toolbox-web/grid-react`.
 *
 * @since 1.8.2
 */
export type ResponsivePluginConfig<TRow = unknown> = Omit<CoreResponsivePluginConfig<TRow>, 'cardRenderer'> & {
  cardRenderer?:
    | CoreResponsivePluginConfig<TRow>['cardRenderer']
    | ((
        row: TRow,
        rowIndex: number,
        column?: Parameters<NonNullable<CoreResponsivePluginConfig<TRow>['cardRenderer']>>[2],
      ) => ReactNode);
};

// ── Deprecated framework-prefixed aliases ──────────────────────────────────
// Retained for backwards compatibility. New code should import the canonical
// (unprefixed) names above.

/** @deprecated Use {@link FilterConfig} from `@toolbox-web/grid-react` instead. */
export type ReactFilterConfig<TRow = unknown> = FilterConfig<TRow>;
/** @deprecated Use {@link ColumnGroupDefinition} from `@toolbox-web/grid-react` instead. */
export type ReactColumnGroupDefinition = ColumnGroupDefinition;
/** @deprecated Use {@link GroupingColumnsConfig} from `@toolbox-web/grid-react` instead. */
export type ReactGroupingColumnsConfig = GroupingColumnsConfig;
/** @deprecated Use {@link GroupingRowsConfig} from `@toolbox-web/grid-react` instead. */
export type ReactGroupingRowsConfig = GroupingRowsConfig;
/** @deprecated Use {@link PanelRender} from `@toolbox-web/grid-react` instead. */
export type ReactPanelRender = PanelRender;
/** @deprecated Use {@link ZonedPanelRender} from `@toolbox-web/grid-react` instead. */
export type ReactZonedPanelRender = ZonedPanelRender;
/** @deprecated Use {@link PanelSlot} from `@toolbox-web/grid-react` instead. */
export type ReactPanelSlot = PanelSlot;
/** @deprecated Use {@link PinnedRowSlot} from `@toolbox-web/grid-react` instead. */
export type ReactPinnedRowSlot = PinnedRowSlot;
/** @deprecated Use {@link PinnedRowsConfig} from `@toolbox-web/grid-react` instead. */
export type ReactPinnedRowsConfig = PinnedRowsConfig;
// #endregion

/**
 * Feature props for declarative plugin configuration.
 * Each prop lazily loads its corresponding plugin when used.
 *
 * @template TRow - The row data type
 * @since 0.7.0
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
   *
   * // Full config with callbacks
   * <DataGrid editing={{ editOn: 'dblclick', onBeforeEditClose: myCallback }} />
   * ```
   */
  editing?: boolean | 'click' | 'dblclick' | 'manual' | EditingConfig;

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
   * Enable multi-column sorting.
   *
   * Multi-sort allows users to sort by multiple columns simultaneously.
   * For basic single-column sorting, columns with `sortable: true` work without this plugin.
   * Use the `sortable` prop to disable all sorting grid-wide.
   *
   * @requires `import '@toolbox-web/grid-react/features/multi-sort';`
   *
   * @example
   * ```tsx
   * // Enable multi-column sorting
   * <DataGrid multiSort />
   *
   * // Limit to single column (uses plugin but restricts to 1)
   * <DataGrid multiSort="single" />
   *
   * // Full config
   * <DataGrid multiSort={{ maxSortColumns: 3 }} />
   * ```
   */
  multiSort?: boolean | 'single' | 'multi' | MultiSortConfig;

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
   * @requires `import '@toolbox-web/grid-react/features/reorder-columns';`
   *
   * @example
   * ```tsx
   * <DataGrid reorderColumns />
   * ```
   */
  reorderColumns?: boolean | ReorderConfig;

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
   *   { field: 'id', pinned: 'left' },
   *   { field: 'name' },
   *   { field: 'actions', pinned: 'right' },
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
   * Enable row drag-and-drop, both within a single grid (reorder) and
   * across grids that share a `dropZone`.
   *
   * @requires `import '@toolbox-web/grid-react/features/row-drag-drop';`
   *
   * @example
   * ```tsx
   * // Intra-grid reorder
   * <DataGrid rowDragDrop />
   *
   * // Cross-grid transfer
   * <DataGrid rowDragDrop={{ dropZone: 'employees', operation: 'move' }} />
   * ```
   */
  rowDragDrop?: boolean | RowDragDropConfig<TRow>;

  /**
   * Enable row grouping by field values.
   *
   * @requires `import '@toolbox-web/grid-react/features/grouping-rows';`
   *
   * @example
   * ```tsx
   * <DataGrid groupingRows={{
   *   groupOn: (row) => [row.department, row.team],
   *   defaultExpanded: true,
   * }} />
   * ```
   *
   * @example Custom group row renderer (React JSX)
   *
   * To keep mouse-toggle behavior, either add the `group-toggle` class to a
   * clickable element (the plugin delegates clicks via `closest('.group-toggle')`)
   * or call `params.toggleExpand()` from your own handler.
   *
   * ```tsx
   * <DataGrid groupingRows={{
   *   groupOn: (row) => row.department,
   *   groupRowRenderer: (params) => (
   *     <button type="button" className="group-toggle">
   *       {params.expanded ? '▾' : '▸'} {params.value} ({params.rows.length})
   *     </button>
   *   ),
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
   *
   * @example React JSX in panel slots
   * ```tsx
   * <DataGrid pinnedRows={{
   *   slots: [
   *     { id: 'add-row', position: 'bottom', render: () => <AddRowPanel /> },
   *   ],
   * }} />
   * ```
   */
  pinnedRows?: boolean | PinnedRowsConfig;

  /**
   * Pin selected data rows below the header as the user scrolls past them.
   *
   * @requires `import '@toolbox-web/grid-react/features/sticky-rows';`
   *
   * @example
   * ```tsx
   * // Field-name shorthand
   * <DataGrid stickyRows={{ isSticky: 'isSection' }} />
   *
   * // Predicate + stack mode
   * <DataGrid stickyRows={{
   *   isSticky: (row) => row.kind === 'section',
   *   mode: 'stack',
   *   maxStacked: 3,
   * }} />
   * ```
   */
  stickyRows?: StickyRowsConfig;

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
  responsive?: boolean | ResponsivePluginConfig<TRow>;

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

  // ═══════════════════════════════════════════════════════════════════
  // DISPLAY
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enable styled popover tooltips on overflowing cells and headers.
   *
   * @requires `import '@toolbox-web/grid-react/features/tooltip';`
   *
   * @example
   * ```tsx
   * <DataGrid tooltip />
   * <DataGrid tooltip={{ cell: false }} />
   * ```
   */
  tooltip?: boolean | TooltipConfig;

  /**
   * Enable the grid shell (header bar + collapsible tool panels).
   *
   * Config-driven: set shape via `gridConfig.features.shell` or use the
   * `<GridHeaderContent>` / `<GridToolbarContent>` / `<GridToolPanel>`
   * wrappers. The shell also auto-registers in v2.x; this opt-in import
   * makes it explicit and tree-shakeable for v3.
   *
   * @requires `import '@toolbox-web/grid-react/features/shell';`
   */
  shell?: boolean | ShellConfig;
}

/**
 * All feature-related props combined.
 * @since 0.7.0
 */
export type AllFeatureProps<TRow = unknown> = FeatureProps<TRow>;

// #region Drift guard

/**
 * Compile-time check that every core feature has a matching React prop.
 *
 * `FeatureConfig` (in core) is augmented by each side-effect feature import
 * (`libs/grid/src/lib/features/*.ts`). `FeatureProps` here must stay a
 * superset — every core feature should be exposed as a declarative React
 * prop. (Reverse direction is intentionally NOT enforced: React props may
 * use richer shorthand types than core configs.)
 *
 * If this fails to compile, a feature was added to core but not yet wired
 * here. Add the matching prop above with appropriate React-specific types.
 *
 * The `'__brand'` sentinel on core's `FeatureConfig` is filtered out — it
 * is not a real feature.
 */
type _MissingReactProps = Exclude<keyof FeatureConfig, keyof FeatureProps | '__brand'>;
type _AssertFeaturePropsCoverCore = [_MissingReactProps] extends [never]
  ? true
  : ['Missing React props for core features:', _MissingReactProps];
const _featurePropsCoverCore: _AssertFeaturePropsCoverCore = true;
void _featurePropsCoverCore;

// #endregion

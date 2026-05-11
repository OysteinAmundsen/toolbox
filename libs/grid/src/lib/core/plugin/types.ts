/**
 * Shared types for the plugin system.
 *
 * These types are used by both the base plugin class and the grid core.
 * Centralizing them here avoids circular imports and reduces duplication.
 */

import type { ColumnConfig, GridConfig, ToolPanelDefinition, UpdateSource } from '../types';

// #region Event Types
/**
 * Keyboard modifier flags
 */
export interface KeyboardModifiers {
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

/**
 * Cell coordinates
 */
export interface CellCoords {
  row: number;
  col: number;
}

/**
 * Cell click event
 */
export interface CellClickEvent {
  rowIndex: number;
  colIndex: number;
  column: ColumnConfig;
  field: string;
  value: unknown;
  row: unknown;
  cellEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Row click event
 */
export interface RowClickEvent {
  rowIndex: number;
  row: unknown;
  rowEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Header click event
 */
export interface HeaderClickEvent {
  colIndex: number;
  field: string;
  column: ColumnConfig;
  headerEl: HTMLElement;
  originalEvent: MouseEvent | KeyboardEvent;
}

/**
 * Scroll event
 */
export interface ScrollEvent {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  originalEvent?: Event;
}

/**
 * Cell mouse event (for drag operations, selection, etc.)
 * @category Plugin Development
 * @since 0.2.9
 */
export interface CellMouseEvent {
  /** Event type: mousedown, mousemove, or mouseup */
  type: 'mousedown' | 'mousemove' | 'mouseup';
  /** Row index, undefined if not over a data cell */
  rowIndex?: number;
  /** Column index, undefined if not over a cell */
  colIndex?: number;
  /** Field name, undefined if not over a cell */
  field?: string;
  /** Cell value, undefined if not over a data cell */
  value?: unknown;
  /** Row data object, undefined if not over a data row */
  row?: unknown;
  /** Column configuration, undefined if not over a column */
  column?: ColumnConfig;
  /** The cell element, undefined if not over a cell */
  cellElement?: HTMLElement;
  /** The row element, undefined if not over a row */
  rowElement?: HTMLElement;
  /** Whether the event is over a header cell */
  isHeader: boolean;
  /** Cell coordinates if over a valid data cell */
  cell?: CellCoords;
  /** The original mouse event */
  originalEvent: MouseEvent;
}
// #endregion

// #region Render Context Types
/**
 * Context passed to the `afterCellRender` plugin hook.
 *
 * This provides efficient cell-level access without requiring DOM queries.
 * Plugins receive this context for each cell as it's rendered, enabling
 * targeted modifications instead of post-render DOM traversal.
 *
 * @category Plugin Development
 * @template TRow - The row data type
 *
 * @example
 * ```typescript
 * afterCellRender(context: AfterCellRenderContext): void {
 *   if (this.isSelected(context.rowIndex, context.colIndex)) {
 *     context.cellElement.classList.add('selected');
 *   }
 * }
 * ```
 * @since 1.2.0
 */
export interface AfterCellRenderContext<TRow = unknown> {
  /** The row data object */
  row: TRow;
  /** Zero-based row index in the visible rows array */
  rowIndex: number;
  /** The column configuration */
  column: ColumnConfig<TRow>;
  /** Zero-based column index in the visible columns array */
  colIndex: number;
  /** The cell value (row[column.field]) */
  value: unknown;
  /** The cell DOM element - can be modified by the plugin */
  cellElement: HTMLElement;
  /** The row DOM element - for context, prefer using cellElement */
  rowElement: HTMLElement;
}

/**
 * Context passed to the `afterRowRender` plugin hook.
 *
 * This provides efficient row-level access after all cells are rendered.
 * Plugins receive this context for each row, enabling row-level modifications
 * without requiring DOM queries in afterRender.
 *
 * @category Plugin Development
 * @template TRow - The row data type
 *
 * @example
 * ```typescript
 * afterRowRender(context: AfterRowRenderContext): void {
 *   if (this.isRowSelected(context.rowIndex)) {
 *     context.rowElement.classList.add('selected', 'row-focus');
 *   }
 * }
 * ```
 * @since 1.2.0
 */
export interface AfterRowRenderContext<TRow = unknown> {
  /** The row data object */
  row: TRow;
  /** Zero-based row index in the visible rows array */
  rowIndex: number;
  /** The row DOM element - can be modified by the plugin */
  rowElement: HTMLElement;
}
// #endregion

// #region Context Menu Types
/**
 * Context menu parameters
 */
export interface ContextMenuParams {
  x: number;
  y: number;
  rowIndex?: number;
  colIndex?: number;
  field?: string;
  value?: unknown;
  row?: unknown;
  column?: ColumnConfig;
  isHeader?: boolean;
}

/**
 * Context menu item (used by context-menu plugin query)
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
  children?: ContextMenuItem[];
  action?: (params: ContextMenuParams) => void;
}
// #endregion

// #region Plugin Query Types
/**
 * Generic plugin query for inter-plugin communication.
 * Plugins can define their own query types as string constants
 * and respond to queries from other plugins.
 *
 * @category Plugin Development
 * @since 0.2.9
 */
export interface PluginQuery<T = unknown> {
  /** Query type identifier (e.g., 'canMoveColumn', 'getContextMenuItems') */
  type: string;
  /** Query-specific context/parameters */
  context: T;
}

/**
 * Query type used by consumers (e.g. the export plugin) to collect extra
 * header rows that should sit **above** the leaf column-header row.
 *
 * Plugins that contribute header rows (e.g. {@link GroupingColumnsPlugin})
 * declare `{ type: QUERY_COLLECT_HEADER_ROWS }` in their manifest and
 * respond from `handleQuery` with a {@link HeaderRowContribution}.
 *
 * The reply shape is intentionally generic — it just says "here are some
 * cells, each spanning N leaf columns" — so consumers don't need to know
 * which plugin produced them.
 *
 * @category Plugin Development
 * @since 2.10.0
 */
export const QUERY_COLLECT_HEADER_ROWS = 'collectHeaderRows';

/**
 * Context passed in {@link PluginQuery.context} for the
 * {@link QUERY_COLLECT_HEADER_ROWS} query.
 *
 * Carries the resolved leaf-column array the consumer is about to render
 * (already filtered by visibility / `params.columns` / etc.). Responding
 * plugins MUST align their contribution to this column array — `span`
 * values are indices into it.
 *
 * @category Plugin Development
 * @since 2.10.0
 */
export interface CollectHeaderRowsContext {
  /** Resolved leaf columns (in display order) the consumer is about to emit. */
  columns: ColumnConfig[];
}

/**
 * Single cell in a contributed header row. `span` is the number of leaf
 * columns this cell covers (always `>= 1`). The sum of `span` across all
 * cells in a row MUST equal `context.columns.length`.
 *
 * `label === ''` is treated as a blank/dropped cell — consumers may still
 * emit it (to preserve span alignment) or skip the entire row if every
 * cell is blank.
 *
 * @category Plugin Development
 * @since 2.10.0
 */
export interface HeaderRowCell {
  /** Display label for this cell. Empty string = blank cell (span preserved). */
  label: string;
  /** Number of leaf columns covered. Always `>= 1`. */
  span: number;
  /** Optional plugin name (for debugging / `processHeaderRow` filtering). */
  source?: string;
  /** Optional opaque payload for consumers that need plugin-specific data. */
  meta?: unknown;
}

/**
 * A single header row contributed by a plugin. Sits **above** the leaf
 * column-header row in the visual / export output.
 *
 * Plugins MAY return multiple contributions from a single `handleQuery`
 * call (e.g. multi-level grouping → one row per level), in which case each
 * row's `cells` must independently sum to `context.columns.length`.
 *
 * @category Plugin Development
 * @since 2.10.0
 */
export interface HeaderRowContribution {
  /** Cells in this row, in left-to-right column order. */
  cells: HeaderRowCell[];
}
// #endregion

// #region Cell Renderer Types
/**
 * Cell render context for plugin cell renderers.
 * Provides full context including position and editing state.
 */
export interface PluginCellRenderContext {
  /** The cell value */
  value: unknown;
  /** The row data object */
  row: unknown;
  /** The row index in the data array */
  rowIndex: number;
  /** The column index */
  colIndex: number;
  /** The field name */
  field: string;
  /** The column configuration */
  column: ColumnConfig;
  /** Whether the cell is being edited */
  isEditing: boolean;
}

/**
 * Cell renderer function type for plugins.
 */
export type CellRenderer = (ctx: PluginCellRenderContext) => string | HTMLElement;

/**
 * Header renderer function type for plugins.
 */
export type HeaderRenderer = (ctx: { column: ColumnConfig; colIndex: number }) => string | HTMLElement;

/**
 * Cell editor interface for plugins.
 */
export interface CellEditor {
  create(ctx: PluginCellRenderContext, commitFn: (value: unknown) => void, cancelFn: () => void): HTMLElement;
  getValue?(element: HTMLElement): unknown;
  focus?(element: HTMLElement): void;
}
// #endregion

// #region GridElementRef Interface
/**
 * Minimal grid interface for plugins.
 * This avoids circular imports with the full DataGridElement.
 *
 * Member prefixes indicate accessibility:
 * - `_underscore` = protected members accessible to plugins (marked @internal in full interface)
 */
export interface GridElementRef {
  // =========================================================================
  // HTMLElement-like Properties (avoid casting to HTMLElement)
  // =========================================================================

  /** Grid element width in pixels. */
  readonly clientWidth: number;
  /** Grid element height in pixels. */
  readonly clientHeight: number;
  /** Add an event listener to the grid element. */
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  /** Remove an event listener from the grid element. */
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
  /** Set an attribute on the grid element. */
  setAttribute(name: string, value: string): void;
  /** Get an attribute from the grid element. */
  getAttribute(name: string): string | null;
  /** Remove an attribute from the grid element. */
  removeAttribute(name: string): void;

  /**
   * The grid's host HTMLElement.
   * Use this instead of casting the grid to HTMLElement.
   * @internal Plugin API
   */
  readonly _hostElement: HTMLElement;

  // =========================================================================
  // Grid Data & Configuration
  // =========================================================================

  /** Current rows (after plugin processing like grouping, filtering). */
  rows: unknown[];
  /** Original unfiltered/unprocessed rows. */
  sourceRows: unknown[];
  /** Column configurations. */
  columns: ColumnConfig[];
  /** Visible columns only (excludes hidden). Use for rendering. @internal */
  _visibleColumns: ColumnConfig[];
  /** Full grid configuration. */
  gridConfig: GridConfig;
  /** Effective (merged) configuration - the single source of truth. */
  effectiveConfig: GridConfig;

  // =========================================================================
  // Row Update API
  // =========================================================================

  /**
   * Get the unique ID for a row.
   * Uses configured `getRowId` function or falls back to `row.id` / `row._id`.
   * @throws Error if no ID can be determined
   */
  getRowId(row: unknown): string;

  /**
   * Get a row by its ID.
   * O(1) lookup via internal Map.
   * @returns The row object, or undefined if not found
   */
  getRow(id: string): unknown | undefined;

  /**
   * Update a row by ID.
   * Mutates the row in-place and emits `cell-change` for each changed field.
   * @param id - Row identifier (from getRowId)
   * @param changes - Partial row data to merge
   * @param source - Origin of update (default: 'api')
   * @throws Error if row is not found
   */
  updateRow(id: string, changes: Record<string, unknown>, source?: UpdateSource): void;

  /**
   * Batch update multiple rows.
   * More efficient than multiple `updateRow()` calls - single render cycle.
   * @param updates - Array of { id, changes } objects
   * @param source - Origin of updates (default: 'api')
   * @throws Error if any row is not found
   */
  updateRows(updates: Array<{ id: string; changes: Record<string, unknown> }>, source?: UpdateSource): void;

  // =========================================================================
  // Focus & Lifecycle
  // =========================================================================

  /** Current focused row index. @internal */
  _focusRow: number;
  /** Current focused column index. @internal */
  _focusCol: number;
  /** AbortSignal that is aborted when the grid disconnects from the DOM. */
  disconnectSignal: AbortSignal;

  // =========================================================================
  // Rendering
  // =========================================================================

  /** Request a full re-render of the grid. */
  requestRender(): void;
  /** Request a full re-render and restore focus styling afterward. */
  requestRenderWithFocus(): void;
  /** Request a lightweight style update without rebuilding DOM. */
  requestAfterRender(): void;
  /** Re-render visible rows without rebuilding the row model or recalculating geometry. */
  requestVirtualRefresh(): void;
  /** Force a layout pass. */
  forceLayout(): Promise<void>;
  /** Dispatch an event from the grid element. */
  dispatchEvent(event: Event): boolean;

  // =========================================================================
  // Inter-plugin Communication
  // =========================================================================

  /**
   * Access to the plugin manager for event bus operations.
   * @internal - Use BaseGridPlugin's on/off/emitPluginEvent helpers instead.
   */
  _pluginManager?: {
    subscribe(plugin: unknown, eventType: string, callback: (detail: unknown) => void): void;
    unsubscribe(plugin: unknown, eventType: string): void;
    emitPluginEvent<T>(eventType: string, detail: T): void;
    /** Whether any attached plugin injects/removes rows (group headers, tree nodes, etc.). */
    _hasRowStructurePlugins: boolean;
  };

  /**
   * Query plugins with a simplified API.
   * Convenience wrapper that uses a flat signature.
   *
   * @param type - The query type (e.g., 'canMoveColumn')
   * @param context - The query context/parameters
   * @returns Array of non-undefined responses from plugins
   *
   * @example
   * const responses = grid.query<boolean>('canMoveColumn', column);
   * const canMove = !responses.includes(false);
   */
  query<T>(type: string, context?: unknown): T[];

  // =========================================================================
  // DOM Access
  // =========================================================================

  /**
   * Find the rendered DOM element for a row by its data index.
   * Returns null if the row is not currently rendered (virtualized out).
   */
  findRenderedRowElement(rowIndex: number): HTMLElement | null;

  // =========================================================================
  // Column Visibility API
  // =========================================================================

  /**
   * Get all columns including hidden ones.
   * Returns field, header, visibility status, lock state, and utility flag.
   */
  getAllColumns(): Array<{
    field: string;
    header: string;
    visible: boolean;
    lockVisible?: boolean;
    utility?: boolean;
  }>;

  /**
   * Set visibility for a specific column.
   * @returns true if state changed, false if column not found or already in state
   */
  setColumnVisible(field: string, visible: boolean): boolean;

  /**
   * Toggle visibility for a specific column.
   * @returns true if state changed, false if column not found
   */
  toggleColumnVisibility(field: string): boolean;

  /**
   * Check if a column is currently visible.
   */
  isColumnVisible(field: string): boolean;

  /**
   * Show all hidden columns.
   */
  showAllColumns(): void;

  // =========================================================================
  // Column Order API
  // =========================================================================

  /**
   * Get the current column display order as array of field names.
   */
  getColumnOrder(): string[];

  /**
   * Set the column display order.
   * @param order Array of field names in desired order
   */
  setColumnOrder(order: string[]): void;

  /**
   * Request emission of column-state-change event (debounced).
   * Call after programmatic column changes that should notify consumers.
   */
  requestStateChange?(): void;

  // =========================================================================
  // Tool Panel API (Shell Integration)
  // =========================================================================

  /**
   * Whether the tool panel sidebar is currently open.
   */
  readonly isToolPanelOpen: boolean;

  /**
   * The default row height in pixels.
   * For fixed heights, this is the configured or CSS-measured row height.
   * For variable heights, this is the average/estimated row height.
   * Plugins should use this instead of hardcoding row heights.
   */
  readonly defaultRowHeight: number;

  /**
   * Get the IDs of expanded accordion sections.
   */
  readonly expandedToolPanelSections: string[];

  /**
   * Open the tool panel sidebar (accordion view with all registered panels).
   */
  openToolPanel(): void;

  /**
   * Close the tool panel sidebar.
   */
  closeToolPanel(): void;

  /**
   * Toggle the tool panel sidebar open/closed.
   */
  toggleToolPanel(): void;

  /**
   * Toggle a specific accordion section expanded/collapsed.
   * @param sectionId - The panel ID to toggle (matches ToolPanelDefinition.id)
   */
  toggleToolPanelSection(sectionId: string): void;

  /**
   * Get registered tool panel definitions.
   */
  getToolPanels(): ToolPanelDefinition[];

  // =========================================================================
  // Variable Row Height API
  // =========================================================================

  /**
   * Invalidate a row's height in the position cache.
   * Call this when a plugin changes a row's height (e.g., expanding a detail panel).
   * The position cache will be updated incrementally without a full rebuild.
   *
   * @param rowIndex - Index of the row whose height changed
   * @param newHeight - Optional new height. If not provided, queries plugins for height.
   */
  invalidateRowHeight(rowIndex: number, newHeight?: number): void;
}
// #endregion

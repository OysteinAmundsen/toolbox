/**
 * Base Grid Plugin Class
 *
 * All plugins extend this abstract class.
 * Plugins are instantiated per-grid and manage their own state.
 */

import type {
  ColumnConfig,
  ColumnState,
  GridPlugin,
  HeaderContentDefinition,
  IconValue,
  ToolPanelDefinition,
} from '../types';
import { DEFAULT_GRID_ICONS } from '../types';

// Forward declare to avoid circular imports
export interface GridElement {
  shadowRoot: ShadowRoot | null;
  rows: any[];
  columns: ColumnConfig[];
  gridConfig: any;
  /**
   * Current focused row index
   * @internal Plugin API
   */
  _focusRow: number;
  /**
   * Current focused column index
   * @internal Plugin API
   */
  _focusCol: number;
  /** AbortSignal that is aborted when the grid disconnects from the DOM */
  disconnectSignal: AbortSignal;
  requestRender(): void;
  requestAfterRender(): void;
  forceLayout(): Promise<void>;
  getPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): T | undefined;
  getPluginByName(name: string): BaseGridPlugin | undefined;
  dispatchEvent(event: Event): boolean;
}

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
  field: string;
  value: any;
  row: any;
  cellEl: HTMLElement;
  originalEvent: MouseEvent;
}

/**
 * Row click event
 */
export interface RowClickEvent {
  rowIndex: number;
  row: any;
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
  originalEvent: MouseEvent;
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

/**
 * Context menu parameters
 */
export interface ContextMenuParams {
  x: number;
  y: number;
  rowIndex?: number;
  colIndex?: number;
  field?: string;
  value?: any;
  row?: any;
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

/**
 * Generic plugin query for inter-plugin communication.
 * Plugins can define their own query types as string constants
 * and respond to queries from other plugins.
 */
export interface PluginQuery<T = unknown> {
  /** Query type identifier (e.g., 'canMoveColumn', 'getContextMenuItems') */
  type: string;
  /** Query-specific context/parameters */
  context: T;
}

/**
 * Well-known plugin query types.
 * Plugins can define additional query types beyond these.
 */
export const PLUGIN_QUERIES = {
  /** Ask if a column can be moved. Context: ColumnConfig. Response: boolean | undefined */
  CAN_MOVE_COLUMN: 'canMoveColumn',
  /** Get context menu items. Context: ContextMenuParams. Response: ContextMenuItem[] */
  GET_CONTEXT_MENU_ITEMS: 'getContextMenuItems',
} as const;

/**
 * Cell render context for plugin cell renderers.
 * Provides full context including position and editing state.
 *
 * Note: This differs from the core `CellRenderContext` in types.ts which is
 * simpler and used for column view renderers. This version provides additional
 * context needed by plugins that register custom cell renderers.
 */
export interface PluginCellRenderContext {
  /** The cell value */
  value: any;
  /** The field/column key */
  field: string;
  /** The row data object */
  row: any;
  /** Row index in the data array */
  rowIndex: number;
  /** Column index */
  colIndex: number;
  /** Column configuration */
  column: ColumnConfig;
  /** Whether the cell is currently in edit mode */
  isEditing: boolean;
}

/**
 * Header render context for plugin header renderers.
 */
export interface PluginHeaderRenderContext {
  /** Column configuration */
  column: ColumnConfig;
  /** Column index */
  colIndex: number;
}

/**
 * Cell renderer function type for plugins.
 */
export type CellRenderer = (ctx: PluginCellRenderContext) => string | HTMLElement;

/**
 * Header renderer function type for plugins.
 */
export type HeaderRenderer = (ctx: PluginHeaderRenderContext) => string | HTMLElement;

/**
 * Cell editor interface for plugins.
 */
export interface CellEditor {
  create(ctx: PluginCellRenderContext, commitFn: (value: any) => void, cancelFn: () => void): HTMLElement;
  getValue?(element: HTMLElement): any;
  focus?(element: HTMLElement): void;
}

/**
 * Abstract base class for all grid plugins.
 *
 * @template TConfig - Configuration type for the plugin
 */
export abstract class BaseGridPlugin<TConfig = unknown> implements GridPlugin {
  /** Unique plugin identifier (derived from class name by default) */
  abstract readonly name: string;

  /** Plugin version - override in subclass if needed */
  readonly version: string = '1.0.0';

  /** CSS styles to inject into the grid's shadow DOM */
  readonly styles?: string;

  /** Custom cell renderers keyed by type name */
  readonly cellRenderers?: Record<string, CellRenderer>;

  /** Custom header renderers keyed by type name */
  readonly headerRenderers?: Record<string, HeaderRenderer>;

  /** Custom cell editors keyed by type name */
  readonly cellEditors?: Record<string, CellEditor>;

  /** The grid instance this plugin is attached to */
  protected grid!: GridElement;

  /** Plugin configuration - merged with defaults in attach() */
  protected config!: TConfig;

  /** User-provided configuration from constructor */
  private readonly userConfig: Partial<TConfig>;

  /**
   * Default configuration - subclasses should override this getter.
   * Note: This must be a getter (not property initializer) for proper inheritance
   * since property initializers run after parent constructor.
   */
  protected get defaultConfig(): Partial<TConfig> {
    return {};
  }

  constructor(config: Partial<TConfig> = {}) {
    this.userConfig = config;
  }

  /**
   * Called when the plugin is attached to a grid.
   * Override to set up event listeners, initialize state, etc.
   */
  attach(grid: GridElement): void {
    this.grid = grid;
    // Merge config here (after subclass construction is complete)
    this.config = { ...this.defaultConfig, ...this.userConfig } as TConfig;
  }

  /**
   * Called when the plugin is detached from a grid.
   * Override to clean up event listeners, timers, etc.
   */
  detach(): void {
    // Override in subclass
  }

  /**
   * Get another plugin instance from the same grid.
   * Use for inter-plugin communication.
   */
  protected getPlugin<T extends BaseGridPlugin>(PluginClass: new (...args: any[]) => T): T | undefined {
    return this.grid?.getPlugin(PluginClass);
  }

  /**
   * Emit a custom event from the grid.
   */
  protected emit<T>(eventName: string, detail: T): void {
    this.grid?.dispatchEvent?.(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  /**
   * Request a re-render of the grid.
   */
  protected requestRender(): void {
    this.grid?.requestRender?.();
  }

  /**
   * Request a lightweight style update without rebuilding DOM.
   * Use this instead of requestRender() when only CSS classes need updating.
   */
  protected requestAfterRender(): void {
    this.grid?.requestAfterRender?.();
  }

  /**
   * Get the current rows from the grid.
   */
  protected get rows(): any[] {
    return this.grid?.rows ?? [];
  }

  /**
   * Get the original unfiltered/unprocessed rows from the grid.
   * Use this when you need all source data regardless of active filters.
   */
  protected get sourceRows(): any[] {
    return (this.grid as any)?.sourceRows ?? [];
  }

  /**
   * Get the current columns from the grid.
   */
  protected get columns(): ColumnConfig[] {
    return this.grid?.columns ?? [];
  }

  /**
   * Get only visible columns from the grid (excludes hidden).
   * Use this for rendering that needs to match the grid template.
   */
  protected get visibleColumns(): ColumnConfig[] {
    return (this.grid as any)?.visibleColumns ?? [];
  }

  /**
   * Get the shadow root of the grid.
   */
  protected get shadowRoot(): ShadowRoot | null {
    return this.grid?.shadowRoot ?? null;
  }

  /**
   * Get the disconnect signal for event listener cleanup.
   * This signal is aborted when the grid disconnects from the DOM.
   * Use this when adding event listeners that should be cleaned up automatically.
   *
   * Best for:
   * - Document/window-level listeners added in attach()
   * - Listeners on the grid element itself
   * - Any listener that should persist across renders
   *
   * Not needed for:
   * - Listeners on elements created in afterRender() (removed with element)
   *
   * @example
   * element.addEventListener('click', handler, { signal: this.disconnectSignal });
   * document.addEventListener('keydown', handler, { signal: this.disconnectSignal });
   */
  protected get disconnectSignal(): AbortSignal {
    return this.grid?.disconnectSignal;
  }

  /**
   * Get the grid-level icons configuration.
   * Returns merged icons (user config + defaults).
   */
  protected get gridIcons(): typeof DEFAULT_GRID_ICONS {
    const userIcons = this.grid?.gridConfig?.icons ?? {};
    return { ...DEFAULT_GRID_ICONS, ...userIcons };
  }

  /**
   * Resolve an icon value to string or HTMLElement.
   * Checks plugin config first, then grid-level icons, then defaults.
   *
   * @param iconKey - The icon key in GridIcons (e.g., 'expand', 'collapse')
   * @param pluginOverride - Optional plugin-level override
   * @returns The resolved icon value
   */
  protected resolveIcon(iconKey: keyof typeof DEFAULT_GRID_ICONS, pluginOverride?: IconValue): IconValue {
    // Plugin override takes precedence
    if (pluginOverride !== undefined) {
      return pluginOverride;
    }
    // Then grid-level config
    return this.gridIcons[iconKey];
  }

  /**
   * Set an icon value on an element.
   * Handles both string (text/HTML) and HTMLElement values.
   *
   * @param element - The element to set the icon on
   * @param icon - The icon value (string or HTMLElement)
   */
  protected setIcon(element: HTMLElement, icon: IconValue): void {
    if (typeof icon === 'string') {
      element.innerHTML = icon;
    } else if (icon instanceof HTMLElement) {
      element.innerHTML = '';
      element.appendChild(icon.cloneNode(true));
    }
  }

  /**
   * Log a warning message.
   */
  protected warn(message: string): void {
    console.warn(`[tbw-grid:${this.name}] ${message}`);
  }

  // #region Lifecycle Hooks

  /**
   * Transform rows before rendering.
   * Called during each render cycle before rows are rendered to the DOM.
   * Use this to filter, sort, or add computed properties to rows.
   *
   * @param rows - The current rows array (readonly to encourage returning a new array)
   * @returns The modified rows array to render
   *
   * @example
   * ```ts
   * processRows(rows: readonly any[]): any[] {
   *   // Filter out hidden rows
   *   return rows.filter(row => !row._hidden);
   * }
   * ```
   *
   * @example
   * ```ts
   * processRows(rows: readonly any[]): any[] {
   *   // Add computed properties
   *   return rows.map(row => ({
   *     ...row,
   *     _fullName: `${row.firstName} ${row.lastName}`
   *   }));
   * }
   * ```
   */
  processRows?(rows: readonly any[]): any[];

  /**
   * Transform columns before rendering.
   * Called during each render cycle before column headers and cells are rendered.
   * Use this to add, remove, or modify column definitions.
   *
   * @param columns - The current columns array (readonly to encourage returning a new array)
   * @returns The modified columns array to render
   *
   * @example
   * ```ts
   * processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
   *   // Add a selection checkbox column
   *   return [
   *     { field: '_select', header: '', width: 40 },
   *     ...columns
   *   ];
   * }
   * ```
   */
  processColumns?(columns: readonly ColumnConfig[]): ColumnConfig[];

  /**
   * Called before each render cycle begins.
   * Use this to prepare state or cache values needed during rendering.
   *
   * @example
   * ```ts
   * beforeRender(): void {
   *   this.visibleRowCount = this.calculateVisibleRows();
   * }
   * ```
   */
  beforeRender?(): void;

  /**
   * Called after each render cycle completes.
   * Use this for DOM manipulation, adding event listeners to rendered elements,
   * or applying visual effects like selection highlights.
   *
   * @example
   * ```ts
   * afterRender(): void {
   *   // Apply selection styling to rendered rows
   *   const rows = this.shadowRoot?.querySelectorAll('.data-row');
   *   rows?.forEach((row, i) => {
   *     row.classList.toggle('selected', this.selectedRows.has(i));
   *   });
   * }
   * ```
   */
  afterRender?(): void;

  /**
   * Called after scroll-triggered row rendering completes.
   * This is a lightweight hook for applying visual state to recycled DOM elements.
   * Use this instead of afterRender when you need to reapply styling during scroll.
   *
   * Performance note: This is called frequently during scroll. Keep implementation fast.
   *
   * @example
   * ```ts
   * onScrollRender(): void {
   *   // Reapply selection state to visible cells
   *   this.applySelectionToVisibleCells();
   * }
   * ```
   */
  onScrollRender?(): void;

  /**
   * Return extra height contributed by this plugin (e.g., expanded detail rows).
   * Used to adjust scrollbar height calculations for virtualization.
   *
   * @returns Total extra height in pixels
   *
   * @example
   * ```ts
   * getExtraHeight(): number {
   *   return this.expandedRows.size * this.detailHeight;
   * }
   * ```
   */
  getExtraHeight?(): number;

  /**
   * Return extra height that appears before a given row index.
   * Used by virtualization to correctly calculate scroll positions when
   * there's variable height content (like expanded detail rows) above the viewport.
   *
   * @param beforeRowIndex - The row index to calculate extra height before
   * @returns Extra height in pixels that appears before this row
   *
   * @example
   * ```ts
   * getExtraHeightBefore(beforeRowIndex: number): number {
   *   let height = 0;
   *   for (const expandedRowIndex of this.expandedRowIndices) {
   *     if (expandedRowIndex < beforeRowIndex) {
   *       height += this.getDetailHeight(expandedRowIndex);
   *     }
   *   }
   *   return height;
   * }
   * ```
   */
  getExtraHeightBefore?(beforeRowIndex: number): number;

  /**
   * Adjust the virtualization start index to render additional rows before the visible range.
   * Use this when expanded content (like detail rows) needs its parent row to remain rendered
   * even when the parent row itself has scrolled above the viewport.
   *
   * @param start - The calculated start row index
   * @param scrollTop - The current scroll position
   * @param rowHeight - The height of a single row
   * @returns The adjusted start index (lower than or equal to original start)
   *
   * @example
   * ```ts
   * adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
   *   // If row 5 is expanded and scrolled partially, keep it rendered
   *   for (const expandedRowIndex of this.expandedRowIndices) {
   *     const expandedRowTop = expandedRowIndex * rowHeight;
   *     const expandedRowBottom = expandedRowTop + rowHeight + this.detailHeight;
   *     if (expandedRowBottom > scrollTop && expandedRowIndex < start) {
   *       return expandedRowIndex;
   *     }
   *   }
   *   return start;
   * }
   * ```
   */
  adjustVirtualStart?(start: number, scrollTop: number, rowHeight: number): number;

  /**
   * Render a custom row, bypassing the default row rendering.
   * Use this for special row types like group headers, detail rows, or footers.
   *
   * @param row - The row data object
   * @param rowEl - The row DOM element to render into
   * @param rowIndex - The index of the row in the data array
   * @returns `true` if the plugin handled rendering (prevents default), `false`/`void` for default rendering
   *
   * @example
   * ```ts
   * renderRow(row: any, rowEl: HTMLElement, rowIndex: number): boolean | void {
   *   if (row._isGroupHeader) {
   *     rowEl.innerHTML = `<div class="group-header">${row._groupLabel}</div>`;
   *     return true; // Handled - skip default rendering
   *   }
   *   // Return void to let default rendering proceed
   * }
   * ```
   */
  renderRow?(row: any, rowEl: HTMLElement, rowIndex: number): boolean | void;

  // #endregion

  // #region Inter-Plugin Communication

  /**
   * Handle queries from other plugins.
   * This is the generic mechanism for inter-plugin communication.
   * Plugins can respond to well-known query types or define their own.
   *
   * @param query - The query object with type and context
   * @returns Query-specific response, or undefined if not handling this query
   *
   * @example
   * ```ts
   * onPluginQuery(query: PluginQuery): unknown {
   *   switch (query.type) {
   *     case PLUGIN_QUERIES.CAN_MOVE_COLUMN:
   *       // Prevent moving pinned columns
   *       const column = query.context as ColumnConfig;
   *       if (column.sticky === 'left' || column.sticky === 'right') {
   *         return false;
   *       }
   *       break;
   *     case PLUGIN_QUERIES.GET_CONTEXT_MENU_ITEMS:
   *       const params = query.context as ContextMenuParams;
   *       return [{ id: 'my-action', label: 'My Action', action: () => {} }];
   *   }
   * }
   * ```
   */
  onPluginQuery?(query: PluginQuery): unknown;

  // #endregion

  // #region Interaction Hooks

  /**
   * Handle keyboard events on the grid.
   * Called when a key is pressed while the grid or a cell has focus.
   *
   * @param event - The native KeyboardEvent
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onKeyDown(event: KeyboardEvent): boolean | void {
   *   // Handle Ctrl+A for select all
   *   if (event.ctrlKey && event.key === 'a') {
   *     this.selectAllRows();
   *     return true; // Prevent default browser select-all
   *   }
   * }
   * ```
   */
  onKeyDown?(event: KeyboardEvent): boolean | void;

  /**
   * Handle cell click events.
   * Called when a data cell is clicked (not headers).
   *
   * @param event - Cell click event with row/column context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onCellClick(event: CellClickEvent): boolean | void {
   *   if (event.field === '_select') {
   *     this.toggleRowSelection(event.rowIndex);
   *     return true; // Handled
   *   }
   * }
   * ```
   */
  onCellClick?(event: CellClickEvent): boolean | void;

  /**
   * Handle row click events.
   * Called when any part of a data row is clicked.
   * Note: This is called in addition to onCellClick, not instead of.
   *
   * @param event - Row click event with row context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onRowClick(event: RowClickEvent): boolean | void {
   *   if (this.config.mode === 'row') {
   *     this.selectRow(event.rowIndex, event.originalEvent);
   *     return true;
   *   }
   * }
   * ```
   */
  onRowClick?(event: RowClickEvent): boolean | void;

  /**
   * Handle header click events.
   * Called when a column header is clicked. Commonly used for sorting.
   *
   * @param event - Header click event with column context
   * @returns `true` to prevent default behavior and stop propagation, `false`/`void` to allow default
   *
   * @example
   * ```ts
   * onHeaderClick(event: HeaderClickEvent): boolean | void {
   *   if (event.column.sortable !== false) {
   *     this.toggleSort(event.field);
   *     return true;
   *   }
   * }
   * ```
   */
  onHeaderClick?(event: HeaderClickEvent): boolean | void;

  /**
   * Handle scroll events on the grid viewport.
   * Called during scrolling. Note: This may be called frequently; debounce if needed.
   *
   * @param event - Scroll event with scroll position and viewport dimensions
   *
   * @example
   * ```ts
   * onScroll(event: ScrollEvent): void {
   *   // Update sticky column positions
   *   this.updateStickyPositions(event.scrollLeft);
   * }
   * ```
   */
  onScroll?(event: ScrollEvent): void;

  /**
   * Handle cell mousedown events.
   * Used for initiating drag operations like range selection or column resize.
   *
   * @param event - Mouse event with cell context
   * @returns `true` to indicate drag started (prevents text selection), `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseDown(event: CellMouseEvent): boolean | void {
   *   if (event.rowIndex !== undefined && this.config.mode === 'range') {
   *     this.startDragSelection(event.rowIndex, event.colIndex);
   *     return true; // Prevent text selection
   *   }
   * }
   * ```
   */
  onCellMouseDown?(event: CellMouseEvent): boolean | void;

  /**
   * Handle cell mousemove events during drag operations.
   * Only called when a drag is in progress (after mousedown returned true).
   *
   * @param event - Mouse event with current cell context
   * @returns `true` to continue handling the drag, `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseMove(event: CellMouseEvent): boolean | void {
   *   if (this.isDragging && event.rowIndex !== undefined) {
   *     this.extendSelection(event.rowIndex, event.colIndex);
   *     return true;
   *   }
   * }
   * ```
   */
  onCellMouseMove?(event: CellMouseEvent): boolean | void;

  /**
   * Handle cell mouseup events to end drag operations.
   *
   * @param event - Mouse event with final cell context
   * @returns `true` if drag was finalized, `false`/`void` otherwise
   *
   * @example
   * ```ts
   * onCellMouseUp(event: CellMouseEvent): boolean | void {
   *   if (this.isDragging) {
   *     this.finalizeDragSelection();
   *     this.isDragging = false;
   *     return true;
   *   }
   * }
   * ```
   */
  onCellMouseUp?(event: CellMouseEvent): boolean | void;

  // Note: Context menu items are now provided via onPluginQuery with PLUGIN_QUERIES.GET_CONTEXT_MENU_ITEMS
  // This keeps the core decoupled from the context-menu plugin specifics.

  // #endregion

  // #region Column State Hooks

  /**
   * Contribute plugin-specific state for a column.
   * Called by the grid when collecting column state for serialization.
   * Plugins can add their own properties to the column state.
   *
   * @param field - The field name of the column
   * @returns Partial column state with plugin-specific properties, or undefined if no state to contribute
   *
   * @example
   * ```ts
   * getColumnState(field: string): Partial<ColumnState> | undefined {
   *   const filterModel = this.filterModels.get(field);
   *   if (filterModel) {
   *     // Uses module augmentation to add filter property to ColumnState
   *     return { filter: filterModel } as Partial<ColumnState>;
   *   }
   *   return undefined;
   * }
   * ```
   */
  getColumnState?(field: string): Partial<ColumnState> | undefined;

  /**
   * Apply plugin-specific state to a column.
   * Called by the grid when restoring column state from serialized data.
   * Plugins should restore their internal state based on the provided state.
   *
   * @param field - The field name of the column
   * @param state - The column state to apply (may contain plugin-specific properties)
   *
   * @example
   * ```ts
   * applyColumnState(field: string, state: ColumnState): void {
   *   // Check for filter property added via module augmentation
   *   const filter = (state as any).filter;
   *   if (filter) {
   *     this.filterModels.set(field, filter);
   *     this.applyFilter();
   *   }
   * }
   * ```
   */
  applyColumnState?(field: string, state: ColumnState): void;

  // #endregion

  // #region Scroll Boundary Hooks

  /**
   * Report horizontal scroll boundary offsets for this plugin.
   * Plugins that obscure part of the scroll area (e.g., pinned/sticky columns)
   * should return how much space they occupy on each side.
   * The keyboard navigation uses this to ensure focused cells are fully visible.
   *
   * @param rowEl - The row element (optional, for calculating widths from rendered cells)
   * @param focusedCell - The currently focused cell element (optional, to determine if scrolling should be skipped)
   * @returns Object with left/right pixel offsets and optional skipScroll flag, or undefined if plugin has no offsets
   *
   * @example
   * ```ts
   * getHorizontalScrollOffsets(rowEl?: HTMLElement, focusedCell?: HTMLElement): { left: number; right: number; skipScroll?: boolean } | undefined {
   *   // Calculate total width of left-pinned columns
   *   const leftCells = rowEl?.querySelectorAll('.sticky-left') ?? [];
   *   let left = 0;
   *   leftCells.forEach(el => { left += (el as HTMLElement).offsetWidth; });
   *   // Skip scroll if focused cell is pinned (always visible)
   *   const skipScroll = focusedCell?.classList.contains('sticky-left');
   *   return { left, right: 0, skipScroll };
   * }
   * ```
   */
  getHorizontalScrollOffsets?(
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ): { left: number; right: number; skipScroll?: boolean } | undefined;

  // #endregion

  // #region Shell Integration Hooks

  /**
   * Register a tool panel for this plugin.
   * Return undefined if plugin has no tool panel.
   * The shell will create a toolbar toggle button and render the panel content
   * when the user opens the panel.
   *
   * @returns Tool panel definition, or undefined if plugin has no panel
   *
   * @example
   * ```ts
   * getToolPanel(): ToolPanelDefinition | undefined {
   *   return {
   *     id: 'columns',
   *     title: 'Columns',
   *     icon: '☰',
   *     tooltip: 'Show/hide columns',
   *     order: 10,
   *     render: (container) => {
   *       this.renderColumnList(container);
   *       return () => this.cleanup();
   *     },
   *   };
   * }
   * ```
   */
  getToolPanel?(): ToolPanelDefinition | undefined;

  /**
   * Register content for the shell header center section.
   * Return undefined if plugin has no header content.
   * Examples: search input, selection summary, status indicators.
   *
   * @returns Header content definition, or undefined if plugin has no header content
   *
   * @example
   * ```ts
   * getHeaderContent(): HeaderContentDefinition | undefined {
   *   return {
   *     id: 'quick-filter',
   *     order: 10,
   *     render: (container) => {
   *       const input = document.createElement('input');
   *       input.type = 'text';
   *       input.placeholder = 'Search...';
   *       input.addEventListener('input', this.handleInput);
   *       container.appendChild(input);
   *       return () => input.removeEventListener('input', this.handleInput);
   *     },
   *   };
   * }
   * ```
   */
  getHeaderContent?(): HeaderContentDefinition | undefined;

  // #endregion
}

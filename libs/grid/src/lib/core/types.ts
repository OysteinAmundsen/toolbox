import type { RenderPhase } from './internal/render-scheduler';
import type { ShellState } from './internal/shell';
import type { RowPosition } from './internal/virtualization';
import type { AfterCellRenderContext, AfterRowRenderContext, CellMouseEvent } from './plugin/types';

/**
 * Position entry for a single row in the position cache.
 * Part of variable row height virtualization.
 *
 * Re-exported from position-cache.ts for public API consistency.
 *
 * @see VirtualState.positionCache
 * @category Plugin Development
 */
export type RowPositionEntry = RowPosition;

// #region ScrollToRowOptions
/**
 * Options for the {@link PublicGrid.scrollToRow} method.
 *
 * @group Focus & Navigation
 *
 * @example
 * ```typescript
 * grid.scrollToRow(42, { align: 'center', behavior: 'smooth' });
 * ```
 * @since 1.23.0
 */
export interface ScrollToRowOptions {
  /**
   * Where to position the row in the viewport.
   *
   * - `'start'`   — top of the viewport
   * - `'center'`  — vertically centered
   * - `'end'`     — bottom of the viewport
   * - `'nearest'` — scroll only if the row is outside the viewport (default)
   *
   * @defaultValue `'nearest'`
   */
  align?: 'start' | 'center' | 'end' | 'nearest';
  /**
   * Scroll behavior.
   *
   * - `'instant'` — jump immediately (default)
   * - `'smooth'`  — animate the scroll
   *
   * @defaultValue `'instant'`
   */
  behavior?: 'smooth' | 'instant';
}
// #endregion

// #region PublicGrid Interface
/**
 * Public API interface for DataGrid component.
 *
 * **Property Getters vs Setters:**
 *
 * Property getters return the EFFECTIVE (resolved) value after merging all config sources.
 * This is the "current situation" - what consumers and plugins need to know.
 *
 * Property setters accept input values which are merged into the effective config.
 * Multiple sources can contribute (gridConfig, columns prop, light DOM, individual props).
 *
 * For example:
 * - `grid.fitMode` returns the resolved fitMode (e.g., 'stretch' even if you set undefined)
 * - `grid.columns` returns the effective columns after merging
 * - `grid.gridConfig` returns the full effective config
 * @since 0.1.1
 */
export interface PublicGrid<T = any> {
  /**
   * Full config object. Setter merges with other inputs per precedence rules.
   * Getter returns the effective (resolved) config.
   */
  gridConfig?: GridConfig<T>;
  /**
   * Column definitions.
   * Getter returns effective columns (after merging config, light DOM, inference).
   */
  columns?: ColumnConfig<T>[];
  /** Current row data (after plugin processing like grouping, filtering). */
  rows?: T[];
  /** Insert a row at a visible index, bypassing the sort/filter pipeline. Auto-animates by default. */
  insertRow?(index: number, row: T, animate?: boolean): Promise<void>;
  /** Remove a row at a visible index, bypassing the sort/filter pipeline. Auto-animates by default. */
  removeRow?(index: number, animate?: boolean): Promise<T | undefined>;
  /** Apply a batch of add/update/remove mutations in a single render cycle. */
  applyTransaction?(transaction: RowTransaction<T>, animate?: boolean): Promise<TransactionResult<T>>;
  /** Batch-friendly version — merges rapid calls within a single animation frame. */
  applyTransactionAsync?(transaction: RowTransaction<T>): Promise<TransactionResult<T>>;
  /** Resolves once the component has finished initial work (layout, inference). */
  ready?: () => Promise<void>;
  /** Force a layout / measurement pass (e.g. after container resize). */
  forceLayout?: () => Promise<void>;
  /** Return effective resolved config (after inference & precedence). */
  getConfig?: () => Promise<Readonly<GridConfig<T>>>;
  /** Toggle expansion state of a group row by its generated key. */
  toggleGroup?: (key: string) => Promise<void>;

  // Custom Styles API
  /**
   * Register custom CSS styles to be injected into the grid.
   * Use this to style custom cell renderers, editors, or detail panels.
   * @param id - Unique identifier for the style block (for removal/updates)
   * @param css - CSS string to inject
   */
  registerStyles?: (id: string, css: string) => void;
  /**
   * Remove previously registered custom styles.
   * @param id - The ID used when registering the styles
   */
  unregisterStyles?: (id: string) => void;
  /**
   * Get list of registered custom style IDs.
   */
  getRegisteredStyles?: () => string[];

  // Plugin API
  /**
   * Get a plugin instance by its class.
   *
   * **Prefer {@link getPluginByName}** — it avoids importing the plugin class
   * and returns the actual registered instance with full type narrowing.
   *
   * @example
   * ```typescript
   * // Preferred: by name
   * const selection = grid.getPluginByName('selection');
   *
   * // Alternative: by class
   * const selection = grid.getPlugin(SelectionPlugin);
   * if (selection) {
   *   selection.selectAll();
   * }
   * ```
   */
  getPlugin?<P>(PluginClass: new (...args: any[]) => P): P | undefined;
  /**
   * Get a plugin instance by its name.
   *
   * When a plugin augments the `PluginNameMap` interface, the return
   * type is narrowed automatically:
   *
   * ```typescript
   * const editing = grid.getPluginByName('editing');
   * editing?.beginBulkEdit(0); // ✅ typed as EditingPlugin
   * ```
   *
   * For unknown names the return type falls back to `GridPlugin | undefined`.
   */
  getPluginByName?<K extends string>(
    name: K,
  ): (K extends keyof PluginNameMap ? PluginNameMap[K] : GridPlugin) | undefined;

  // Shell API
  /**
   * Re-render the shell header (title, column groups, toolbar).
   * Call this after dynamically adding/removing tool panels or toolbar buttons.
   */
  refreshShellHeader?(): void;
  /**
   * Register a custom tool panel in the sidebar.
   *
   * @example
   * ```typescript
   * grid.registerToolPanel({
   *   id: 'analytics',
   *   title: 'Analytics',
   *   icon: '📊',
   *   render: (container) => {
   *     container.innerHTML = '<div>Charts here...</div>';
   *   }
   * });
   * ```
   */
  registerToolPanel?(panel: ToolPanelDefinition): void;
  /**
   * Unregister a previously registered tool panel.
   */
  unregisterToolPanel?(panelId: string): void;
  /**
   * Open the tool panel sidebar.
   * @param panelId - Optional ID of the section to expand on open. Takes precedence
   *   over `shell.toolPanel.defaultOpen`. Falls back to default behavior with a
   *   warning if the ID is not registered.
   */
  openToolPanel?(panelId?: string): void;
  /**
   * Close the tool panel sidebar.
   */
  closeToolPanel?(): void;
  /**
   * Toggle the tool panel sidebar open or closed.
   */
  toggleToolPanel?(): void;
  /**
   * Toggle an accordion section expanded or collapsed within the tool panel.
   * @param sectionId - The ID of the section to toggle
   */
  toggleToolPanelSection?(sectionId: string): void;

  // State Persistence API
  /**
   * Get the current column state including order, width, visibility, and sort.
   * Use for persisting user preferences to localStorage or a backend.
   *
   * @example
   * ```typescript
   * const state = grid.getColumnState();
   * localStorage.setItem('gridState', JSON.stringify(state));
   * ```
   */
  getColumnState?(): GridColumnState;
  /**
   * Read the current column state. Property-style accessor that mirrors
   * {@link PublicGrid.getColumnState}. To restore state, use
   * {@link PublicGrid.applyColumnState}.
   *
   * @example
   * ```typescript
   * const snapshot = grid.columnState;
   * ```
   */
  columnState?: GridColumnState;

  /**
   * Apply a previously saved column state, restoring column order, widths,
   * visibility, sort, and any plugin-contributed state. Can be called before
   * or after grid initialization — pre-init calls are deferred and applied
   * during setup.
   *
   * @example
   * ```typescript
   * const saved = localStorage.getItem('gridState');
   * if (saved) grid.applyColumnState(JSON.parse(saved));
   * ```
   */
  applyColumnState?(state: GridColumnState | undefined): void;

  // Sort API
  /**
   * Get the current sort state.
   *
   * Returns `null` when no sort is active.
   *
   * @example
   * ```typescript
   * const sort = grid.sortModel;
   * // { field: 'id', direction: 'desc' } | null
   * ```
   */
  readonly sortModel?: { field: string; direction: 'asc' | 'desc' } | null;

  /**
   * Sort by a column, toggle a column's sort direction, or clear sorting.
   *
   * - `sort('id', 'desc')` — apply sort with explicit direction
   * - `sort('id')` — toggle: none → asc → desc → none
   * - `sort(null)` — clear sort, restore original row order
   *
   * @param field - Column field to sort by, or `null` to clear
   * @param direction - Explicit direction; omit to toggle
   *
   * @example
   * ```typescript
   * grid.sort('id', 'desc');  // sort descending
   * grid.sort('price');       // toggle sort on price
   * grid.sort(null);          // clear sort
   * ```
   */
  sort?(field: string | null, direction?: 'asc' | 'desc'): void;

  // Loading API
  /**
   * Whether the grid is currently in a loading state.
   * When true, displays a loading overlay with spinner.
   *
   * Can also be set via the `loading` HTML attribute.
   *
   * @example
   * ```typescript
   * // Show loading overlay
   * grid.loading = true;
   * const data = await fetchData();
   * grid.rows = data;
   * grid.loading = false;
   * ```
   */
  loading?: boolean;

  /**
   * Set loading state for a specific row.
   * Displays a small spinner indicator on the row.
   *
   * Use when persisting row data or performing row-level async operations.
   *
   * @param rowId - The row's unique identifier (from getRowId)
   * @param loading - Whether the row is loading
   *
   * @example
   * ```typescript
   * // Show loading while saving row
   * grid.setRowLoading('emp-123', true);
   * await saveRow(row);
   * grid.setRowLoading('emp-123', false);
   * ```
   */
  setRowLoading?(rowId: string, loading: boolean): void;

  /**
   * Set loading state for a specific cell.
   * Displays a small spinner indicator on the cell.
   *
   * Use when performing cell-level async operations (e.g., validation, lookup).
   *
   * @param rowId - The row's unique identifier (from getRowId)
   * @param field - The column field
   * @param loading - Whether the cell is loading
   *
   * @example
   * ```typescript
   * // Show loading while validating cell
   * grid.setCellLoading('emp-123', 'email', true);
   * const isValid = await validateEmail(email);
   * grid.setCellLoading('emp-123', 'email', false);
   * ```
   */
  setCellLoading?(rowId: string, field: string, loading: boolean): void;

  /**
   * Check if a row is currently in loading state.
   * @param rowId - The row's unique identifier
   */
  isRowLoading?(rowId: string): boolean;

  /**
   * Check if a cell is currently in loading state.
   * @param rowId - The row's unique identifier
   * @param field - The column field
   */
  isCellLoading?(rowId: string, field: string): boolean;

  /**
   * Clear all row and cell loading states.
   */
  clearAllLoading?(): void;

  // Focus Management API
  /**
   * Register an external DOM element as a logical focus container of this grid.
   *
   * Focus moving into a registered container is treated as if it stayed inside
   * the grid: `data-has-focus` is preserved, click-outside commit is suppressed,
   * and the editing focus trap (when enabled) won't reclaim focus.
   *
   * Typical use case: overlay panels (datepickers, dropdowns, autocompletes)
   * that render at `<body>` level to escape grid overflow clipping.
   *
   * @param el - The external element to register
   *
   * @example
   * ```typescript
   * const overlay = document.createElement('div');
   * document.body.appendChild(overlay);
   *
   * // Tell the grid this overlay is "part of" the grid
   * grid.registerExternalFocusContainer(overlay);
   *
   * // Later, when overlay is removed
   * grid.unregisterExternalFocusContainer(overlay);
   * ```
   */
  registerExternalFocusContainer?(el: Element): void;

  /**
   * Unregister a previously registered external focus container.
   *
   * @param el - The element to unregister
   */
  unregisterExternalFocusContainer?(el: Element): void;

  /**
   * Check whether focus is logically inside this grid.
   *
   * Returns `true` when `document.activeElement` (or the given node) is
   * inside the grid's own DOM **or** inside any element registered via
   * {@link registerExternalFocusContainer}.
   *
   * @param node - Optional node to test. Defaults to `document.activeElement`.
   *
   * @example
   * ```typescript
   * if (grid.containsFocus()) {
   *   console.log('Grid or one of its overlays has focus');
   * }
   * ```
   */
  containsFocus?(node?: Node | null): boolean;

  // Focus & Navigation API
  /**
   * Move focus to a specific cell.
   *
   * @param rowIndex - Row index (0-based, in the current processed row array)
   * @param column - Column index (0-based into visible columns) or field name
   */
  focusCell?(rowIndex: number, column: number | string): void;

  /**
   * The currently focused cell position, or `null` if no rows are loaded.
   */
  readonly focusedCell?: { rowIndex: number; colIndex: number; field: string } | null;

  /**
   * Scroll to make a row visible by its index.
   *
   * @param rowIndex - Row index (0-based, in the current processed row array)
   * @param options - Scroll alignment and behavior
   */
  scrollToRow?(rowIndex: number, options?: ScrollToRowOptions): void;

  /**
   * Scroll to make a row visible by its unique ID.
   *
   * @param rowId - The row's unique identifier (from {@link GridConfig.getRowId | getRowId})
   * @param options - Scroll alignment and behavior
   */
  scrollToRowById?(rowId: string, options?: ScrollToRowOptions): void;
}
// #endregion

// #region InternalGrid Interface
/**
 * Internal-only augmented interface for DataGrid component.
 *
 * Member prefixes indicate accessibility:
 * - `_underscore` = protected members - private outside core, accessible to plugins. Marked with @internal.
 * - `__doubleUnderscore` = deeply internal members - private outside core, only for internal functions.
 *
 * @category Plugin Development
 * @since 0.1.1
 */
export interface InternalGrid<T = any> extends PublicGrid<T>, GridConfig<T> {
  // Element methods available because DataGridElement extends HTMLElement
  /** The element's `id` attribute. Available because DataGridElement extends HTMLElement. */
  id: string;
  /**
   * The grid's host HTMLElement (`this`). Use instead of casting `grid as unknown as HTMLElement`.
   * @internal
   */
  readonly _hostElement: HTMLElement;
  querySelector<K extends keyof HTMLElementTagNameMap>(selectors: K): HTMLElementTagNameMap[K] | null;
  querySelector<E extends Element = Element>(selectors: string): E | null;
  querySelectorAll<K extends keyof HTMLElementTagNameMap>(selectors: K): NodeListOf<HTMLElementTagNameMap[K]>;
  querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
  _rows: T[];
  _columns: ColumnInternal<T>[];
  /** Visible columns only (excludes hidden). Use for rendering. */
  _visibleColumns: ColumnInternal<T>[];
  _headerRowEl: HTMLElement;
  _bodyEl: HTMLElement;
  _rowPool: RowElementInternal[];
  _resizeController: ResizeController;
  _sortState: { field: string; direction: 1 | -1 } | null;
  /** Original unfiltered/unprocessed rows. @internal */
  sourceRows: T[];
  /** Framework adapter instance (set by Grid directives). @internal */
  __frameworkAdapter?: FrameworkAdapter;
  __originalOrder: T[];
  __rowRenderEpoch: number;
  __didInitialAutoSize?: boolean;
  __lightDomColumnsCache?: ColumnInternal[];
  __originalColumnNodes?: HTMLElement[];
  /** Cell display value cache. @internal */
  __cellDisplayCache?: Map<number, string[]>;
  /** Cache epoch for cell display values. @internal */
  __cellCacheEpoch?: number;
  /** Cached header row count for virtualization. @internal */
  __cachedHeaderRowCount?: number;
  /** Cached flag for whether grid has special columns (custom renderers, etc.). @internal */
  __hasSpecialColumns?: boolean;
  /** Cached flag for whether any plugin has renderRow hooks. @internal */
  __hasRenderRowPlugins?: boolean;
  /** @internal Access the plugin manager's cached state. */
  _pluginManager?: {
    _hasRowStructurePlugins: boolean;
    /** Emit an event on the plugin event bus (does not dispatch a DOM event). */
    emitPluginEvent?: <D>(eventType: string, detail: D) => void;
  };
  _gridTemplate: string;
  _virtualization: VirtualState;
  _focusRow: number;
  _focusCol: number;
  /** Currently active edit row index. Injected by EditingPlugin. @internal */
  _activeEditRows?: number;
  /** Whether the grid is in 'grid' editing mode (all rows editable). Injected by EditingPlugin. @internal */
  _isGridEditMode?: boolean;
  /** Snapshots of row data before editing. Injected by EditingPlugin. @internal */
  _rowEditSnapshots?: Map<number, T>;
  /** Get all changed rows. Injected by EditingPlugin. */
  changedRows?: T[];
  /** Get IDs of all changed rows. Injected by EditingPlugin. */
  changedRowIds?: string[];
  /** Internal Set for O(1) lookup in the render hot path. Injected by EditingPlugin. @internal */
  _changedRowIdSet?: ReadonlySet<string>;
  effectiveConfig?: GridConfig<T>;
  findHeaderRow?: () => HTMLElement;
  refreshVirtualWindow: (full: boolean, skipAfterRender?: boolean) => boolean;
  /** @internal Trigger a COLUMNS-phase re-render. */
  refreshColumns?: () => void;
  updateTemplate?: () => void;
  findRenderedRowElement?: (rowIndex: number) => HTMLElement | null;
  /** Get a row by its ID. Implemented in grid.ts */
  getRow?: (id: string) => T | undefined;
  /** Get a row and its current index by ID. Returns undefined if not found. @internal */
  _getRowEntry: (id: string) => { row: T; index: number } | undefined;
  /** Get the unique ID for a row. Implemented in grid.ts */
  getRowId?: (row: T) => string;
  /** Update a row by ID. Implemented in grid.ts */
  updateRow?: (id: string, changes: Partial<T>, source?: UpdateSource) => void;
  /** Animate a single row. Returns Promise that resolves when animation completes. Implemented in grid.ts */
  animateRow?: (rowIndex: number, type: RowAnimationType) => Promise<boolean>;
  /** Animate multiple rows. Returns Promise that resolves when all animations complete. Implemented in grid.ts */
  animateRows?: (rowIndices: number[], type: RowAnimationType) => Promise<number>;
  /** Animate a row by its ID. Returns Promise that resolves when animation completes. Implemented in grid.ts */
  animateRowById?: (rowId: string, type: RowAnimationType) => Promise<boolean>;
  /** Begin bulk edit on a row. Injected by EditingPlugin. */
  beginBulkEdit?: (rowIndex: number) => void;
  /** Commit active row edit. Injected by EditingPlugin. */
  commitActiveRowEdit?: () => void;
  /** Dispatch cell click to plugin system, returns true if handled */
  _dispatchCellClick?: (event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement) => boolean;
  /** Dispatch row click to plugin system, returns true if handled */
  _dispatchRowClick?: (event: MouseEvent, rowIndex: number, row: any, rowEl: HTMLElement) => boolean;
  /** Dispatch header click to plugin system, returns true if handled */
  _dispatchHeaderClick?: (event: MouseEvent | KeyboardEvent, col: ColumnConfig, headerEl: HTMLElement) => boolean;
  /** Dispatch keydown to plugin system, returns true if handled */
  _dispatchKeyDown?: (event: KeyboardEvent) => boolean;
  /** Dispatch cell mouse events for drag operations. Returns true if any plugin started a drag. */
  _dispatchCellMouseDown?: (event: CellMouseEvent) => boolean;
  /** Dispatch cell mouse move during drag. */
  _dispatchCellMouseMove?: (event: CellMouseEvent) => void;
  /** Dispatch cell mouse up to end drag. */
  _dispatchCellMouseUp?: (event: CellMouseEvent) => void;
  /** Call afterCellRender hook on all plugins. Called from rows.ts after each cell is rendered. @internal */
  _afterCellRender?: (context: AfterCellRenderContext<T>) => void;
  /** Check if any plugin has registered an afterCellRender hook. Used to skip hook call for performance. @internal */
  _hasAfterCellRenderHook?: () => boolean;
  /** Call afterRowRender hook on all plugins. Called from rows.ts after each row is rendered. @internal */
  _afterRowRender?: (context: AfterRowRenderContext<T>) => void;
  /** Check if any plugin has registered an afterRowRender hook. Used to skip hook call for performance. @internal */
  _hasAfterRowRenderHook?: () => boolean;
  /** Get horizontal scroll boundary offsets from plugins */
  _getHorizontalScrollOffsets?: (
    rowEl?: HTMLElement,
    focusedCell?: HTMLElement,
  ) => { left: number; right: number; skipScroll?: boolean };
  /** Request emission of column-state-change event (debounced) */
  requestStateChange?: () => void;

  // Methods exposed for extracted managers (VirtualizationManager, FocusManager, RowManager, RenderScheduler)
  /** @internal Clear the cached _visibleColumns array so the next read recomputes from _columns. */
  _invalidateVisibleColumnsCache(): void;
  /** @internal */ _renderVisibleRows(start: number, end: number, epoch?: number): void;
  /** @internal */ _updateAriaCounts(totalRows: number, totalCols: number): void;
  /** @internal */ _requestSchedulerPhase(phase: RenderPhase, source: string): void;
  /** @internal */ _rebuildRowIdMap(): void;
  /** @internal */ _emitDataChange(): void;
  /** @internal */ _getPluginRowHeight(row: T, index: number): number | undefined;
  /** @internal */ _adjustPluginVirtualStart(start: number, scrollTop: number, rowHeight: number): number | undefined;
  /** @internal */ _afterPluginRender(): void;
  /** @internal */ _emitPluginEvent(event: string, detail: unknown): void;

  // Scheduler pipeline callbacks
  /** @internal */ _schedulerMergeConfig(): void;
  /** @internal */ _schedulerProcessColumns(): void;
  /** @internal */ _schedulerProcessRows(): void;
  /** @internal */ _schedulerRenderHeader(): void;
  /** @internal */ _schedulerUpdateTemplate(): void;
  /** @internal */ _schedulerAfterRender(): void;
  /** @internal */ readonly _schedulerIsConnected: boolean;

  // Shell controller & config manager support
  /** @internal The render root element for DOM queries. */
  readonly _renderRoot: Element;
  /** @internal Emit a custom event from the grid. */
  _emit(eventName: string, detail: unknown): void;
  /** @internal Get accordion expand/collapse icons from effective config. */
  readonly _accordionIcons: { expand: IconValue; collapse: IconValue };
  /** @internal Shell state for config manager shell merging. */
  readonly _shellState: ShellState;
  /** @internal Clear the row pool and body element. */
  _clearRowPool(): void;
  /** @internal Run grid setup (DOM rebuild). */
  _setup(): void;
  /** @internal Apply animation configuration to host element. */
  _applyAnimationConfig(config: GridConfig): void;
}

/**
 * Grid reference type combining InternalGrid with HTMLElement.
 * Used by extracted managers that need both internal grid state and DOM APIs.
 * @internal
 */
export type GridHost<T = any> = InternalGrid<T> & HTMLElement;
// #endregion

// #region Column Types
/**
 * Built-in primitive column types with automatic formatting and editing support.
 *
 * - `'string'` - Text content, default text input editor
 * - `'number'` - Numeric content, right-aligned, number input editor
 * - `'date'` - Date content, formatted display, date picker editor
 * - `'boolean'` - True/false, rendered as checkbox
 * - `'select'` - Dropdown selection from `options` array
 *
 * @example
 * ```typescript
 * columns: [
 *   { field: 'name', type: 'string' },
 *   { field: 'age', type: 'number' },
 *   { field: 'hireDate', type: 'date' },
 *   { field: 'active', type: 'boolean' },
 *   { field: 'department', type: 'select', options: [
 *     { label: 'Engineering', value: 'eng' },
 *     { label: 'Sales', value: 'sales' },
 *   ]},
 * ]
 * ```
 *
 * @see {@link ColumnType} for custom type support
 * @see {@link TypeDefault} for type-level defaults
 * @since 0.1.1
 */
export type PrimitiveColumnType = 'number' | 'string' | 'date' | 'boolean' | 'select';

/**
 * Column type - built-in primitives or custom type strings.
 *
 * Use built-in types for automatic formatting, or define custom types
 * (e.g., 'currency', 'country') with type-level defaults via `typeDefaults`.
 *
 * @example
 * ```typescript
 * // Built-in types
 * { field: 'name', type: 'string' }
 * { field: 'salary', type: 'number' }
 *
 * // Custom types with defaults
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'salary', type: 'currency' },
 *     { field: 'birthCountry', type: 'country' },
 *   ],
 *   typeDefaults: {
 *     currency: {
 *       format: (v) => `$${Number(v).toFixed(2)}`,
 *     },
 *     country: {
 *       renderer: (ctx) => `🌍 ${ctx.value}`,
 *     },
 *   },
 * };
 * ```
 *
 * @see {@link PrimitiveColumnType} for built-in types
 * @see {@link TypeDefault} for defining custom type defaults
 * @since 1.0.0
 */
export type ColumnType = PrimitiveColumnType | (string & {});
// #endregion

// #region TypeDefault Interface
/**
 * Type-level defaults for formatters and renderers.
 * Applied to all columns of a given type unless overridden at column level.
 *
 * Note: `editor` and `editorParams` are added via module augmentation when
 * EditingPlugin is imported. `filterPanelRenderer` is added by FilteringPlugin.
 *
 * @example
 * ```typescript
 * typeDefaults: {
 *   currency: {
 *     format: (value) => new Intl.NumberFormat('en-US', {
 *       style: 'currency',
 *       currency: 'USD',
 *     }).format(value as number),
 *   },
 *   country: {
 *     renderer: (ctx) => {
 *       const span = document.createElement('span');
 *       span.innerHTML = `<img src="/flags/${ctx.value}.svg" /> ${ctx.value}`;
 *       return span;
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link ColumnViewRenderer} for custom renderer function signature
 * @see {@link ColumnType} for type strings that can have defaults
 * @see {@link GridConfig.typeDefaults} for registering type defaults
 * @since 1.0.0
 */
export interface TypeDefault<TRow = unknown> {
  /**
   * Default formatter for all columns of this type.
   *
   * Transforms the raw cell value into a display string. Use when you need
   * consistent formatting across columns without custom DOM (e.g., currency,
   * percentages, dates with specific locale).
   *
   * **Resolution Priority**: Column `format` → Type `format` → Built-in
   *
   * @example
   * ```typescript
   * typeDefaults: {
   *   currency: {
   *     format: (value) => new Intl.NumberFormat('en-US', {
   *       style: 'currency',
   *       currency: 'USD',
   *     }).format(value as number),
   *   },
   *   percentage: {
   *     format: (value) => `${(value as number * 100).toFixed(1)}%`,
   *   }
   * }
   * ```
   */
  format?: (value: unknown, row: TRow) => string;

  /**
   * Default renderer for all columns of this type.
   *
   * Creates custom DOM for the cell content. Use when you need more than
   * text formatting (e.g., icons, badges, interactive elements).
   *
   * **Resolution Priority**: Column `renderer` → Type `renderer` → App-level (adapter) → Built-in
   *
   * @example
   * ```typescript
   * typeDefaults: {
   *   status: {
   *     renderer: (ctx) => {
   *       const badge = document.createElement('span');
   *       badge.className = `badge badge-${ctx.value}`;
   *       badge.textContent = ctx.value as string;
   *       return badge;
   *     }
   *   },
   *   country: {
   *     renderer: (ctx) => {
   *       const span = document.createElement('span');
   *       span.innerHTML = `<img src="/flags/${ctx.value}.svg" /> ${ctx.value}`;
   *       return span;
   *     }
   *   }
   * }
   * ```
   */
  renderer?: ColumnViewRenderer<TRow, unknown>;
}
// #endregion

// #region BaseColumnConfig Interface
/**
 * Base contract for a column configuration.
 *
 * Defines the fundamental properties all columns share. Extended by {@link ColumnConfig}
 * with additional features like custom renderers and grouping.
 *
 * @example
 * ```typescript
 * // Basic column with common properties
 * const columns: BaseColumnConfig<Employee>[] = [
 *   {
 *     field: 'name',
 *     header: 'Full Name',
 *     sortable: true,
 *     resizable: true,
 *   },
 *   {
 *     field: 'salary',
 *     type: 'number',
 *     width: 120,
 *     format: (value) => `$${value.toLocaleString()}`,
 *     sortComparator: (a, b) => a - b,
 *   },
 *   {
 *     field: 'department',
 *     type: 'select',
 *     options: [
 *       { label: 'Engineering', value: 'eng' },
 *       { label: 'Sales', value: 'sales' },
 *     ],
 *   },
 * ];
 * ```
 *
 * @see {@link ColumnConfig} for full column configuration with renderers
 * @see {@link ColumnType} for type options
 * @since 0.1.1
 */
export interface BaseColumnConfig<TRow = any, TValue = any> {
  /** Unique field key referencing property in row objects */
  field: keyof TRow & string;
  /** Visible header label; defaults to capitalized field */
  header?: string;
  /**
   * Column data type.
   *
   * Built-in types: `'string'`, `'number'`, `'date'`, `'boolean'`, `'select'`
   *
   * Custom types (e.g., `'currency'`, `'country'`) can have type-level defaults
   * via `gridConfig.typeDefaults` or framework adapter registries.
   *
   * @default Inferred from first row data
   */
  type?: ColumnType;
  /** Column width in pixels; fixed size (no flexibility) */
  width?: string | number;
  /** Minimum column width in pixels (stretch mode only); when set, column uses minmax(minWidth, 1fr) */
  minWidth?: number;
  /** Whether column can be sorted */
  sortable?: boolean;
  /** Whether column can be resized by user */
  resizable?: boolean;
  /** Optional custom comparator for sorting (a,b) -> number */
  sortComparator?: (a: TValue, b: TValue, rowA: TRow, rowB: TRow) => number;
  /**
   * Compute the cell's value from the row. When defined, this is the single
   * source of truth used by sorting, filtering, formatting, cell rendering,
   * export, and clipboard — eliminating the need to duplicate value-extraction
   * logic across `sortComparator`, `filterValue`, and per-renderer code.
   *
   * **Resolution precedence**:
   * - **Sort**: `sortComparator` → `valueAccessor` → `row[field]`
   * - **Filter**: `filterValue` → `valueAccessor` → `row[field]`
   * - **Render / format / export / copy**: `valueAccessor` → `row[field]`
   *
   * The accessor is the *default* value source — per-column escape hatches
   * (`sortComparator`, `filterValue`) still take precedence when set.
   *
   * Results are memoized per `(row identity, column field)` so accessors are
   * free to be "slow but correct" (e.g. `array.find(...)`). Immutable row
   * updates auto-invalidate; in-place mutations are invalidated by the grid's
   * edit / transaction paths.
   *
   * Note: a `valueAccessor` without a paired `valueSetter` (planned API)
   * implies the column is read-only — editors will not commit through it.
   *
   * @example
   * ```typescript
   * // Computed value from nested data
   * {
   *   field: 'bolDate',
   *   header: 'BL date',
   *   valueAccessor: ({ row }) => {
   *     if (isCargo(row)) {
   *       return row.movements.find(m => m.operationType === 'LOAD')?.movementDate ?? null;
   *     }
   *     return row.movementDate ?? null;
   *   },
   *   filterType: 'date',
   *   // No need for sortComparator or filterValue — they fall back to the accessor.
   * }
   * ```
   */
  valueAccessor?: (ctx: { row: TRow; column: ColumnConfig<TRow>; rowIndex: number }) => TValue;
  /** For select type - available options */
  options?: Array<{ label: string; value: unknown }> | (() => Array<{ label: string; value: unknown }>);
  /**
   * Formats the raw cell value into a display string.
   *
   * Used both for **cell rendering** and the **built-in filter panel**:
   * - In cells, the formatted value replaces the raw value as text content.
   * - In the filter panel (set filter), checkbox labels show the formatted value
   *   instead of the raw value, and search matches against the formatted text.
   *
   * The `row` parameter is available during cell rendering but is `undefined`
   * when called from the filter panel (standalone value formatting). Avoid
   * accessing `row` properties in format functions intended for filter display.
   *
   * @example
   * ```typescript
   * // Currency formatter — works in both cells and filter panel
   * {
   *   field: 'price',
   *   format: (value) => `$${Number(value).toFixed(2)}`,
   * }
   *
   * // ID-to-name lookup — filter panel shows names, not IDs
   * {
   *   field: 'departmentId',
   *   format: (value) => departmentMap.get(value as string) ?? String(value),
   * }
   * ```
   */
  format?: (value: TValue, row: TRow) => string;
  /**
   * Marks this column as a **system / utility column** — a column that exists to
   * support grid behaviour rather than to display user data.
   *
   * Built-in plugins set this on the columns they synthesize (selection checkbox,
   * row-reorder drag handle, master-detail / tree / row-grouping expander). You can
   * also set it on columns you author yourself when you want them to behave the same
   * way — for example, a row-action menu column, a status indicator, or any
   * developer-defined "system" column that should be visible in the grid only.
   *
   * Setting `utility: true` excludes the column from:
   *
   * - **Visibility panel** — not listed in the show/hide UI
   * - **Column reorder** — header drag-drop and visibility-panel drag treat it as locked
   *   (equivalent to `lockPosition: true`)
   * - **Print** — hidden by `PrintPlugin` during print
   * - **Clipboard copy** — skipped by `ClipboardPlugin`
   * - **Export** (CSV / JSON / Excel) — skipped by `ExportPlugin`
   * - **Range / row selection** — clicks land on the column but selection ignores it
   * - **Filter UI** — no filter button rendered, no filter model entry
   *
   * The column is still rendered in the grid and still receives `cellRenderer` /
   * `viewRenderer` / `headerRenderer` callbacks — it is "hidden from the system,
   * visible in the grid".
   *
   * Convention: name the field with a `__`-prefix (e.g. `__actions`) so it cannot
   * collide with a real data field.
   *
   * @example A custom row-actions column
   * ```ts
   * {
   *   field: '__actions',
   *   header: '',
   *   width: 80,
   *   utility: true,         // excluded from print, export, reorder, visibility, etc.
   *   resizable: false,
   *   sortable: false,
   *   filterable: false,
   *   viewRenderer: ({ row }) => createActionsButton(row),
   * }
   * ```
   */
  utility?: boolean;
  /**
   * Arbitrary extra metadata for application use.
   *
   * @remarks
   * **Do not use `meta` for grid-recognized flags.** Properties like `lockPosition`,
   * `lockVisible`, `lockPinning`, `pinned`, `utility`, and `checkboxColumn` are first-class
   * augmented properties on `ColumnConfig` itself. Using `meta.<flag>` for any of them is
   * deprecated and only kept as a runtime fallback for back-compat.
   */
  meta?: Record<string, unknown>;
}
// #endregion

// #region ColumnConfig Interface
/**
 * Full column configuration including custom renderers, editors, and grouping metadata.
 *
 * Extends {@link BaseColumnConfig} with additional features for customizing
 * how cells are displayed and edited.
 *
 * @example
 * ```typescript
 * const columns: ColumnConfig<Employee>[] = [
 *   // Basic sortable column
 *   { field: 'id', header: 'ID', width: 60, sortable: true },
 *
 *   // Column with custom renderer
 *   {
 *     field: 'name',
 *     header: 'Employee',
 *     renderer: (ctx) => {
 *       const div = document.createElement('div');
 *       div.innerHTML = `<img src="${ctx.row.avatar}" /><span>${ctx.value}</span>`;
 *       return div;
 *     },
 *   },
 *
 *   // Column with custom header
 *   {
 *     field: 'email',
 *     headerLabelRenderer: (ctx) => `${ctx.value} 📧`,
 *   },
 *
 *   // Editable column (requires EditingPlugin)
 *   {
 *     field: 'status',
 *     editable: true,
 *     editor: (ctx) => {
 *       const select = document.createElement('select');
 *       // ... editor implementation
 *       return select;
 *     },
 *   },
 *
 *   // Hidden column (can be shown via VisibilityPlugin)
 *   { field: 'internalNotes', hidden: true },
 * ];
 * ```
 *
 * @see {@link BaseColumnConfig} for basic column properties
 * @see {@link ColumnViewRenderer} for custom cell renderers
 * @see {@link ColumnEditorSpec} for custom cell editors
 * @see {@link HeaderRenderer} for custom header renderers
 * @since 0.1.1
 */
export interface ColumnConfig<TRow = any> extends BaseColumnConfig<TRow, any> {
  /**
   * Optional custom cell renderer function. Alias for `viewRenderer`.
   * Can return an HTMLElement, a Node, or an HTML string (which will be sanitized).
   *
   * @example
   * ```typescript
   * // Simple string template
   * renderer: (ctx) => `<span class="badge">${ctx.value}</span>`
   *
   * // DOM element
   * renderer: (ctx) => {
   *   const el = document.createElement('span');
   *   el.textContent = ctx.value;
   *   return el;
   * }
   * ```
   */
  renderer?: ColumnViewRenderer<TRow, any>;
  /** Optional custom view renderer used instead of default text rendering */
  viewRenderer?: ColumnViewRenderer<TRow, any>;
  /** External view spec (lets host app mount any framework component) */
  externalView?: {
    component: unknown;
    props?: Record<string, unknown>;
    mount?: (options: {
      placeholder: HTMLElement;
      context: CellRenderContext<TRow, unknown>;
      spec: unknown;
    }) => void | { dispose?: () => void };
  };
  /** Whether the column is initially hidden */
  hidden?: boolean;
  /** Prevent this column from being hidden programmatically */
  lockVisible?: boolean;
  /**
   * Dynamic CSS class(es) for cells in this column.
   * Called for each cell during rendering. Return class names to add to the cell element.
   *
   * @example
   * ```typescript
   * // Highlight negative values
   * cellClass: (value, row, column) => value < 0 ? ['negative', 'text-red'] : []
   *
   * // Status-based styling
   * cellClass: (value) => [`status-${value}`]
   *
   * // Single class as string
   * cellClass: (value) => value < 0 ? 'negative' : ''
   * ```
   */
  cellClass?: (value: unknown, row: TRow, column: ColumnConfig<TRow>) => string | string[];

  /**
   * Custom header label renderer. Customize the label content while the grid
   * handles sort icons, filter buttons, resize handles, and click interactions.
   *
   * Use this for simple customizations like adding icons, badges, or units.
   *
   * @example
   * ```typescript
   * // Add required field indicator
   * headerLabelRenderer: (ctx) => `${ctx.value} <span class="required">*</span>`
   *
   * // Add unit to header
   * headerLabelRenderer: (ctx) => {
   *   const span = document.createElement('span');
   *   span.innerHTML = `${ctx.value}<br/><small>(kg)</small>`;
   *   return span;
   * }
   * ```
   */
  headerLabelRenderer?: HeaderLabelRenderer<TRow>;

  /**
   * Custom header cell renderer. Complete control over the entire header cell.
   * Resize handles are added automatically for resizable columns.
   *
   * The context provides helper functions to include standard elements:
   * - `renderSortIcon()` - Returns sort indicator element (null if not sortable)
   * - `renderFilterButton()` - Returns filter button (null if not filterable)
   *
   * **Precedence**: `headerRenderer` > `headerLabelRenderer` > `header` > `field`
   *
   * @example
   * ```typescript
   * headerRenderer: (ctx) => {
   *   const div = document.createElement('div');
   *   div.className = 'custom-header';
   *   div.innerHTML = `<span>${ctx.value}</span>`;
   *   const sortIcon = ctx.renderSortIcon();
   *   if (sortIcon) div.appendChild(sortIcon);
   *   return div;
   * }
   * ```
   */
  headerRenderer?: HeaderRenderer<TRow>;
}
// #endregion

// #region ColumnConfigMap Type
/**
 * Array of column configurations.
 * Convenience type alias for `ColumnConfig<TRow>[]`.
 *
 * @example
 * ```typescript
 * const columns: ColumnConfigMap<Employee> = [
 *   { field: 'name', header: 'Full Name', sortable: true },
 *   { field: 'email', header: 'Email Address' },
 *   { field: 'department', type: 'select', options: deptOptions },
 * ];
 *
 * grid.columns = columns;
 * ```
 *
 * @see {@link ColumnConfig} for individual column options
 * @see {@link GridConfig.columns} for setting columns on the grid
 * @since 0.1.1
 */
export type ColumnConfigMap<TRow = any> = ColumnConfig<TRow>[];
// #endregion

// #region Editor Types
/**
 * Editor specification for inline cell editing.
 * Supports multiple formats for maximum flexibility.
 *
 * **Format Options:**
 * - `string` - Custom element tag name (e.g., 'my-date-picker')
 * - `function` - Factory function returning an editor element
 * - `object` - External component spec for framework integration
 *
 * @example
 * ```typescript
 * // 1. Custom element tag name
 * columns: [
 *   { field: 'date', editor: 'my-date-picker' }
 * ]
 *
 * // 2. Factory function (full control)
 * columns: [
 *   {
 *     field: 'status',
 *     editor: (ctx) => {
 *       const select = document.createElement('select');
 *       select.innerHTML = `
 *         <option value="active">Active</option>
 *         <option value="inactive">Inactive</option>
 *       `;
 *       select.value = ctx.value;
 *       select.onchange = () => ctx.commit(select.value);
 *       select.onkeydown = (e) => {
 *         if (e.key === 'Escape') ctx.cancel();
 *       };
 *       return select;
 *     }
 *   }
 * ]
 *
 * // 3. External component (React, Angular, Vue)
 * columns: [
 *   {
 *     field: 'country',
 *     editor: {
 *       component: CountrySelect,
 *       props: { showFlags: true }
 *     }
 *   }
 * ]
 * ```
 *
 * @see {@link ColumnEditorContext} for the context passed to factory functions
 * @since 0.1.1
 */
export type ColumnEditorSpec<TRow = unknown, TValue = unknown> =
  | string // custom element tag name
  | ((context: ColumnEditorContext<TRow, TValue>) => HTMLElement | string)
  | {
      /** Arbitrary component reference (class, function, token) */
      component: unknown;
      /** Optional static props passed to mount */
      props?: Record<string, unknown>;
      /** Optional custom mount function; if provided we call it directly instead of emitting an event */
      mount?: (options: {
        placeholder: HTMLElement;
        context: ColumnEditorContext<TRow, TValue>;
        spec: unknown;
      }) => void | { dispose?: () => void };
    };

/**
 * Context object provided to editor factories allowing mutation (commit/cancel) of a cell value.
 *
 * The `commit` and `cancel` functions control the editing lifecycle:
 * - Call `commit(newValue)` to save changes and exit edit mode
 * - Call `cancel()` to discard changes and exit edit mode
 *
 * @example
 * ```typescript
 * const myEditor: ColumnEditorSpec = (ctx: ColumnEditorContext) => {
 *   const input = document.createElement('input');
 *   input.value = ctx.value;
 *   input.className = 'my-editor';
 *
 *   // Save on Enter, cancel on Escape
 *   input.onkeydown = (e) => {
 *     if (e.key === 'Enter') {
 *       ctx.commit(input.value);
 *     } else if (e.key === 'Escape') {
 *       ctx.cancel();
 *     }
 *   };
 *
 *   // Access row data for validation
 *   if (ctx.row.locked) {
 *     input.disabled = true;
 *   }
 *
 *   return input;
 * };
 * ```
 *
 * @see {@link ColumnEditorSpec} for editor specification options
 * @since 0.1.1
 */
export interface ColumnEditorContext<TRow = any, TValue = any> {
  /** Underlying full row object for the active edit. */
  row: TRow;
  /** Current cell value (mutable only via commit). */
  value: TValue;
  /** Field name being edited. */
  field: keyof TRow & string;
  /** Column configuration reference. */
  column: ColumnConfig<TRow>;
  /**
   * Stable row identifier (from `getRowId`).
   * Empty string if no `getRowId` is configured.
   */
  rowId: string;
  /** Accept the edit; triggers change tracking + rerender. */
  commit: (newValue: TValue) => void;
  /** Abort edit without persisting changes. */
  cancel: () => void;
  /**
   * Update other fields in this row while the editor is open.
   * Changes are committed with source `'cascade'`, triggering
   * `cell-change` events and `onValueChange` pushes to sibling editors.
   *
   * Useful for editors that affect multiple fields (e.g., an address
   * lookup that sets city + zip + state).
   *
   * @example
   * ```typescript
   * // In a cell-commit listener:
   * grid.on('cell-commit', (detail) => {
   *   if (detail.field === 'quantity') {
   *     detail.updateRow({ total: detail.row.price * detail.value });
   *   }
   * });
   * ```
   */
  updateRow: (changes: Partial<TRow>) => void;
  /**
   * Register a callback invoked when the cell's underlying value changes
   * while the editor is open (e.g., via `updateRow()` from another cell's commit).
   *
   * Built-in editors auto-update their input values. Custom/framework editors
   * should use this to stay in sync with external mutations.
   *
   * @example
   * ```typescript
   * const editor = (ctx: ColumnEditorContext) => {
   *   const input = document.createElement('input');
   *   input.value = String(ctx.value);
   *   ctx.onValueChange?.((newValue) => {
   *     input.value = String(newValue);
   *   });
   *   return input;
   * };
   * ```
   */
  onValueChange?: (callback: (newValue: TValue) => void) => void;
  /**
   * The grid element that owns this editor.
   *
   * Use to access public grid API from custom editors — e.g.
   * `grid.registerExternalFocusContainer(panel)` so the grid treats focus
   * inside a portal-rendered overlay (Autocomplete, date picker, color
   * picker) as "still inside the editor" and does not exit row edit on
   * click. Mirrors {@link CellRenderContext.grid} for renderers.
   *
   * Always populated when the editor is mounted via the grid's editing
   * pipeline. Optional in the type for backwards compatibility with
   * factory functions written against the original signature.
   *
   * @example
   * ```typescript
   * const editor: ColumnEditorSpec = (ctx: ColumnEditorContext) => {
   *   const panel = document.createElement('div');
   *   document.body.appendChild(panel);
   *   ctx.grid?.registerExternalFocusContainer(panel);
   *   // ...
   * };
   * ```
   *
   * @see {@link CellRenderContext.grid}
   */
  grid?: PublicGrid<TRow> & HTMLElement;
}
// #endregion

// #region Renderer Types
/**
 * Context passed to custom view renderers (pure display – no commit helpers).
 *
 * Used by `viewRenderer` and `renderer` column properties to create
 * custom cell content. Return a DOM node or HTML string.
 *
 * @example
 * ```typescript
 * // Status badge renderer
 * const statusRenderer: ColumnViewRenderer = (ctx: CellRenderContext) => {
 *   const badge = document.createElement('span');
 *   badge.className = `badge badge-${ctx.value}`;
 *   badge.textContent = ctx.value;
 *   return badge;
 * };
 *
 * // Progress bar using row data
 * const progressRenderer: ColumnViewRenderer = (ctx) => {
 *   const bar = document.createElement('div');
 *   bar.className = 'progress-bar';
 *   bar.style.width = `${ctx.value}%`;
 *   bar.title = `${ctx.row.taskName}: ${ctx.value}%`;
 *   return bar;
 * };
 *
 * // Return HTML string (simpler, less performant)
 * const htmlRenderer: ColumnViewRenderer = (ctx) => {
 *   return `<strong>${ctx.value}</strong>`;
 * };
 * ```
 *
 * @see {@link ColumnViewRenderer} for the renderer function signature
 * @since 0.1.1
 */
export interface CellRenderContext<TRow = any, TValue = any> {
  /** Row object for the cell being rendered. */
  row: TRow;
  /** Value at field. */
  value: TValue;
  /** Field key. */
  field: keyof TRow & string;
  /** Column configuration reference. */
  column: ColumnConfig<TRow>;
  /**
   * The grid element that owns this cell.
   * Use to access public grid API (e.g., `getPluginByName()`) from custom renderers.
   *
   * @example
   * ```typescript
   * const renderer: ColumnViewRenderer<MyRow> = (ctx) => {
   *   const tree = ctx.grid?.getPluginByName('tree');
   *   // ...
   * };
   * ```
   */
  grid?: PublicGrid<TRow> & HTMLElement;
  /**
   * The cell DOM element being rendered into.
   * Framework adapters can use this to cache per-cell state (e.g., React roots).
   * @internal
   */
  cellEl?: HTMLElement;
}

/**
 * Custom view renderer function for cell content.
 *
 * Returns one of:
 * - `Node` - DOM element to display in the cell
 * - `string` - HTML string (parsed and inserted)
 * - `void | null` - Use default text rendering
 *
 * @example
 * ```typescript
 * // DOM element (recommended for interactivity)
 * const avatarRenderer: ColumnViewRenderer<Employee> = (ctx) => {
 *   const img = document.createElement('img');
 *   img.src = ctx.row.avatarUrl;
 *   img.alt = ctx.row.name;
 *   img.className = 'avatar';
 *   return img;
 * };
 *
 * // HTML string (simpler, good for static content)
 * const emailRenderer: ColumnViewRenderer = (ctx) => {
 *   return `<a href="mailto:${ctx.value}">${ctx.value}</a>`;
 * };
 *
 * // Conditional rendering
 * const conditionalRenderer: ColumnViewRenderer = (ctx) => {
 *   if (!ctx.value) return null; // Use default
 *   return `<em>${ctx.value}</em>`;
 * };
 * ```
 *
 * @see {@link CellRenderContext} for available context properties
 * @since 0.1.1
 */
export type ColumnViewRenderer<TRow = unknown, TValue = unknown> = (
  ctx: CellRenderContext<TRow, TValue>,
) => Node | string | void | null;
// #endregion

// #region Header Renderer Types
/**
 * Context passed to `headerLabelRenderer` for customizing header label content.
 * The framework handles sort icons, filter buttons, resize handles, and click interactions.
 *
 * @example
 * ```typescript
 * headerLabelRenderer: (ctx) => {
 *   const span = document.createElement('span');
 *   span.innerHTML = `${ctx.value} <span class="required">*</span>`;
 *   return span;
 * }
 * ```
 * @since 1.4.0
 */
export interface HeaderLabelContext<TRow = unknown> {
  /** Column configuration reference. */
  column: ColumnConfig<TRow>;
  /** The header text (from column.header or column.field). */
  value: string;
}

/**
 * Context passed to `headerRenderer` for complete control over header cell content.
 * When using this, you control the header content. Resize handles are added automatically
 * for resizable columns.
 *
 * @example
 * ```typescript
 * headerRenderer: (ctx) => {
 *   const div = document.createElement('div');
 *   div.className = 'custom-header';
 *   div.innerHTML = `<span>${ctx.value}</span>`;
 *   // Optionally include sort icon
 *   const sortIcon = ctx.renderSortIcon();
 *   if (sortIcon) div.appendChild(sortIcon);
 *   return div;
 * }
 * ```
 * @since 1.4.0
 */
export interface HeaderCellContext<TRow = unknown> {
  /** Column configuration reference. */
  column: ColumnConfig<TRow>;
  /** The header text (from column.header or column.field). */
  value: string;
  /** Current sort state for this column. */
  sortState: 'asc' | 'desc' | null;
  /** Whether the column has an active filter. */
  filterActive: boolean;
  /** The header cell DOM element being rendered into. */
  cellEl: HTMLElement;
  /**
   * Render the standard sort indicator icon.
   * Returns null if column is not sortable.
   */
  renderSortIcon: () => HTMLElement | null;
  /**
   * Render the standard filter button.
   * Returns null if FilteringPlugin is not active or column is not filterable.
   * Note: The actual button is added by FilteringPlugin's afterRender hook.
   */
  renderFilterButton: () => HTMLElement | null;
}

/**
 * Header label renderer function type.
 * Customize the label while framework handles sort icons, filter buttons, resize handles.
 *
 * Use this for simple label customizations without taking over the entire header.
 * The grid automatically appends sort icons, filter buttons, and resize handles.
 *
 * @example
 * ```typescript
 * // Add required indicator
 * const requiredHeader: HeaderLabelRenderer = (ctx) => {
 *   return `${ctx.value} <span style="color: red;">*</span>`;
 * };
 *
 * // Add unit suffix
 * const priceHeader: HeaderLabelRenderer = (ctx) => {
 *   const span = document.createElement('span');
 *   span.innerHTML = `${ctx.value} <small>(USD)</small>`;
 *   return span;
 * };
 *
 * // Column config usage
 * columns: [
 *   { field: 'name', headerLabelRenderer: requiredHeader },
 *   { field: 'price', headerLabelRenderer: priceHeader },
 * ]
 * ```
 *
 * @see {@link HeaderLabelContext} for context properties
 * @see {@link HeaderRenderer} for full header control
 * @since 1.4.0
 */
export type HeaderLabelRenderer<TRow = unknown> = (ctx: HeaderLabelContext<TRow>) => Node | string | void | null;

/**
 * Header cell renderer function type.
 * Full control over header cell content. User is responsible for all content and interactions.
 *
 * When using this, you have complete control but must manually include
 * sort icons, filter buttons, and resize handles using the helper functions.
 *
 * @example
 * ```typescript
 * // Custom header with all standard elements
 * const customHeader: HeaderRenderer = (ctx) => {
 *   const div = document.createElement('div');
 *   div.className = 'custom-header';
 *   div.innerHTML = `<span class="label">${ctx.value}</span>`;
 *
 *   // Add sort icon (returns null if not sortable)
 *   const sortIcon = ctx.renderSortIcon();
 *   if (sortIcon) div.appendChild(sortIcon);
 *
 *   // Add filter button (returns null if not filterable)
 *   const filterBtn = ctx.renderFilterButton();
 *   if (filterBtn) div.appendChild(filterBtn);
 *
 *   // Resize handles are added automatically for resizable columns
 *   return div;
 * };
 *
 * // Minimal header (no sort/resize)
 * const minimalHeader: HeaderRenderer = (ctx) => {
 *   return `<div class="minimal">${ctx.value}</div>`;
 * };
 *
 * // Column config usage
 * columns: [
 *   { field: 'name', headerRenderer: customHeader },
 * ]
 * ```
 *
 * @see {@link HeaderCellContext} for context properties and helper functions
 * @see {@link HeaderLabelRenderer} for simpler label-only customization
 * @since 1.4.0
 */
export type HeaderRenderer<TRow = unknown> = (ctx: HeaderCellContext<TRow>) => Node | string | void | null;
// #endregion

// #region Framework Adapter Interface
/**
 * Framework adapter interface for handling framework-specific component instantiation.
 * Allows framework libraries (Angular, React, Vue) to register handlers that convert
 * declarative light DOM elements into functional renderers/editors.
 *
 * @example
 * ```typescript
 * // In @toolbox-web/grid-angular
 * class AngularGridAdapter implements FrameworkAdapter {
 *   canHandle(element: HTMLElement): boolean {
 *     return element.tagName.startsWith('APP-');
 *   }
 *   createRenderer(element: HTMLElement): ColumnViewRenderer {
 *     return (ctx) => {
 *       // Angular-specific instantiation logic
 *       const componentRef = createComponent(...);
 *       componentRef.setInput('value', ctx.value);
 *       return componentRef.location.nativeElement;
 *     };
 *   }
 *   createEditor(element: HTMLElement): ColumnEditorSpec {
 *     return (ctx) => {
 *       // Angular-specific editor with commit/cancel
 *       const componentRef = createComponent(...);
 *       componentRef.setInput('value', ctx.value);
 *       // Subscribe to commit/cancel outputs
 *       return componentRef.location.nativeElement;
 *     };
 *   }
 * }
 *
 * // User registers adapter once in their app
 * GridElement.registerAdapter(new AngularGridAdapter(injector, appRef));
 * ```
 * @category Framework Adapters
 * @since 0.2.9
 */
export interface FrameworkAdapter {
  /**
   * Determines if this adapter can handle the given element.
   * Typically checks tag name, attributes, or other conventions.
   */
  canHandle(element: HTMLElement): boolean;

  /**
   * Creates a view renderer function from a light DOM element.
   * The renderer receives cell context and returns DOM or string.
   * Returns undefined if no renderer template is registered, allowing the grid
   * to use its default rendering.
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue> | undefined;

  /**
   * Creates an editor spec from a light DOM element.
   * The editor receives context with commit/cancel and returns DOM.
   * Returns undefined if no editor template is registered, allowing the grid
   * to use its default built-in editors.
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue> | undefined;

  /**
   * Creates a tool panel renderer from a light DOM element.
   * The renderer receives a container element and optionally returns a cleanup function.
   */
  createToolPanelRenderer?(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined;

  /**
   * Gets type-level defaults from an application-level registry.
   * Used by Angular's `GridTypeRegistry` and React's `GridTypeProvider`.
   *
   * @param type - The column type (e.g., 'date', 'currency', 'country')
   * @param gridEl - The owning `<tbw-grid>` element. Helps adapters resolve
   *   the correct context provider in multi-grid scenarios.
   * @returns Type defaults for renderer/editor, or undefined if not registered
   */
  getTypeDefault?<TRow = unknown>(type: string, gridEl?: HTMLElement): TypeDefault<TRow> | undefined;

  /**
   * Pre-process a grid config before the grid core applies it.
   * Framework adapters use this to convert framework-specific component references
   * (Angular classes, Vue components, React elements) to DOM-returning functions.
   *
   * Called automatically by the grid's `set gridConfig` setter when a
   * `__frameworkAdapter` is present on the grid instance.
   *
   * Must be **idempotent** — already-processed configs must pass through safely.
   *
   * @param config - The raw grid config (may contain framework-specific values)
   * @returns Processed config with DOM-returning functions
   */
  processConfig?<TRow = unknown>(config: GridConfig<TRow>): GridConfig<TRow>;

  /**
   * Called when a cell's content is about to be wiped (e.g., when exiting edit mode,
   * scroll-recycling a row, or rebuilding a row).
   *
   * Framework adapters should use this to properly destroy cached views/components
   * associated with the cell to prevent memory leaks.
   *
   * @param cellEl - The cell element whose content is being released
   */
  releaseCell?(cellEl: HTMLElement): void;

  /**
   * Unmount a specific framework container and free its resources.
   *
   * Called by the grid core (e.g., MasterDetailPlugin) when a container
   * created by the adapter is about to be removed from the DOM.
   * The adapter should destroy the associated framework instance
   * (React root, Vue app, Angular view) and remove it from tracking arrays.
   *
   * @param container - The container element returned by a create* method
   */
  unmount?(container: HTMLElement): void;

  /**
   * Parse a `<tbw-grid-detail>` element and return a detail renderer function.
   * Used by MasterDetailPlugin to support framework-specific detail templates.
   */
  parseDetailElement?<TRow = unknown>(
    element: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement | string) | undefined;

  /**
   * Parse a `<tbw-grid-responsive-card>` element and return a card renderer function.
   * Used by ResponsivePlugin to support framework-specific card templates.
   */
  parseResponsiveCardElement?<TRow = unknown>(
    element: Element,
  ): ((row: TRow, rowIndex: number) => HTMLElement) | undefined;
}
// #endregion

// #region Internal Types

/**
 * Column internal properties used during light DOM parsing.
 * Stores attribute-based names before they're resolved to actual functions.
 * @internal
 */
export interface ColumnParsedAttributes {
  /** Editor name from `editor` attribute (resolved later) */
  __editorName?: string;
  /** Renderer name from `renderer` attribute (resolved later) */
  __rendererName?: string;
}

/**
 * Extended column config used internally.
 * Includes all internal properties needed during grid lifecycle.
 *
 * Plugin developers may need to access these when working with
 * column caching and compiled templates.
 *
 * @example
 * ```typescript
 * import type { ColumnInternal } from '@toolbox-web/grid';
 *
 * class MyPlugin extends BaseGridPlugin {
 *   afterRender(): void {
 *     // Access internal column properties
 *     const columns = this.columns as ColumnInternal[];
 *     for (const col of columns) {
 *       // Check if column was auto-sized
 *       if (col.__autoSized) {
 *         console.log(`${col.field} was auto-sized`);
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link ColumnConfig} for public column properties
 * @category Plugin Development
 * @internal
 * @since 0.1.1
 */
export interface ColumnInternal<T = any> extends ColumnConfig<T>, ColumnParsedAttributes {
  __autoSized?: boolean;
  __userResized?: boolean;
  __renderedWidth?: number;
  /** Original configured width (for reset on double-click) */
  __originalWidth?: number;
  __viewTemplate?: HTMLElement;
  __editorTemplate?: HTMLElement;
  __headerTemplate?: HTMLElement;
  __compiledView?: CompiledViewFunction<T>;
  __compiledEditor?: (ctx: EditorExecContext<T>) => string;
}

/**
 * Row element with internal tracking properties.
 * Used during virtualization and row pooling.
 *
 * @category Plugin Development
 * @internal
 * @since 0.4.0
 */
export interface RowElementInternal extends HTMLElement {
  /** Epoch marker for row render invalidation */
  __epoch?: number;
  /** Reference to the row data object for change detection */
  __rowDataRef?: unknown;
  /** Count of cells currently in edit mode */
  __editingCellCount?: number;
  /** Flag indicating this is a custom-rendered row (group row, etc.) */
  __isCustomRow?: boolean;
}

/**
 * Type-safe access to element.part API (DOMTokenList-like).
 * Used for CSS ::part styling support.
 * @internal
 */
export interface ElementWithPart {
  part?: DOMTokenList;
}

/**
 * Compiled view function type with optional blocked flag.
 * The __blocked flag is set when a template contains unsafe expressions.
 *
 * @category Plugin Development
 * @internal
 * @since 0.4.0
 */
export interface CompiledViewFunction<T = any> {
  (ctx: CellContext<T>): string;
  /** Set to true when template was blocked due to unsafe expressions */
  __blocked?: boolean;
}

/**
 * Runtime cell context used internally for compiled template execution.
 *
 * Contains the minimal context needed to render a cell: the row data,
 * cell value, field name, and column configuration.
 *
 * @example
 * ```typescript
 * import type { CellContext, ColumnInternal } from '@toolbox-web/grid';
 *
 * // Used internally by compiled templates
 * const renderCell = (ctx: CellContext) => {
 *   return `<span title="${ctx.field}">${ctx.value}</span>`;
 * };
 * ```
 *
 * @see {@link CellRenderContext} for public cell render context
 * @see {@link EditorExecContext} for editor context with commit/cancel
 * @category Plugin Development
 * @since 0.1.1
 */
export interface CellContext<T = any> {
  row: T;
  value: unknown;
  field: string;
  column: ColumnInternal<T>;
}

/**
 * Internal editor execution context extending the generic cell context with commit helpers.
 *
 * Used internally by the editing system. For public editor APIs,
 * prefer using {@link ColumnEditorContext}.
 *
 * @example
 * ```typescript
 * import type { EditorExecContext } from '@toolbox-web/grid';
 *
 * // Internal editor template execution
 * const execEditor = (ctx: EditorExecContext) => {
 *   const input = document.createElement('input');
 *   input.value = String(ctx.value);
 *   input.onkeydown = (e) => {
 *     if (e.key === 'Enter') ctx.commit(input.value);
 *     if (e.key === 'Escape') ctx.cancel();
 *   };
 *   return input;
 * };
 * ```
 *
 * @see {@link ColumnEditorContext} for public editor context
 * @see {@link CellContext} for base cell context
 * @category Plugin Development
 * @since 0.1.1
 */
export interface EditorExecContext<T = any> extends CellContext<T> {
  commit: (newValue: unknown) => void;
  cancel: () => void;
}

/**
 * Controller managing drag-based column resize lifecycle.
 *
 * Exposed internally for plugins that need to interact with resize behavior.
 *
 * @example
 * ```typescript
 * import type { ResizeController, InternalGrid } from '@toolbox-web/grid';
 *
 * class MyPlugin extends BaseGridPlugin {
 *   handleColumnAction(colIndex: number): void {
 *     const grid = this.grid as InternalGrid;
 *     const resizeCtrl = grid._resizeController;
 *
 *     // Check if resize is in progress
 *     if (resizeCtrl?.isResizing) {
 *       return; // Don't interfere
 *     }
 *
 *     // Reset column to configured width
 *     resizeCtrl?.resetColumn(colIndex);
 *   }
 * }
 * ```
 *
 * @see {@link ColumnResizeDetail} for resize event details
 * @category Plugin Development
 * @since 0.1.1
 */
export interface ResizeController {
  start: (e: MouseEvent, colIndex: number, cell: HTMLElement) => void;
  /** Reset a column to its configured width (or auto-size if none configured). */
  resetColumn: (colIndex: number) => void;
  dispose: () => void;
  /** True while a resize drag is in progress (used to suppress header click/sort). */
  isResizing: boolean;
}

/**
 * Virtual window bookkeeping; modified in-place as scroll position changes.
 *
 * Tracks virtualization state for row rendering. The grid only renders
 * rows within the visible viewport window (start to end) plus overscan.
 *
 * @example
 * ```typescript
 * import type { VirtualState, InternalGrid } from '@toolbox-web/grid';
 *
 * class MyPlugin extends BaseGridPlugin {
 *   logVirtualWindow(): void {
 *     const grid = this.grid as InternalGrid;
 *     const vs = grid.virtualization;
 *
 *     console.log(`Row height: ${vs.rowHeight}px`);
 *     console.log(`Visible rows: ${vs.start} to ${vs.end}`);
 *     console.log(`Virtualization: ${vs.enabled ? 'on' : 'off'}`);
 *   }
 * }
 * ```
 *
 * @see {@link GridConfig.rowHeight} for configuring row height
 * @category Plugin Development
 * @since 0.1.1
 */
export interface VirtualState {
  enabled: boolean;
  rowHeight: number;
  /** Threshold for bypassing virtualization (renders all rows if totalRows <= bypassThreshold) */
  bypassThreshold: number;
  start: number;
  end: number;
  /** Faux scrollbar element that provides scroll events (AG Grid pattern) */
  container: HTMLElement | null;
  /** Rows viewport element for measuring visible area height */
  viewportEl: HTMLElement | null;
  /** Spacer element inside faux scrollbar for setting virtual height */
  totalHeightEl: HTMLElement | null;

  // --- Variable Row Height Support (Phase 1) ---

  /**
   * Position cache for variable row heights.
   * Index-based array mapping row index → {offset, height, measured}.
   * Rebuilt when row count changes (expand/collapse, filter).
   * `null` when using uniform row heights (default).
   */
  positionCache: RowPositionEntry[] | null;

  /**
   * Height cache by row identity.
   * Persists row heights across position cache rebuilds.
   * Uses dual storage: Map for string keys (rowId, __rowCacheKey) and WeakMap for object refs.
   */
  heightCache: {
    /** Heights keyed by string (synthetic rows with __rowCacheKey, or rowId-keyed rows) */
    byKey: Map<string, number>;
    /** Heights keyed by object reference (data rows without rowId) */
    byRef: WeakMap<object, number>;
  };

  /** Running average of measured row heights. Used for estimating unmeasured rows. */
  averageHeight: number;

  /** Number of rows that have been measured. */
  measuredCount: number;

  /** Whether variable row height mode is active (rowHeight is a function). */
  variableHeights: boolean;

  // --- Cached Geometry (avoid forced layout reads on scroll hot path) ---

  /** Cached viewport element height. Updated by ResizeObserver and force-refresh only. */
  cachedViewportHeight: number;

  /** Cached faux scrollbar element height. Updated alongside viewport height. */
  cachedFauxHeight: number;

  /** Cached scroll-area element height. Updated alongside viewport/faux heights. */
  cachedScrollAreaHeight: number;

  /** Cached reference to .tbw-scroll-area element. Set during scroll listener setup. */
  scrollAreaEl: HTMLElement | null;
}

// RowElementInternal is now defined earlier in the file with all internal properties

/**
 * Union type for input-like elements that have a `value` property.
 * Covers standard form elements and custom elements with value semantics.
 *
 * @category Plugin Development
 * @internal
 * @since 0.4.0
 */
export type InputLikeElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | { value: unknown };
// #endregion

// #region Grouping & Footer Public Types
/**
 * Group row rendering customization options.
 * Controls how group header rows are displayed in the GroupingRowsPlugin.
 *
 * @example
 * ```typescript
 * import { GroupingRowsPlugin } from '@toolbox-web/grid/all';
 *
 * new GroupingRowsPlugin({
 *   groupOn: (row) => [row.department, row.team],
 *   render: {
 *     // Group row spans all columns
 *     fullWidth: true,
 *
 *     // Custom label format
 *     formatLabel: (value, depth, key) => {
 *       if (depth === 0) return `Department: ${value}`;
 *       return `Team: ${value}`;
 *     },
 *
 *     // Show aggregates in group rows (when not fullWidth)
 *     aggregators: {
 *       salary: 'sum',
 *       age: 'avg',
 *     },
 *
 *     // Custom CSS class
 *     class: 'my-group-row',
 *   },
 * });
 * ```
 *
 * @see {@link AggregatorRef} for aggregation options
 * @since 0.1.1
 */
export interface RowGroupRenderConfig {
  /** If true, group rows span all columns (single full-width cell). Default false. */
  fullWidth?: boolean;
  /** Optional label formatter override. Receives raw group value + depth. */
  formatLabel?: (value: unknown, depth: number, key: string) => string;
  /** Optional aggregate overrides per field for group summary cells (only when not fullWidth). */
  aggregators?: Record<string, AggregatorRef>;
  /** Additional CSS class applied to each group row root element. */
  class?: string;
}

/**
 * Reference to an aggregation function for footer/group summaries.
 *
 * Can be either:
 * - A built-in aggregator name: `'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`
 * - A custom function that calculates the aggregate value
 *
 * Aggregators are not declared on a column directly — they are configured per
 * field on the consumer (e.g. {@link RowGroupRenderConfig.aggregators} for
 * group rows, keyed by column field name).
 *
 * @example
 * ```typescript
 * // Built-in aggregator on a group row config
 * { aggregators: { amount: 'sum' } }
 *
 * // Custom aggregator function
 * {
 *   aggregators: {
 *     price: (rows, field) => {
 *       const values = rows.map((r) => (r as any)[field]).filter((v) => v != null);
 *       return values.length ? Math.max(...values as number[]) : null;
 *     },
 *   },
 * }
 * ```
 *
 * @see {@link RowGroupRenderConfig} for using aggregators in group rows
 * @since 0.1.1
 */
export type AggregatorRef = string | ((rows: unknown[], field: string, column?: unknown) => unknown);

/**
 * Result of automatic column inference from sample rows.
 *
 * When no columns are configured, the grid analyzes the first row of data
 * to automatically generate column definitions with inferred types.
 *
 * @example
 * ```typescript
 * // Automatic inference (no columns configured)
 * grid.rows = [
 *   { name: 'Alice', age: 30, active: true, hireDate: new Date() },
 * ];
 * // Grid infers:
 * // - name: type 'string'
 * // - age: type 'number'
 * // - active: type 'boolean'
 * // - hireDate: type 'date'
 *
 * // Access inferred result programmatically
 * const config = await grid.getConfig();
 * console.log(config.columns); // Inferred columns
 * ```
 *
 * @see {@link ColumnConfig} for column configuration options
 * @see {@link ColumnType} for type inference rules
 * @since 0.1.1
 */
export interface InferredColumnResult<TRow = unknown> {
  /** Generated column configurations based on data analysis */
  columns: ColumnConfigMap<TRow>;
  /** Map of field names to their inferred types */
  typeMap: Record<string, ColumnType>;
}

/**
 * Column sizing mode.
 *
 * - `'fixed'` - Columns use their configured widths. Horizontal scrolling if content overflows.
 * - `'stretch'` - Columns stretch proportionally to fill available width. No horizontal scrolling.
 *
 * @example
 * ```typescript
 * // Fixed widths - good for many columns
 * grid.fitMode = 'fixed';
 *
 * // Stretch to fill - good for few columns
 * grid.fitMode = 'stretch';
 *
 * // Via gridConfig
 * grid.gridConfig = { fitMode: 'stretch' };
 * ```
 * @since 0.1.1
 */
export const FitModeEnum = {
  STRETCH: 'stretch',
  FIXED: 'fixed',
} as const;
/**
 * Column sizing mode — determines how columns fill the available grid width.
 * Use `FitModeEnum` to access individual values by key.
 * @since 0.1.1
 */
export type FitMode = (typeof FitModeEnum)[keyof typeof FitModeEnum];
// #endregion

// #region Plugin Interface
/**
 * Minimal plugin interface for type-checking.
 * This interface is defined here to avoid circular imports with BaseGridPlugin.
 * All plugins must satisfy this shape (BaseGridPlugin implements it).
 *
 * @example
 * ```typescript
 * // Using plugins in grid config
 * import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';
 *
 * grid.gridConfig = {
 *   plugins: [
 *     new SelectionPlugin({ mode: 'row' }),
 *     new FilteringPlugin({ debounceMs: 200 }),
 *   ],
 * };
 *
 * // Accessing plugin instance at runtime (preferred)
 * const selection = grid.getPluginByName('selection');
 * if (selection) {
 *   selection.selectAll();
 * }
 * ```
 *
 * @category Plugin Development
 * @since 0.2.3
 */
export interface GridPlugin {
  /** Unique plugin identifier */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** CSS styles to inject into the grid */
  readonly styles?: string;
}

/**
 * Plugin name-to-type registry for type-safe `getPluginByName()`.
 *
 * Plugins augment this interface via `declare module` so that
 * `grid.getPluginByName('editing')` returns `EditingPlugin | undefined`
 * instead of `GridPlugin | undefined`.
 *
 * @example
 * ```typescript
 * // Plugin augmentation (done automatically when you import a plugin):
 * declare module '../../core/types' {
 *   interface PluginNameMap {
 *     editing: EditingPlugin;
 *   }
 * }
 *
 * // Consumer usage — fully typed:
 * const editing = grid.getPluginByName('editing');
 * editing?.beginBulkEdit(0); // ✅ No cast needed
 * ```
 *
 * @category Plugin Development
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface
export interface PluginNameMap {}
// #endregion

// #region Feature Config
/**
 * Declarative feature configuration interface.
 *
 * This interface is intentionally empty in core — it is populated via **module augmentation**
 * by feature side-effect imports (`@toolbox-web/grid/features/selection`, etc.).
 * Third-party plugins can also augment this interface to add their own features.
 *
 * @example
 * ```ts
 * // Each feature import augments this interface:
 * import '@toolbox-web/grid/features/selection';
 * import '@toolbox-web/grid/features/filtering';
 *
 * grid.gridConfig = {
 *   features: {
 *     selection: 'range',       // ← typed by selection feature module
 *     filtering: { debounceMs: 200 }, // ← typed by filtering feature module
 *   },
 * };
 * ```
 *
 * @example Third-party augmentation
 * ```ts
 * declare module '@toolbox-web/grid' {
 *   interface FeatureConfig {
 *     sparkline?: boolean | SparklineConfig;
 *   }
 * }
 * ```
 * @since 1.24.0
 */
export interface FeatureConfig<TRow = unknown> {
  /**
   * @internal Sentinel property that makes the interface non-empty so TypeScript's
   * excess-property checking rejects unknown feature keys in object literals.
   * Not assignable at runtime (type is `never`).
   */
  __brand?: never;
}
// #endregion

// #region Accessibility Config

/**
 * Default announcement messages for screen reader live regions.
 * Each function returns a localized string for a specific state change.
 * Override individual messages via {@link A11yConfig.messages} for i18n.
 *
 * @group Accessibility
 * @since 2.0.0
 */
export interface A11yMessages {
  /** Announced when sorting is applied. */
  sortApplied: (column: string, direction: string) => string;
  /** Announced when sorting is cleared. */
  sortCleared: () => string;
  /** Announced when a filter is applied. */
  filterApplied: (column: string) => string;
  /** Announced when a filter is cleared from a column. */
  filterCleared: (column: string) => string;
  /** Announced when all filters are cleared. */
  allFiltersCleared: () => string;
  /** Announced when a group row is expanded. */
  groupExpanded: (name: string, count: number) => string;
  /** Announced when a group row is collapsed. */
  groupCollapsed: (name: string) => string;
  /** Announced when row selection changes. */
  selectionChanged: (count: number) => string;
  /** Announced when a single column is selected. @since 2.8.0 */
  columnSelected: (label: string) => string;
  /** Announced when multiple columns are selected. @since 2.8.0 */
  columnSelectionChanged: (count: number) => string;
  /** Announced when column selection is cleared. @since 2.8.0 */
  columnSelectionCleared: () => string;
  /** Announced when the active selection axis flips between row and column. @since 2.8.0 */
  selectionAxisChanged: (toAxis: 'row' | 'column') => string;
  /** Announced when row editing starts. */
  editingStarted: (rowIndex: number) => string;
  /** Announced when row editing is committed. */
  editingCommitted: (rowIndex: number) => string;
  /** Announced when data is loaded. */
  dataLoaded: (count: number) => string;
}

/**
 * Accessibility configuration for controlling screen reader announcements.
 *
 * @group Accessibility
 *
 * @example
 * ```ts
 * // Disable all live announcements
 * a11y: { announcements: false }
 *
 * // Override specific messages for French locale
 * a11y: {
 *   messages: {
 *     sortApplied: (col, dir) => `Trié par ${col}, ${dir}`,
 *     sortCleared: () => 'Tri effacé',
 *   },
 * }
 * ```
 * @since 2.0.0
 */
export interface A11yConfig {
  /**
   * Enable or disable live region announcements.
   * When `false`, the `aria-live` region remains in the DOM but no messages are set.
   * @defaultValue `true`
   */
  announcements?: boolean;
  /**
   * Custom announcement text overrides for internationalization.
   * Partial — only override the messages you need; defaults are used for the rest.
   */
  messages?: Partial<A11yMessages>;
}

/**
 * Default English announcement messages.
 * Used when no custom messages are provided via {@link A11yConfig.messages}.
 * @since 2.0.0
 */
export const DEFAULT_A11Y_MESSAGES: A11yMessages = {
  sortApplied: (column, direction) => `Sorted by ${column}, ${direction}`,
  sortCleared: () => 'Sort cleared',
  filterApplied: (column) => `Filter applied on ${column}`,
  filterCleared: (column) => `Filter cleared from ${column}`,
  allFiltersCleared: () => 'All filters cleared',
  groupExpanded: (name, count) => `Group ${name} expanded, ${count} rows`,
  groupCollapsed: (name) => `Group ${name} collapsed`,
  selectionChanged: (count) => `${count} rows selected`,
  columnSelected: (label) => `Column ${label} selected`,
  columnSelectionChanged: (count) => `${count} columns selected`,
  columnSelectionCleared: () => 'Column selection cleared',
  selectionAxisChanged: (toAxis) =>
    toAxis === 'column'
      ? 'Row selection cleared, column selection active'
      : 'Column selection cleared, row selection active',
  editingStarted: (rowIndex) => `Editing row ${rowIndex + 1}`,
  editingCommitted: (rowIndex) => `Row ${rowIndex + 1} saved`,
  dataLoaded: (count) => `${count} rows loaded`,
};

// #endregion

// #region Grid Config
/**
 * Grid configuration object - the **single source of truth** for grid behavior.
 *
 * Users can configure the grid via multiple input methods, all of which converge
 * into an effective `GridConfig` internally:
 *
 * **Configuration Input Methods:**
 * - `gridConfig` property - direct assignment of this object
 * - `columns` property - shorthand for `gridConfig.columns`
 * - `fitMode` property - shorthand for `gridConfig.fitMode`
 * - Light DOM `<tbw-grid-column>` - declarative columns (merged into `columns`)
 * - Light DOM `<tbw-grid-header>` - declarative shell header (merged into `shell.header`)
 *
 * **Precedence (when same property set multiple ways):**
 * Individual props (`fitMode`) > `columns` prop > Light DOM > `gridConfig`
 *
 * @example
 * ```ts
 * // Via gridConfig (recommended for complex setups)
 * grid.gridConfig = {
 *   columns: [{ field: 'name' }, { field: 'age' }],
 *   fitMode: 'stretch',
 *   plugins: [new SelectionPlugin()],
 *   shell: { header: { title: 'My Grid' } }
 * };
 *
 * // Via individual props (convenience for simple cases)
 * grid.columns = [{ field: 'name' }, { field: 'age' }];
 * grid.fitMode = 'stretch';
 * ```
 * @since 0.1.1
 */
export interface GridConfig<TRow = any> {
  /**
   * Column definitions. Can also be set via `columns` prop or `<tbw-grid-column>` light DOM.
   * @see {@link ColumnConfig} for column options
   * @see {@link ColumnConfigMap}
   */
  columns?: ColumnConfigMap<TRow>;
  /**
   * Dynamic CSS class(es) for data rows.
   * Called for each row during rendering. Return class names to add to the row element.
   *
   * @example
   * ```typescript
   * // Highlight inactive rows
   * rowClass: (row) => row.active ? [] : ['inactive', 'dimmed']
   *
   * // Status-based row styling
   * rowClass: (row) => [`priority-${row.priority}`]
   *
   * // Single class as string
   * rowClass: (row) => row.isNew ? 'new-row' : ''
   * ```
   */
  rowClass?: (row: TRow) => string | string[];
  /** Sizing mode for columns. Can also be set via `fitMode` prop. */
  fitMode?: FitMode;

  /**
   * Grid-wide sorting toggle.
   * When false, disables sorting for all columns regardless of their individual `sortable` setting.
   * When true (default), columns with `sortable: true` can be sorted.
   *
   * This affects:
   * - Header click handlers for sorting
   * - Sort indicator visibility
   * - Multi-sort plugin behavior (if loaded)
   *
   * @default true
   *
   * @example
   * ```typescript
   * // Disable all sorting
   * gridConfig = { sortable: false };
   *
   * // Enable sorting (default) - individual columns still need sortable: true
   * gridConfig = { sortable: true };
   * ```
   */
  sortable?: boolean;

  /**
   * Grid-wide resizing toggle.
   * When false, disables column resizing for all columns regardless of their individual `resizable` setting.
   * When true (default), columns with `resizable: true` (or resizable not set, since it defaults to true) can be resized.
   *
   * This affects:
   * - Resize handle visibility in header cells
   * - Double-click to auto-size behavior
   *
   * @default true
   *
   * @example
   * ```typescript
   * // Disable all column resizing
   * gridConfig = { resizable: false };
   *
   * // Enable resizing (default) - individual columns can opt out with resizable: false
   * gridConfig = { resizable: true };
   * ```
   */
  resizable?: boolean;

  /**
   * Row height in pixels for virtualization calculations.
   * The virtualization system assumes uniform row heights for performance.
   *
   * If not specified, the grid measures the first rendered row's height,
   * which respects the CSS variable `--tbw-row-height` set by themes.
   *
   * Set this explicitly when:
   * - Row content may wrap to multiple lines (also set `--tbw-cell-white-space: normal`)
   * - Using custom row templates with variable content
   * - You want to override theme-defined row height
   * - Rows have different heights based on content (use function form)
   *
   * **Variable Row Heights**: When a function is provided, the grid enables variable height
   * virtualization. Heights are measured on first render and cached by row identity.
   *
   * @default Auto-measured from first row (respects --tbw-row-height CSS variable)
   *
   * @example
   * ```ts
   * // Fixed height for all rows
   * gridConfig = { rowHeight: 56 };
   *
   * // Variable height based on content
   * gridConfig = {
   *   rowHeight: (row, index) => row.hasDetails ? 80 : 40,
   * };
   *
   * // Return undefined to trigger DOM auto-measurement
   * gridConfig = {
   *   rowHeight: (row) => row.isExpanded ? undefined : 40,
   * };
   * ```
   */
  rowHeight?: number | ((row: TRow, index: number) => number | undefined);
  /**
   * Array of plugin instances.
   * Each plugin is instantiated with its configuration and attached to this grid.
   *
   * @example
   * ```ts
   * plugins: [
   *   new SelectionPlugin({ mode: 'range' }),
   *   new MultiSortPlugin(),
   *   new FilteringPlugin({ debounceMs: 150 }),
   * ]
   * ```
   */
  plugins?: GridPlugin[];

  /**
   * Declarative feature configuration.
   * Alternative to manually creating plugin instances in `plugins`.
   * Features are resolved using the core feature registry.
   *
   * Import feature modules as side effects to register them:
   * ```ts
   * import '@toolbox-web/grid/features/selection';
   * import '@toolbox-web/grid/features/filtering';
   * ```
   *
   * Then configure declaratively:
   * ```ts
   * gridConfig = {
   *   features: {
   *     selection: 'range',
   *     filtering: { debounceMs: 200 },
   *     editing: 'dblclick',
   *   },
   * };
   * ```
   *
   * Both `features` and `plugins` can be used together — features-generated plugins
   * are created first, then manual `plugins` are appended. Duplicates are skipped
   * (manual `plugins` take precedence).
   */
  features?: Partial<FeatureConfig<TRow>>;

  /**
   * Saved column state to restore on initialization.
   * Includes order, width, visibility, sort, and plugin-contributed state.
   */
  columnState?: GridColumnState;

  /**
   * Shell configuration for header bar and tool panels.
   * When configured, adds an optional wrapper with title, toolbar, and collapsible side panels.
   */
  shell?: ShellConfig;

  /**
   * Grid-wide icon configuration.
   *
   * The grid uses a **CSS-first hybrid icon system**:
   * - **Default (CSS):** Icons render via `--tbw-icon-*` CSS custom properties on `tbw-grid`.
   *   Override them in your theme CSS — no JavaScript needed.
   * - **JS override:** Setting `gridConfig.icons` takes precedence over CSS for any key provided.
   *   Use this for dynamic icons, icon libraries, or `HTMLElement` instances.
   *
   * All icons are optional — sensible defaults are used when not specified.
   * Plugins will use these by default but can override with their own config.
   */
  icons?: GridIcons;

  /**
   * Grid-wide animation configuration.
   * Controls animations for expand/collapse, reordering, and other visual transitions.
   * Individual plugins can override these defaults in their own config.
   */
  animation?: AnimationConfig;

  /**
   * Custom sort handler for the entire grid.
   *
   * :::caution
   * **Prefer {@link BaseColumnConfig.sortComparator} over `sortHandler`.**
   *
   * `sortHandler` is a low-level escape hatch with significant limitations:
   * - Only consulted by the **single-column** sort path (core header click,
   *   `TreePlugin` per-level sort, `ServerSidePlugin` `sortMode: 'local'`).
   * - **Bypassed entirely** when `MultiSortPlugin` is loaded.
   * - Owns ALL columns at once — your handler must implement field/direction
   *   dispatch and null handling for every sortable column itself.
   *
   * For per-column custom sort logic, use {@link BaseColumnConfig.sortComparator}
   * instead. It is honored by every sort code path in the grid (core, multi-sort,
   * tree, server-side) and is composable across columns.
   *
   * For server-side sort, prefer {@link ServerSideConfig.dataSource} — the
   * `sortModel` is shipped to your `getRows` handler so the backend can return
   * pre-sorted blocks.
   * :::
   *
   * Use `sortHandler` only when you need to replace the grid's sort engine
   * wholesale (e.g. integrating a third-party sort library that operates on
   * the full row array, or routing every sort through a single async pipeline).
   *
   * The handler receives:
   * - `rows`: Current row array to sort
   * - `sortState`: Sort field and direction (1 = asc, -1 = desc)
   * - `columns`: Column configurations (for accessing sortComparator)
   *
   * Return the sorted array (sync) or a Promise that resolves to it (async).
   *
   * @example
   * ```ts
   * // Replace the entire client-side sort engine with a custom stable sort
   * sortHandler: (rows, state) => stableSort(rows, state.field, state.direction);
   * ```
   *
   * @see {@link BaseColumnConfig.sortComparator} — recommended per-column override
   * @see {@link ServerSideConfig.dataSource} — recommended server-side sort path
   */
  sortHandler?: SortHandler<TRow>;

  /**
   * Initial sort state applied when the grid first renders.
   *
   * Equivalent to calling `grid.sort(field, direction)` after the grid is created,
   * but avoids the imperative call and extra render cycle.
   *
   * @example
   * ```ts
   * gridConfig = {
   *   initialSort: { field: 'salary', direction: 'desc' },
   * };
   * ```
   *
   * @see {@link DataGrid.sort} for runtime sorting
   * @see {@link DataGrid.sortModel} for reading current sort state
   */
  initialSort?: { field: string; direction: 'asc' | 'desc' };

  /**
   * Function to extract a unique identifier from a row.
   * Used by `updateRow()`, `getRow()`, and ID-based tracking.
   *
   * If not provided, falls back to `row.id` or `row._id` if present.
   * Rows without IDs are silently skipped during map building.
   * Only throws when explicitly calling `getRowId()` or `updateRow()` on a row without an ID.
   *
   * @example
   * ```ts
   * // Simple field
   * getRowId: (row) => row.id
   *
   * // Composite key
   * getRowId: (row) => `${row.voyageId}-${row.legNumber}`
   *
   * // UUID field
   * getRowId: (row) => row.uuid
   * ```
   */
  getRowId?: (row: TRow) => string;

  /**
   * Type-level renderer and editor defaults.
   *
   * Keys can be:
   * - Built-in types: `'string'`, `'number'`, `'date'`, `'boolean'`, `'select'`
   * - Custom types: `'currency'`, `'country'`, `'status'`, etc.
   *
   * Resolution order (highest priority first):
   * 1. Column-level (`column.renderer` / `column.editor`)
   * 2. Grid-level (`gridConfig.typeDefaults[column.type]`)
   * 3. App-level (Angular `GridTypeRegistry`, React `GridTypeProvider`)
   * 4. Built-in (checkbox for boolean, select for select, etc.)
   * 5. Fallback (plain text / text input)
   *
   * @example
   * ```typescript
   * typeDefaults: {
   *   date: { editor: myDatePickerEditor },
   *   country: {
   *     renderer: (ctx) => {
   *       const span = document.createElement('span');
   *       span.innerHTML = `<img src="/flags/${ctx.value}.svg" /> ${ctx.value}`;
   *       return span;
   *     },
   *     editor: (ctx) => createCountrySelect(ctx)
   *   }
   * }
   * ```
   */
  typeDefaults?: Record<string, TypeDefault<TRow>>;

  // #region Accessibility

  /**
   * Accessible label for the grid.
   * Sets `aria-label` on the grid's internal table element for screen readers.
   *
   * If not provided and `shell.header.title` is set, the title is used automatically.
   *
   * If [`gridAriaLabelledBy`](#gridarialabelledby) is also set, `aria-labelledby`
   * takes precedence per WAI-ARIA accessible-name computation and `aria-label`
   * is omitted.
   *
   * @example
   * ```ts
   * gridConfig = { gridAriaLabel: 'Employee data' };
   * ```
   */
  gridAriaLabel?: string;

  /**
   * ID of an element that labels the grid.
   * Sets `aria-labelledby` on the grid's internal table element so screen
   * readers can use the referenced element's text as the accessible name —
   * useful when the grid already sits next to a heading.
   *
   * Per WAI-ARIA accessible-name precedence, `aria-labelledby` takes priority
   * over `aria-label` and over the auto-derived shell title. When this option
   * is set, the grid omits `aria-label` to avoid conflicting names.
   *
   * @example
   * ```html
   * <h2 id="grid-heading">Employees</h2>
   * <tbw-grid></tbw-grid>
   * ```
   * ```ts
   * gridConfig = { gridAriaLabelledBy: 'grid-heading' };
   * ```
   */
  gridAriaLabelledBy?: string;

  /**
   * ID of an element that describes the grid.
   * Sets `aria-describedby` on the grid's internal table element.
   *
   * @example
   * ```html
   * <p id="grid-desc">This table shows all active employees.</p>
   * <tbw-grid></tbw-grid>
   * ```
   * ```ts
   * gridConfig = { gridAriaDescribedBy: 'grid-desc' };
   * ```
   */
  gridAriaDescribedBy?: string;

  /**
   * Override the screen-reader-announced role name for the grid via
   * `aria-roledescription`. Useful for localization (e.g. `"Tabell"` in
   * Norwegian) or domain-specific naming (e.g. `"Employee table"`).
   *
   * :::caution
   * Per [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#aria-roledescription),
   * the value should still describe a grid-like widget. Overriding with an
   * unrelated label confuses assistive-technology users about the available
   * interactions (cell navigation, sort, etc.). Leave unset to use the
   * default role name announced by the AT.
   * :::
   *
   * @example
   * ```ts
   * gridConfig = { gridAriaRoleDescription: 'Employee table' };
   * ```
   */
  gridAriaRoleDescription?: string;

  /**
   * Accessibility configuration for screen reader announcements.
   *
   * The grid automatically announces state changes (sort, filter, selection, etc.)
   * via an `aria-live` region. Use this config to toggle announcements or override
   * message text for internationalization.
   *
   * @example
   * ```ts
   * // Disable all announcements
   * gridConfig = { a11y: { announcements: false } };
   *
   * // Custom messages for i18n
   * gridConfig = {
   *   a11y: {
   *     messages: {
   *       sortApplied: (col, dir) => `Trié par ${col}, ${dir}`,
   *       filterApplied: (col) => `Filtre appliqué sur ${col}`,
   *     },
   *   },
   * };
   * ```
   */
  a11y?: A11yConfig;

  // #endregion

  // #region Loading

  /**
   * Custom renderer for the loading overlay.
   *
   * When provided, replaces the default spinner with custom content.
   * Receives a context object with the current loading size.
   *
   * @example
   * ```typescript
   * // Simple text loading indicator
   * loadingRenderer: () => {
   *   const el = document.createElement('div');
   *   el.textContent = 'Loading...';
   *   return el;
   * }
   *
   * // Custom spinner component
   * loadingRenderer: (ctx) => {
   *   const spinner = document.createElement('my-spinner');
   *   spinner.size = ctx.size === 'large' ? 48 : 24;
   *   return spinner;
   * }
   * ```
   */
  loadingRenderer?: LoadingRenderer;

  // #endregion

  // #region Empty State

  /**
   * Custom renderer shown when the grid has no rows to display
   * (`loading === false` AND the rendered row count is `0`, after all plugin
   * processing such as filtering / grouping / server-side).
   *
   * - When **omitted**, a built-in message is rendered ("No data to display"
   *   or "No matching rows" when source rows existed but were filtered out).
   * - When set to a function, the function receives an {@link EmptyContext}
   *   and returns an `HTMLElement` or HTML string.
   * - When **explicitly `null`**, the empty overlay is suppressed entirely.
   *
   * The empty overlay is mutually exclusive with the loading overlay; if
   * `loading === true`, the loading overlay always wins.
   *
   * @example
   * ```typescript
   * // Show a backend error message via a closure over the consumer's state.
   * gridConfig.emptyRenderer = () =>
   *   error
   *     ? `Failed to load deals: ${error.message}`
   *     : 'No deals to display';
   * ```
   *
   * @see {@link EmptyOverlay} to control where the overlay is mounted.
   * @since 1.8.0
   */
  emptyRenderer?: EmptyRenderer | null;

  /**
   * Where the empty-state overlay is mounted.
   *
   * - `'rows'` (default) — overlays the `.rows-container`. Headers stay
   *   visible so users can clear filters or see the column schema.
   * - `'grid'` — overlays the `.tbw-grid-root`. Hides headers and any
   *   shell/toolbar content too.
   *
   * @defaultValue `'rows'`
   * @since 1.8.0
   */
  emptyOverlay?: EmptyOverlay;

  // #endregion
}
// #endregion

// #region Empty State Types

/**
 * Where the empty-state overlay is mounted.
 *
 * @see {@link GridConfig.emptyOverlay}
 * @since 1.8.0
 */
export type EmptyOverlay = 'rows' | 'grid';

/**
 * Context passed to a custom {@link EmptyRenderer}.
 *
 * @since 1.8.0
 */
export interface EmptyContext {
  /**
   * Number of rows in the source data before any plugin processing
   * (sort / filter / group / server-side). Equivalent to
   * `grid.sourceRows.length`.
   */
  sourceRowCount: number;
  /**
   * `true` when the source had rows but all of them were filtered out
   * (i.e. `sourceRowCount > 0` while the rendered row count is `0`).
   * The default renderer uses this flag to switch between
   * "No data to display" and "No matching rows".
   */
  filteredOut: boolean;
}

/**
 * Custom renderer for the empty state overlay.
 *
 * @param context - {@link EmptyContext} describing why the grid is empty.
 * @returns An `HTMLElement` or an HTML string.
 *
 * @example
 * ```typescript
 * const renderer: EmptyRenderer = (ctx) => {
 *   const div = document.createElement('div');
 *   div.textContent = ctx.filteredOut ? 'No matches' : 'No data';
 *   return div;
 * };
 * ```
 *
 * @see {@link GridConfig.emptyRenderer}
 * @since 1.8.0
 */
export type EmptyRenderer = (context: EmptyContext) => HTMLElement | string;

// #endregion

// #region Animation

/**
 * Sort state passed to custom sort handlers.
 * Represents the current sorting configuration for a column.
 *
 * @example
 * ```typescript
 * // In a custom sort handler
 * const sortHandler: SortHandler = (rows, sortState, columns) => {
 *   const { field, direction } = sortState;
 *   console.log(`Sorting by ${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
 *
 *   return [...rows].sort((a, b) => {
 *     const aVal = a[field];
 *     const bVal = b[field];
 *     return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * direction;
 *   });
 * };
 * ```
 *
 * @see {@link SortHandler} for custom sort handler signature
 * @see {@link SortChangeDetail} for sort change events
 * @since 0.2.7
 */
export interface SortState {
  /** Field to sort by */
  field: string;
  /** Sort direction: 1 = ascending, -1 = descending */
  direction: 1 | -1;
}

/**
 * Custom sort handler function signature.
 *
 * :::caution
 * **Prefer {@link BaseColumnConfig.sortComparator} over `SortHandler`.**
 * `sortHandler` is bypassed by `MultiSortPlugin` and only sees the single
 * active sort field. For per-column custom sort logic that survives every
 * sort code path (core, multi-sort, tree, server-side), set `sortComparator`
 * on the relevant columns instead. For server-side sort, use
 * {@link ServerSideConfig.dataSource}.
 * :::
 *
 * Use `SortHandler` only when you need to replace the grid's sort engine
 * wholesale.
 *
 * @param rows - Current row array to sort
 * @param sortState - Sort field and direction
 * @param columns - Column configurations (for accessing sortComparator)
 * @returns Sorted array (sync) or Promise resolving to sorted array (async)
 *
 * @example
 * ```typescript
 * // Replace the built-in sort with a third-party stable sort library
 * const customSortHandler: SortHandler<Employee> = (rows, state) => {
 *   return thirdPartyStableSort(rows, state.field, state.direction);
 * };
 *
 * grid.gridConfig = { sortHandler: customSortHandler };
 * ```
 *
 * @see {@link SortState} for the sort state object
 * @see {@link GridConfig.sortHandler} for configuring the handler (and its caveats)
 * @see {@link BaseColumnConfig.sortComparator} — recommended per-column comparator
 * @since 0.2.7
 */
export type SortHandler<TRow = any> = (
  rows: TRow[],
  sortState: SortState,
  columns: ColumnConfig<TRow>[],
) => TRow[] | Promise<TRow[]>;

// #region Loading

/**
 * Loading indicator size variant.
 *
 * - `'large'`: 48x48px max - used for grid-level loading overlay (`grid.loading = true`)
 * - `'small'`: Follows row height - used for row/cell loading states
 *
 * @example
 * ```typescript
 * // Custom loading renderer adapting to size
 * const myLoader: LoadingRenderer = (ctx) => {
 *   if (ctx.size === 'large') {
 *     // Full overlay spinner
 *     return '<div class="spinner-lg"></div>';
 *   }
 *   // Inline row/cell spinner
 *   return '<span class="spinner-sm"></span>';
 * };
 * ```
 *
 * @see {@link LoadingRenderer} for custom loading renderer
 * @see {@link LoadingContext} for context passed to renderers
 * @since 1.7.0
 */
export type LoadingSize = 'large' | 'small';

/**
 * Context passed to custom loading renderers.
 *
 * Provides information about the loading indicator being rendered,
 * allowing the renderer to adapt its appearance based on the size variant.
 *
 * @example
 * ```typescript
 * const myLoadingRenderer: LoadingRenderer = (ctx: LoadingContext) => {
 *   if (ctx.size === 'large') {
 *     // Full-size spinner for grid-level loading
 *     return '<div class="large-spinner"></div>';
 *   } else {
 *     // Compact spinner for row/cell loading
 *     return '<div class="small-spinner"></div>';
 *   }
 * };
 * ```
 *
 * @see {@link LoadingRenderer} for the renderer function signature
 * @see {@link LoadingSize} for available size variants
 * @since 1.7.0
 */
export interface LoadingContext {
  /** The size variant being rendered: 'large' for grid-level, 'small' for row/cell */
  size: LoadingSize;
}

/**
 * Custom loading renderer function.
 * Returns an element or HTML string to display as the loading indicator.
 *
 * Used with the `loadingRenderer` property in {@link GridConfig} to replace
 * the default spinner with custom content.
 *
 * @param context - Context containing size information
 * @returns HTMLElement or HTML string
 *
 * @example
 * ```typescript
 * // Simple text loading indicator
 * const textLoader: LoadingRenderer = () => {
 *   const el = document.createElement('div');
 *   el.textContent = 'Loading...';
 *   return el;
 * };
 *
 * // Custom spinner with size awareness
 * const customSpinner: LoadingRenderer = (ctx) => {
 *   const spinner = document.createElement('my-spinner');
 *   spinner.size = ctx.size === 'large' ? 48 : 24;
 *   return spinner;
 * };
 *
 * // Material Design-style progress bar
 * const progressBar: LoadingRenderer = () => {
 *   const container = document.createElement('div');
 *   container.className = 'progress-bar-container';
 *   container.innerHTML = '<div class="progress-bar"></div>';
 *   return container;
 * };
 *
 * grid.gridConfig = {
 *   loadingRenderer: customSpinner,
 * };
 * ```
 *
 * @see {@link LoadingContext} for the context object passed to the renderer
 * @see {@link LoadingSize} for size variants ('large' | 'small')
 * @since 1.7.0
 */
export type LoadingRenderer = (context: LoadingContext) => HTMLElement | string;

// #endregion

// #region Data Change Event

/**
 * Detail for the `data-change` event.
 *
 * Fired whenever the grid's row data changes — including new data assignment,
 * row insertion/removal, and in-place mutations via `updateRow()`.
 *
 * Use this to keep external UI in sync with the grid's current data state
 * (row counts, summaries, charts, etc.).
 *
 * @example
 * ```typescript
 * grid.on('data-change', ({ rowCount, sourceRowCount }) => {
 *   console.log(`${rowCount} rows visible of ${sourceRowCount} total`);
 * });
 * ```
 *
 * @see {@link DataGridEventMap} for all event types
 * @category Events
 * @since 1.25.0
 */
export interface DataChangeDetail {
  /** Number of visible (processed) rows */
  rowCount: number;
  /** Total number of source rows (before filtering/grouping) */
  sourceRowCount: number;
}

/**
 * Detail payload for the `tbw-scroll` event.
 *
 * Dispatched on the grid host whenever the vertical viewport scrolls
 * (rAF-batched — at most one per frame). Use to trigger pagination,
 * defer heavy cell content rendering, dismiss overlays, or sync a
 * scroll-tracking UI outside the grid.
 *
 * For server-side pagination of large datasets, prefer
 * `ServerSidePlugin` which handles block fetching out of the box.
 *
 * @example
 * ```typescript
 * grid.addEventListener('tbw-scroll', (e) => {
 *   const { scrollTop, scrollHeight, clientHeight } = e.detail;
 *   if (scrollTop + clientHeight >= scrollHeight - 200) loadMore();
 * });
 * ```
 *
 * @see {@link DataGridEventMap} for all event types
 * @category Events
 * @since 2.2.0
 */
export interface TbwScrollDetail {
  /** Current vertical scroll offset in pixels (faux scrollbar). */
  scrollTop: number;
  /** Total scrollable height in pixels (faux scrollbar). */
  scrollHeight: number;
  /** Visible viewport height in pixels (faux scrollbar). */
  clientHeight: number;
  /**
   * Axis that triggered this dispatch. Currently always `'vertical'`;
   * `'horizontal'` is reserved for a future opt-in dispatch and is
   * declared up-front so consumer narrowing remains source-compatible.
   */
  direction: 'vertical' | 'horizontal';
}

// #endregion

// #region Data Update Management

/**
 * Indicates the origin of a data change.
 * Used to prevent infinite loops in cascade update handlers.
 *
 * - `'user'`: Direct user interaction via EditingPlugin (typing, selecting)
 * - `'cascade'`: Triggered by `updateRow()` in an event handler
 * - `'api'`: External programmatic update via `grid.updateRow()`
 *
 * @example
 * ```typescript
 * grid.on('cell-change', (detail) => {
 *   const { source, field, newValue } = detail;
 *
 *   // Only cascade updates for user edits
 *   if (source === 'user' && field === 'price') {
 *     // Update calculated field (marked as 'cascade')
 *     grid.updateRow(detail.rowId, {
 *       total: newValue * detail.row.quantity,
 *     });
 *   }
 *
 *   // Ignore cascade updates to prevent infinite loops
 *   if (source === 'cascade') return;
 * });
 * ```
 *
 * @see {@link CellChangeDetail} for the event detail containing source
 * @category Data Management
 * @since 1.0.0
 */
export type UpdateSource = 'user' | 'cascade' | 'api';

/**
 * Detail for cell-change event (emitted by core after mutation).
 * This is an informational event that fires for ALL data mutations.
 *
 * Use this event for:
 * - Logging/auditing changes
 * - Cascading updates (updating other fields based on a change)
 * - Syncing changes to external state
 *
 * @example
 * ```typescript
 * grid.on('cell-change', ({ row, rowId, field, oldValue, newValue, source }) => {
 *   console.log(`${field} changed from ${oldValue} to ${newValue}`);
 *   console.log(`Change source: ${source}`);
 *
 *   // Cascade: update total when price changes
 *   if (source === 'user' && field === 'price') {
 *     grid.updateRow(rowId, { total: newValue * row.quantity });
 *   }
 * });
 * ```
 *
 * @see {@link UpdateSource} for understanding change origins
 * @see CellCommitDetail for the commit event (editing lifecycle)
 * @category Events
 * @since 1.0.0
 */
export interface CellChangeDetail<TRow = unknown> {
  /** The row object (after mutation) */
  row: TRow;
  /** Stable row identifier */
  rowId: string;
  /** Current index in rows array */
  rowIndex: number;
  /** Field that changed */
  field: string;
  /** Value before change */
  oldValue: unknown;
  /** Value after change */
  newValue: unknown;
  /** All changes passed to updateRow/updateRows (for context) */
  changes: Partial<TRow>;
  /** Origin of this change */
  source: UpdateSource;
}

/**
 * Batch update specification for updateRows().
 *
 * Used when you need to update multiple rows at once efficiently.
 * The grid will batch all updates and trigger a single re-render.
 *
 * @example
 * ```typescript
 * // Update multiple rows in a single batch
 * const updates: RowUpdate<Employee>[] = [
 *   { id: 'emp-1', changes: { status: 'active', updatedAt: new Date() } },
 *   { id: 'emp-2', changes: { status: 'inactive' } },
 *   { id: 'emp-3', changes: { salary: 75000 } },
 * ];
 *
 * grid.updateRows(updates);
 * ```
 *
 * @see {@link CellChangeDetail} for individual change events
 * @see {@link GridConfig.getRowId} for row identification
 * @category Data Management
 * @since 1.0.0
 */
export interface RowUpdate<TRow = unknown> {
  /** Row identifier (from getRowId) */
  id: string;
  /** Fields to update */
  changes: Partial<TRow>;
}

/**
 * A batch of row mutations to apply atomically in a single render cycle.
 *
 * All adds, updates, and removes are processed together with one re-render,
 * making this far more efficient than calling `insertRow`, `updateRow`, and
 * `removeRow` individually — especially for high-frequency streaming data.
 *
 * Row identification for `update` and `remove` uses the grid's configured
 * {@link GridConfig.getRowId | getRowId} function.
 *
 * @example
 * ```typescript
 * // Apply a mixed transaction from a WebSocket message
 * const result = await grid.applyTransaction({
 *   add: [{ id: 'new-1', name: 'Alice', status: 'Active' }],
 *   update: [{ id: 'emp-5', changes: { status: 'Inactive' } }],
 *   remove: [{ id: 'emp-3' }],
 * });
 *
 * console.log(`Added: ${result.added.length}, Updated: ${result.updated.length}, Removed: ${result.removed.length}`);
 * ```
 *
 * @see {@link TransactionResult} for the result structure
 * @category Data Management
 * @since 1.27.0
 */
export interface RowTransaction<TRow = unknown> {
  /** Rows to insert. Appended at the end of the current view. */
  add?: TRow[];
  /** Rows to update in-place by ID. */
  update?: RowUpdate<TRow>[];
  /** Rows to remove by ID. */
  remove?: Array<{ id: string }>;
}

/**
 * Result of a {@link RowTransaction} applied via `applyTransaction`.
 *
 * Contains the actual row objects that were affected, useful for
 * post-processing or logging.
 *
 * @see {@link RowTransaction} for the input structure
 * @category Data Management
 * @since 1.27.0
 */
export interface TransactionResult<TRow = unknown> {
  /** Rows that were successfully added. */
  added: TRow[];
  /** Rows that were successfully updated (references to the mutated row objects). */
  updated: TRow[];
  /** Rows that were successfully removed. */
  removed: TRow[];
}

// #endregion

/**
 * Animation behavior mode.
 * - `true` or `'on'`: Animations always enabled
 * - `false` or `'off'`: Animations always disabled
 * - `'reduced-motion'`: Respects `prefers-reduced-motion` media query (default)
 *
 * @example
 * ```typescript
 * // Force animations on (ignore system preference)
 * grid.gridConfig = { animation: { mode: 'on' } };
 *
 * // Disable all animations
 * grid.gridConfig = { animation: { mode: false } };
 *
 * // Respect user's accessibility settings (default)
 * grid.gridConfig = { animation: { mode: 'reduced-motion' } };
 * ```
 *
 * @see {@link AnimationConfig} for full animation configuration
 * @since 0.2.7
 */
export type AnimationMode = boolean | 'on' | 'off' | 'reduced-motion';

/**
 * Animation style for visual transitions.
 * - `'slide'`: Slide/transform animation (e.g., expand down, slide left/right)
 * - `'fade'`: Opacity fade animation
 * - `'flip'`: FLIP technique for position changes (First, Last, Invert, Play)
 * - `false`: No animation for this specific feature
 *
 * @example
 * ```typescript
 * // Plugin-specific animation styles
 * new TreePlugin({
 *   expandAnimation: 'slide', // Slide children down when expanding
 * });
 *
 * new ReorderPlugin({
 *   animation: 'flip', // FLIP animation for column reordering
 * });
 * ```
 *
 * @see {@link AnimationConfig} for grid-wide animation settings
 * @see {@link ExpandCollapseAnimation} for expand/collapse-specific styles
 * @since 0.2.7
 */
export type AnimationStyle = 'slide' | 'fade' | 'flip' | false;

/**
 * Animation style for expand/collapse operations.
 * Subset of AnimationStyle - excludes 'flip' which is for position changes.
 * - `'slide'`: Slide down/up animation for expanding/collapsing content
 * - `'fade'`: Fade in/out animation
 * - `false`: No animation
 *
 * @example
 * ```typescript
 * // Tree rows slide down when expanding
 * new TreePlugin({ expandAnimation: 'slide' });
 *
 * // Row groups fade in/out
 * new GroupingRowsPlugin({ expandAnimation: 'fade' });
 *
 * // Master-detail panels with no animation
 * new MasterDetailPlugin({ expandAnimation: false });
 * ```
 *
 * @see {@link AnimationStyle} for all animation styles
 * @see {@link AnimationConfig} for grid-wide settings
 * @since 0.2.9
 */
export type ExpandCollapseAnimation = 'slide' | 'fade' | false;

/**
 * Type of row animation.
 * - `'change'`: Flash highlight when row data changes (e.g., after cell edit)
 * - `'insert'`: Slide-in animation for newly added rows
 * - `'remove'`: Fade-out animation for rows being removed
 *
 * @example
 * ```typescript
 * // Internal usage - row animation is triggered automatically:
 * // - 'change' after cell-commit event
 * // - 'insert' when rows are added to the grid
 * // - 'remove' when rows are deleted
 *
 * // The animation respects AnimationConfig.mode
 * grid.gridConfig = {
 *   animation: { mode: 'on', duration: 300 },
 * };
 * ```
 *
 * @see {@link AnimationConfig} for animation configuration
 * @since 1.3.0
 */
export type RowAnimationType = 'change' | 'insert' | 'remove';

/**
 * Grid-wide animation configuration.
 * Controls global animation behavior - individual plugins define their own animation styles.
 * Duration and easing values set corresponding CSS variables on the grid element.
 *
 * @example
 * ```typescript
 * // Enable animations regardless of system preferences
 * grid.gridConfig = {
 *   animation: {
 *     mode: 'on',
 *     duration: 300,
 *     easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
 *   },
 * };
 *
 * // Disable all animations
 * grid.gridConfig = {
 *   animation: { mode: 'off' },
 * };
 *
 * // Respect user's reduced-motion preference (default)
 * grid.gridConfig = {
 *   animation: { mode: 'reduced-motion' },
 * };
 * ```
 *
 * @see {@link AnimationMode} for mode options
 * @since 0.2.7
 */
export interface AnimationConfig {
  /**
   * Global animation mode.
   * @default 'reduced-motion'
   */
  mode?: AnimationMode;

  /**
   * Default animation duration in milliseconds.
   * Sets `--tbw-animation-duration` CSS variable.
   * @default 200
   */
  duration?: number;

  /**
   * Default easing function.
   * Sets `--tbw-animation-easing` CSS variable.
   * @default 'ease-out'
   */
  easing?: string;
}

/** Default animation configuration * @since 0.2.7
 */
export const DEFAULT_ANIMATION_CONFIG: Required<Omit<AnimationConfig, 'sort'>> = {
  mode: 'reduced-motion',
  duration: 200,
  easing: 'ease-out',
};

// #endregion

// #region Grid Icons

/** Icon value - can be a string (text/HTML) or HTMLElement * @since 0.1.1
 */
export type IconValue = string | HTMLElement;

/**
 * Grid-wide icon configuration.
 * All icons are optional - sensible defaults are used when not specified.
 *
 * The grid uses a **CSS-first hybrid approach**: icons render via `--tbw-icon-*` CSS
 * custom properties by default. Setting `gridConfig.icons` provides JS overrides that
 * take precedence over CSS (the JS icon injects DOM content, suppressing the CSS
 * `::before` pseudo-element via the `:empty` selector).
 *
 * **Use CSS** for static theming (text, emoji, SVG masks via `--tbw-icon-*-mask`).
 * **Use JS** for dynamic icons, icon libraries, or `HTMLElement` instances.
 *
 * Icons can be text (including emoji), HTML strings (for SVG), or HTMLElement instances.
 *
 * @example
 * ```typescript
 * grid.gridConfig = {
 *   icons: {
 *     // Emoji icons
 *     expand: '➕',
 *     collapse: '➖',
 *
 *     // Custom SVG icon
 *     sortAsc: '<svg viewBox="0 0 16 16"><path d="M8 4l4 8H4z"/></svg>',
 *
 *     // Font icon class (wrap in span)
 *     filter: '<span class="icon icon-filter"></span>',
 *   },
 * };
 * ```
 *
 * @see {@link IconValue} for allowed icon formats
 * @since 0.1.1
 */
export interface GridIcons {
  /** Expand icon for collapsed items (trees, groups, details). Default: '▶' */
  expand?: IconValue;
  /** Collapse icon for expanded items (trees, groups, details). Default: '▼' */
  collapse?: IconValue;
  /** Sort ascending indicator. Default: '▲' */
  sortAsc?: IconValue;
  /** Sort descending indicator. Default: '▼' */
  sortDesc?: IconValue;
  /** Sort neutral/unsorted indicator. Default: '⇅' */
  sortNone?: IconValue;
  /** Submenu arrow for context menus. Default: '▶' */
  submenuArrow?: IconValue;
  /** Drag handle icon for reordering. Default: '⋮⋮' */
  dragHandle?: IconValue;
  /** Tool panel toggle icon in toolbar. Default: '☰' */
  toolPanel?: IconValue;
  /** Filter icon in column headers. Default: SVG funnel icon */
  filter?: IconValue;
  /** Filter icon when filter is active. Default: same as filter with accent color */
  filterActive?: IconValue;
  /** Print icon for print button. Default: '🖨️' */
  print?: IconValue;
}

/** Default icons used when not overridden. Most entries are short text/emoji;
 * `filter` and `filterActive` are empty strings because the actual rendering
 * is driven by the `--tbw-icon-filter[-active]-mask` CSS custom properties
 * (see `core/styles/variables.css`). Userland that wants an HTML/SVG fallback
 * via `gridConfig.icons.filter = '<svg…>'` is unaffected — that path overrides this default. * @since 0.1.1
 */
export const DEFAULT_GRID_ICONS: Required<GridIcons> = {
  expand: '▶',
  collapse: '▼',
  sortAsc: '▲',
  sortDesc: '▼',
  sortNone: '⇅',
  submenuArrow: '▶',
  dragHandle: '⋮⋮',
  toolPanel: '☰',
  filter: '',
  filterActive: '',
  print: '🖨️',
};
// #endregion

// #region Shell Configuration

/**
 * Shell configuration for the grid's optional header bar and tool panels.
 *
 * The shell provides a wrapper around the grid with:
 * - Header bar with title, toolbar buttons, and custom content
 * - Collapsible side panel for filters, column visibility, settings, etc.
 *
 * @example
 * ```typescript
 * grid.gridConfig = {
 *   shell: {
 *     header: {
 *       title: 'Employee Directory',
 *     },
 *     toolPanel: {
 *       position: 'right',
 *       initialState: 'open',     // Sidebar open on load
 *       defaultOpen: 'columns',   // Auto-expand the "Columns" section
 *     },
 *   },
 *   plugins: [new VisibilityPlugin()], // Adds "Columns" panel
 * };
 *
 * // Register custom tool panels
 * grid.registerToolPanel({
 *   id: 'filters',
 *   title: 'Filters',
 *   icon: '🔍',
 *   render: (container) => {
 *     container.innerHTML = '<div>Filter controls...</div>';
 *   },
 * });
 * ```
 *
 * @see {@link ShellHeaderConfig} for header options
 * @see {@link ToolPanelConfig} for tool panel options
 * @since 0.1.1
 */
export interface ShellConfig {
  /** Shell header bar configuration */
  header?: ShellHeaderConfig;
  /** Tool panel configuration */
  toolPanel?: ToolPanelConfig;
  /**
   * Registered tool panels (from plugins, API, or Light DOM).
   * These are the actual panel definitions that can be opened.
   * @internal Set by ConfigManager during merge
   */
  toolPanels?: ToolPanelDefinition[];
  /**
   * Registered header content sections (from plugins or API).
   * Content rendered in the center of the shell header.
   * @internal Set by ConfigManager during merge
   */
  headerContents?: HeaderContentDefinition[];
}

/**
 * Shell header bar configuration
 * @since 0.1.1
 */
export interface ShellHeaderConfig {
  /** Grid title displayed on the left (optional) */
  title?: string;
  /** Custom toolbar content (rendered before tool panel toggle) */
  toolbarContents?: ToolbarContentDefinition[];
  /**
   * Whether the grid renders its built-in tool panel toggle button
   * (`button.tbw-toolbar-btn[data-panel-toggle]`) and the auto-inserted
   * `.tbw-toolbar-separator` between custom toolbar contents and the toggle.
   *
   * Set to `false` when you want to provide your own toggle button (e.g. a
   * design-system button styled to match your application). Wire your button
   * to call {@link Grid.toggleToolPanel} (or `toggleToolPanelSection(id)` for
   * a specific section). All tool panels remain functional; only the
   * built-in toggle button and adjacent separator are suppressed.
   *
   * @default true
   */
  toolPanelToggle?: boolean;
  /**
   * Light DOM header content elements (parsed from <tbw-grid-header> children).
   * @internal Set by ConfigManager during merge
   */
  lightDomContent?: HTMLElement[];
  /**
   * Whether a tool buttons container was found in light DOM.
   * @internal Set by ConfigManager during merge
   */
  hasToolButtonsContainer?: boolean;
}

/**
 * Tool panel configuration
 * @since 0.1.1
 */
export interface ToolPanelConfig {
  /** Panel position: 'left' | 'right' (default: 'right') */
  position?: 'left' | 'right';
  /** Default panel width in pixels (default: 280) */
  width?: number;
  /**
   * Accordion section to auto-expand the first time the tool panel opens.
   *
   * @deprecated **Behavior change planned for v3.0.0** — see [issue #259](https://github.com/OysteinAmundsen/toolbox/issues/259).
   *
   * Today (v2.x, kept for backward compatibility): setting `defaultOpen` also
   * **opens the sidebar** on grid load. This conflates "which section is
   * pre-selected" with "is the sidebar open", and there is no way to
   * pre-select a section without also forcing the sidebar open.
   *
   * In v3.0.0 (#259): `defaultOpen` will only pre-select which accordion
   * section auto-expands the first time the sidebar opens, and will no
   * longer open the sidebar by itself. Migrate by combining `defaultOpen`
   * with `initialState: 'open'` (or `locked: true`) when you want both
   * effects.
   *
   * Callers that want forward-compatible behavior today: prefer
   * `initialState` / `locked` for sidebar open state, and use `defaultOpen`
   * purely for section selection.
   *
   * @since 0.1.1
   */
  defaultOpen?: string;
  /**
   * Initial open state of the tool panel sidebar on grid load.
   *
   * - `'closed'` (default) — sidebar starts collapsed; user opens it via the
   *   built-in toggle button or `grid.openToolPanel()`.
   * - `'open'` — sidebar starts open; the section named by {@link defaultOpen}
   *   (or the first registered panel) is expanded.
   *
   * Takes precedence over the legacy v2 behavior of {@link defaultOpen}: if
   * `initialState` is set explicitly, it wins.
   *
   * @default 'closed'
   * @since 2.9.0
   */
  initialState?: 'open' | 'closed';
  /**
   * When `true`, lock the tool panel sidebar in its open state.
   *
   * Effects:
   * - Implies `initialState: 'open'` — the sidebar is forced open on load.
   * - `grid.closeToolPanel()` / `grid.toggleToolPanel()` become no-ops while
   *   locked (the panel cannot be closed by user or programmatic actions).
   * - Suppresses the built-in toolbar toggle button (same effect as
   *   `shell.header.toolPanelToggle: false`) since toggling is disabled.
   * - Accordion sections inside the panel can still be expanded/collapsed.
   *
   * @default false
   * @since 2.9.0
   */
  locked?: boolean;
  /** Whether to persist open/closed state (requires Column State Events) */
  persistState?: boolean;
  /**
   * Close the tool panel when clicking outside of it.
   * When `true`, clicking anywhere outside the tool panel (but inside the grid)
   * will close the panel automatically.
   *
   * Ignored in `mode: 'push'` (the panel does not overlap grid content,
   * so there is no meaningful "outside" to dismiss against).
   * @default false
   */
  closeOnClickOutside?: boolean;
  /**
   * Layout mode for the tool panel.
   *
   * - `'overlay'` (default) — panel is positioned over the grid content;
   *   opening/closing the panel does not change the grid's available width.
   *   Best for narrow viewports.
   * - `'push'` — panel participates in the shell's flex layout as a sibling
   *   of the grid content; opening the panel shrinks the grid's available
   *   width and triggers a normal column-virtualization re-layout via
   *   ResizeObserver. Best for desktop layouts where users want to keep
   *   all cells visible while the panel is open.
   *
   * @default 'overlay'
   * @since 2.8.0
   */
  mode?: 'overlay' | 'push';
}

/**
 * Toolbar content definition for the shell header toolbar area.
 * Register via `registerToolbarContent()` or use light DOM `<tbw-grid-tool-buttons>`.
 *
 * @example
 * ```typescript
 * grid.registerToolbarContent({
 *   id: 'my-toolbar',
 *   order: 10,
 *   render: (container) => {
 *     const btn = document.createElement('button');
 *     btn.textContent = 'Refresh';
 *     btn.onclick = () => console.log('clicked');
 *     container.appendChild(btn);
 *     return () => btn.remove();
 *   },
 * });
 * ```
 * @since 1.0.0
 */
export interface ToolbarContentDefinition {
  /** Unique content ID */
  id: string;
  /** Content factory - called once when shell header renders */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when content is removed (for cleanup) */
  onDestroy?: () => void;
  /** Order priority (lower = first, default: 100) */
  order?: number;
}

/**
 * Tool panel definition registered by plugins or consumers.
 *
 * Register via `grid.registerToolPanel()` to add panels to the sidebar.
 * Panels appear as collapsible sections with icons and titles.
 *
 * @example
 * ```typescript
 * grid.registerToolPanel({
 *   id: 'filters',
 *   title: 'Filters',
 *   icon: '🔍',
 *   tooltip: 'Filter grid data',
 *   order: 10, // Lower = appears first
 *   render: (container) => {
 *     container.innerHTML = `
 *       <div class="filter-panel">
 *         <input type="text" placeholder="Search..." />
 *       </div>
 *     `;
 *     // Return cleanup function
 *     return () => container.innerHTML = '';
 *   },
 *   onClose: () => {
 *     console.log('Filter panel closed');
 *   },
 * });
 * ```
 *
 * @see {@link ShellConfig} for shell configuration
 * @since 0.1.1
 */
export interface ToolPanelDefinition {
  /** Unique panel ID */
  id: string;
  /** Panel title shown in accordion header */
  title: string;
  /** Icon for accordion section header (optional, emoji or SVG) */
  icon?: string;
  /** Tooltip for accordion section header */
  tooltip?: string;
  /** Panel content factory - called when panel section opens */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when panel closes (for cleanup) */
  onClose?: () => void;
  /** Panel order priority (lower = first, default: 100) */
  order?: number;
}

/**
 * Header content definition for plugins contributing to shell header center section.
 *
 * Register via `grid.registerHeaderContent()` to add content between
 * the title and toolbar buttons.
 *
 * @example
 * ```typescript
 * grid.registerHeaderContent({
 *   id: 'row-count',
 *   order: 10,
 *   render: (container) => {
 *     const span = document.createElement('span');
 *     span.className = 'row-count';
 *     span.textContent = `${grid.rows.length} rows`;
 *     container.appendChild(span);
 *
 *     // Update on data changes
 *     const unsub = grid.on('data-change', () => {
 *       span.textContent = `${grid.rows.length} rows`;
 *     });
 *
 *     return () => {
 *       unsub();
 *     };
 *   },
 * });
 * ```
 *
 * @see {@link ShellConfig} for shell configuration
 * @since 0.1.1
 */
export interface HeaderContentDefinition {
  /** Unique content ID */
  id: string;
  /** Content factory - called once when shell header renders */
  render: (container: HTMLElement) => void | (() => void);
  /** Called when content is removed (for cleanup) */
  onDestroy?: () => void;
  /** Order priority (lower = first, default: 100) */
  order?: number;
}
// #endregion

// #region Column State (Persistence)

/**
 * State for a single column. Captures user-driven changes at runtime.
 * Plugins can extend this interface via module augmentation to add their own state.
 *
 * Used with `grid.getColumnState()` and `grid.columnState` for persisting
 * user customizations (column widths, order, visibility, sort).
 *
 * @example
 * ```typescript
 * // Save column state to localStorage
 * const state = grid.getColumnState();
 * localStorage.setItem('gridState', JSON.stringify(state));
 *
 * // Restore on page load
 * const saved = localStorage.getItem('gridState');
 * if (saved) grid.applyColumnState(JSON.parse(saved));
 *
 * // Example column state structure
 * const state: GridColumnState = {
 *   columns: [
 *     { field: 'name', order: 0, width: 200, hidden: false },
 *     { field: 'email', order: 1, width: 300, hidden: false },
 *     { field: 'phone', order: 2, hidden: true }, // Hidden column
 *   ],
 *   sort: { field: 'name', direction: 1 },
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Plugin augmentation example (in filtering plugin)
 * declare module '@toolbox-web/grid' {
 *   interface ColumnState {
 *     filter?: FilterValue;
 *   }
 * }
 * ```
 *
 * @see {@link GridColumnState} for the full state object
 * @since 0.1.1
 */
export interface ColumnState {
  /** Column field identifier */
  field: string;
  /** Position index after reordering (0-based) */
  order: number;
  /** Width in pixels (undefined = use default) */
  width?: number;
  /** Visibility state */
  visible: boolean;
  /** Sort state (undefined = not sorted). */
  sort?: ColumnSortState;
}

/**
 * Sort state for a column.
 * Used within {@link ColumnState} to track sort direction and priority.
 *
 * @see {@link ColumnState} for column state persistence
 * @see {@link SortChangeDetail} for sort change events
 * @since 0.1.1
 */
export interface ColumnSortState {
  /** Sort direction */
  direction: 'asc' | 'desc';
  /** Priority for multi-sort (0 = primary, 1 = secondary, etc.) */
  priority: number;
}

/**
 * Complete grid column state for persistence.
 * Contains state for all columns, including plugin-contributed properties.
 *
 * @example
 * ```typescript
 * // Save state
 * const state = grid.getColumnState();
 * localStorage.setItem('grid-state', JSON.stringify(state));
 *
 * // Restore state
 * grid.applyColumnState(JSON.parse(localStorage.getItem('grid-state')));
 * ```
 *
 * @see {@link ColumnState} for individual column state
 * @see {@link PublicGrid.getColumnState} for retrieving state
 * @since 0.1.1
 */
export interface GridColumnState {
  /** Array of column states. */
  columns: ColumnState[];
}
// #endregion

// #region Public Event Detail Interfaces
/**
 * Detail for a cell click event.
 * Provides full context about the clicked cell including row data.
 *
 * @example
 * ```typescript
 * grid.on('cell-click', ({ row, field, value, rowIndex, colIndex }) => {
 *   console.log(`Clicked ${field} = ${value} in row ${rowIndex}`);
 *
 *   // Access the full row data
 *   if (row.status === 'pending') {
 *     showApprovalDialog(row);
 *   }
 * });
 * ```
 *
 * @category Events
 * @since 1.0.0
 */
export interface CellClickDetail<TRow = unknown> {
  /** Zero-based row index of the clicked cell. */
  rowIndex: number;
  /** Zero-based column index of the clicked cell. */
  colIndex: number;
  /** Column configuration object for the clicked cell. */
  column: ColumnConfig<TRow>;
  /** Field name of the clicked column. */
  field: string;
  /** Cell value at the clicked position. */
  value: unknown;
  /** Full row data object. */
  row: TRow;
  /** The clicked cell element. */
  cellEl: HTMLElement;
  /** The original mouse event. */
  originalEvent: MouseEvent;
}

/**
 * Detail for a row click event.
 * Provides context about the clicked row.
 *
 * @example
 * ```typescript
 * grid.on('row-click', ({ row, rowIndex, rowEl }) => {
 *   console.log(`Clicked row ${rowIndex}: ${row.name}`);
 *
 *   // Highlight the row
 *   rowEl.classList.add('selected');
 *
 *   // Open detail panel
 *   showDetailPanel(row);
 * });
 * ```
 *
 * @category Events
 * @since 1.0.0
 */
export interface RowClickDetail<TRow = unknown> {
  /** Zero-based row index of the clicked row. */
  rowIndex: number;
  /** Full row data object. */
  row: TRow;
  /** The clicked row element. */
  rowEl: HTMLElement;
  /** The original mouse event. */
  originalEvent: MouseEvent;
}

/**
 * Detail for a sort change (direction 0 indicates cleared sort).
 *
 * @example
 * ```typescript
 * grid.on('sort-change', ({ field, direction }) => {
 *   if (direction === 0) {
 *     console.log(`Sort cleared on ${field}`);
 *   } else {
 *     const dir = direction === 1 ? 'ascending' : 'descending';
 *     console.log(`Sorted by ${field} ${dir}`);
 *   }
 *
 *   // Fetch sorted data from server
 *   fetchData({ sortBy: field, sortDir: direction });
 * });
 * ```
 *
 * @see {@link SortState} for the sort state object
 * @see {@link SortHandler} for custom sort handlers
 * @category Events
 * @since 0.1.1
 */
export interface SortChangeDetail {
  /** Sorted field key. */
  field: string;
  /** Direction: 1 ascending, -1 descending, 0 cleared. */
  direction: 1 | -1 | 0;
}

/**
 * Column resize event detail containing final pixel width.
 *
 * @example
 * ```typescript
 * grid.on('column-resize', ({ field, width }) => {
 *   console.log(`Column ${field} resized to ${width}px`);
 *
 *   // Persist to user preferences
 *   saveColumnWidth(field, width);
 * });
 * ```
 *
 * @see {@link ColumnState} for persisting column state
 * @see {@link ResizeController} for resize implementation
 * @category Events
 * @since 0.1.1
 */
export interface ColumnResizeDetail {
  /** Resized column field key. */
  field: string;
  /** New width in pixels. */
  width: number;
}

/**
 * Column resize-reset event detail.
 *
 * Fired when a user-resized column is restored to its original configured width
 * (e.g., via the column header context menu "Reset width" action). The `width`
 * field reflects the column's `__originalWidth` and may be `undefined` if the
 * column was originally auto-sized.
 *
 * @example
 * ```typescript
 * grid.on('column-resize-reset', ({ field, width }) => {
 *   if (width === undefined) {
 *     console.log(`Column ${field} restored to auto-size`);
 *   } else {
 *     console.log(`Column ${field} restored to ${width}px`);
 *   }
 * });
 * ```
 *
 * @see {@link ColumnResizeDetail} for the resize-in-progress event
 * @category Events
 * @since 2.6.0
 */
export interface ColumnResizeResetDetail {
  /** Reset column field key. */
  field: string;
  /** Original configured width in pixels, or `undefined` if auto-sized. */
  width: number | undefined;
}

/**
 * Trigger type for cell activation.
 * - `'keyboard'`: Enter key pressed on focused cell
 * - `'pointer'`: Mouse/touch/pen click on cell
 *
 * @see {@link CellActivateDetail} for the activation event detail
 * @category Events
 * @since 1.0.0
 */
export type CellActivateTrigger = 'keyboard' | 'pointer';

/**
 * Fired when a cell is activated by user interaction (Enter key or click).
 * Unified event for both keyboard and pointer activation.
 *
 * @example
 * ```typescript
 * grid.on('cell-activate', ({ row, field, value, trigger, cellEl }, event) => {
 *   if (trigger === 'keyboard') {
 *     console.log('Activated via Enter key');
 *   } else {
 *     console.log('Activated via click/tap');
 *   }
 *
 *   // Start custom editing for specific columns
 *   if (field === 'notes') {
 *     event.preventDefault(); // Prevent default editing
 *     openNotesEditor(row, cellEl);
 *   }
 * });
 * ```
 *
 * @see {@link CellClickDetail} for click-only events
 * @see {@link CellActivateTrigger} for trigger types
 * @category Events
 * @since 1.0.0
 */
export interface CellActivateDetail<TRow = unknown> {
  /** Zero-based row index of the activated cell. */
  rowIndex: number;
  /** Zero-based column index of the activated cell. */
  colIndex: number;
  /** Field name of the activated column. */
  field: string;
  /** Cell value at the activated position. */
  value: unknown;
  /** Full row data object. */
  row: TRow;
  /** The activated cell element. */
  cellEl: HTMLElement;
  /** What triggered the activation. */
  trigger: CellActivateTrigger;
  /** The original event (KeyboardEvent for keyboard, MouseEvent/PointerEvent for pointer). */
  originalEvent: KeyboardEvent | MouseEvent | PointerEvent;
}

/**
 * Event detail for mounting external view renderers.
 *
 * Emitted when a cell uses an external component spec (React, Angular, Vue)
 * and needs the framework adapter to mount the component.
 *
 * @example
 * ```typescript
 * // Framework adapter listens for this event
 * grid.on('mount-external-view', ({ placeholder, spec, context }) => {
 *   // Mount framework component into placeholder
 *   mountComponent(spec.component, placeholder, context);
 * });
 * ```
 *
 * @see {@link ColumnConfig.externalView} for external view spec
 * @see {@link FrameworkAdapter} for adapter interface
 * @category Framework Adapters
 * @since 0.1.1
 */
export interface ExternalMountViewDetail<TRow = unknown> {
  placeholder: HTMLElement;
  spec: unknown;
  context: { row: TRow; value: unknown; field: string; column: unknown };
}

/**
 * Event detail for mounting external editor renderers.
 *
 * Emitted when a cell uses an external editor component spec and needs
 * the framework adapter to mount the editor with commit/cancel bindings.
 *
 * @example
 * ```typescript
 * // Framework adapter listens for this event
 * grid.on('mount-external-editor', ({ placeholder, spec, context }) => {
 *   // Mount framework editor with commit/cancel wired
 *   mountEditor(spec.component, placeholder, {
 *     value: context.value,
 *     onCommit: context.commit,
 *     onCancel: context.cancel,
 *   });
 * });
 * ```
 *
 * @see {@link ColumnEditorSpec} for external editor spec
 * @see {@link FrameworkAdapter} for adapter interface
 * @category Framework Adapters
 * @since 0.1.1
 */
export interface ExternalMountEditorDetail<TRow = unknown> {
  placeholder: HTMLElement;
  spec: unknown;
  context: {
    row: TRow;
    value: unknown;
    field: string;
    column: unknown;
    commit: (v: unknown) => void;
    cancel: () => void;
  };
}

/**
 * Maps event names to their detail payload types.
 *
 * Used by {@link DataGridElement.on | grid.on()} and `addEventListener()` for
 * fully typed event handling. Plugins extend this map via module augmentation.
 *
 * @example
 * ```typescript
 * // Recommended: grid.on() auto-unwraps the detail
 * const off = grid.on('cell-click', ({ field, value, row }) => {
 *   console.log(`Clicked ${field} = ${value}`);
 * });
 * off(); // unsubscribe
 *
 * // addEventListener works too (useful for { once, signal, capture })
 * grid.addEventListener('cell-click', (e) => {
 *   console.log(e.detail.field);
 * }, { once: true });
 * ```
 *
 * @see {@link DataGridElement.on} for the recommended subscription API
 * @see {@link DataGridCustomEvent} for typed CustomEvent wrapper
 * @category Events
 * @since 0.1.1
 */
export interface DataGridEventMap<TRow = unknown> {
  /**
   * Fired when a cell is clicked.
   * Provides full context: row data, column config, cell element, and the original mouse event.
   *
   * @example
   * ```typescript
   * grid.on('cell-click', ({ row, field, value, cellEl }) => {
   *   console.log(`Clicked ${field} = ${value}`);
   *
   *   // Open a detail dialog for a specific column
   *   if (field === 'avatar') {
   *     showImagePreview(row.avatarUrl, cellEl);
   *   }
   * });
   * ```
   *
   * @see {@link CellClickDetail}
   * @group Core Events
   */
  'cell-click': CellClickDetail<TRow>;

  /**
   * Fired when a row is clicked (anywhere on the row).
   * Use for row-level actions like opening a detail panel or navigating.
   *
   * @example
   * ```typescript
   * grid.on('row-click', ({ row, rowIndex }) => {
   *   console.log(`Row ${rowIndex}: ${row.name}`);
   *
   *   // Navigate to detail page
   *   router.navigate(`/employees/${row.id}`);
   * });
   * ```
   *
   * @see {@link RowClickDetail}
   * @group Core Events
   */
  'row-click': RowClickDetail<TRow>;

  /**
   * Fired when a cell is activated by Enter key or pointer click.
   * Unified event for both keyboard and pointer activation.
   *
   * Call `event.preventDefault()` to suppress default behavior (e.g., inline editing).
   *
   * @example
   * ```typescript
   * grid.on('cell-activate', ({ row, field, trigger, cellEl }, event) => {
   *   // Custom editing for a specific column
   *   if (field === 'notes') {
   *     event.preventDefault();
   *     openRichTextEditor(row, cellEl);
   *   }
   *
   *   console.log(`Activated via ${trigger}`); // 'keyboard' | 'pointer'
   * });
   * ```
   *
   * @see {@link CellActivateDetail}
   * @see {@link CellActivateTrigger}
   * @group Core Events
   */
  'cell-activate': CellActivateDetail<TRow>;

  /**
   * Fired after any data mutation — user edits, cascade updates, or API calls.
   * This is an informational event for logging, auditing, or cascading updates
   * to related fields. Check `source` to distinguish edit origins.
   *
   * @example
   * ```typescript
   * grid.on('cell-change', ({ row, rowId, field, oldValue, newValue, source }) => {
   *   console.log(`${field}: ${oldValue} → ${newValue} (${source})`);
   *
   *   // Cascade: recalculate total when quantity changes
   *   if (source === 'user' && field === 'quantity') {
   *     grid.updateRow(rowId, { total: newValue * row.price });
   *   }
   * });
   * ```
   *
   * @see {@link CellChangeDetail}
   * @see {@link UpdateSource}
   * @group Core Events
   */
  'cell-change': CellChangeDetail<TRow>;

  /**
   * Fired whenever the grid's row data changes — new data assignment,
   * row insertion/removal, or in-place mutations via `updateRow()`.
   * Use to keep external UI (row counts, summaries, charts) in sync.
   *
   * @example
   * ```typescript
   * grid.on('data-change', ({ rowCount, sourceRowCount }) => {
   *   statusBar.textContent = `${rowCount} of ${sourceRowCount} rows`;
   * });
   * ```
   *
   * @see {@link DataChangeDetail}
   * @group Core Events
   */
  'data-change': DataChangeDetail;

  /**
   * Fired when the grid's viewport is scrolled vertically (rAF-batched).
   * Use to trigger pagination, defer heavy cell content, dismiss overlays,
   * or sync external UI to the grid's scroll position.
   *
   * For server-side pagination of large datasets, prefer the
   * `ServerSidePlugin` — it handles block fetching out of the box.
   *
   * @example
   * ```typescript
   * // Infinite scroll
   * grid.on('tbw-scroll', ({ scrollTop, scrollHeight, clientHeight }) => {
   *   if (scrollTop + clientHeight >= scrollHeight - 200) loadMore();
   * });
   *
   * // Defer heavy cell content (Angular @defer style)
   * grid.on('tbw-scroll', ({ scrollTop }) => {
   *   updateVisibleHeavyCells(scrollTop);
   * });
   *
   * // Dismiss tooltip/popover on scroll
   * grid.on('tbw-scroll', () => closeOpenOverlays());
   * ```
   *
   * @see {@link TbwScrollDetail}
   * @group Core Events
   */
  'tbw-scroll': TbwScrollDetail;

  /**
   * Emitted when a cell with an external view renderer (React, Angular, Vue component)
   * needs to be mounted. Framework adapters listen for this event internally.
   *
   * @example
   * ```typescript
   * // Custom framework adapter
   * grid.on('mount-external-view', ({ placeholder, spec, context }) => {
   *   myFramework.render(spec.component, placeholder, {
   *     row: context.row,
   *     value: context.value,
   *   });
   * });
   * ```
   *
   * @see {@link ExternalMountViewDetail}
   * @see {@link FrameworkAdapter}
   * @group Framework Adapter Events
   */
  'mount-external-view': ExternalMountViewDetail<TRow>;

  /**
   * Emitted when a cell with an external editor component (React, Angular, Vue)
   * needs to be mounted with commit/cancel bindings. Framework adapters listen
   * for this event internally.
   *
   * @example
   * ```typescript
   * // Custom framework adapter
   * grid.on('mount-external-editor', ({ placeholder, spec, context }) => {
   *   myFramework.render(spec.component, placeholder, {
   *     value: context.value,
   *     onSave: context.commit,
   *     onCancel: context.cancel,
   *   });
   * });
   * ```
   *
   * @see {@link ExternalMountEditorDetail}
   * @see {@link FrameworkAdapter}
   * @group Framework Adapter Events
   */
  'mount-external-editor': ExternalMountEditorDetail<TRow>;

  /**
   * Fired when the sort state changes — column header click, programmatic sort,
   * or sort cleared. `direction: 0` indicates the sort was removed.
   *
   * @example
   * ```typescript
   * grid.on('sort-change', ({ field, direction }) => {
   *   if (direction === 0) {
   *     console.log('Sort cleared');
   *   } else {
   *     console.log(`Sorted by ${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
   *   }
   *
   *   // Server-side sorting
   *   fetchData({ sortBy: field, sortDir: direction });
   * });
   * ```
   *
   * @see {@link SortChangeDetail}
   * @see {@link SortHandler}
   * @group Core Events
   */
  'sort-change': SortChangeDetail;

  /**
   * Fired when a column is resized by the user dragging the resize handle.
   * Use to persist column widths to user preferences or localStorage.
   *
   * @example
   * ```typescript
   * grid.on('column-resize', ({ field, width }) => {
   *   console.log(`Column "${field}" resized to ${width}px`);
   *
   *   // Persist to localStorage
   *   const widths = JSON.parse(localStorage.getItem('col-widths') ?? '{}');
   *   widths[field] = width;
   *   localStorage.setItem('col-widths', JSON.stringify(widths));
   * });
   * ```
   *
   * @see {@link ColumnResizeDetail}
   * @group Core Events
   */
  'column-resize': ColumnResizeDetail;

  /**
   * Fired when a user-resized column is reset to its original configured width.
   * Triggered by the column header context menu "Reset width" action.
   *
   * @example
   * ```typescript
   * grid.on('column-resize-reset', ({ field, width }) => {
   *   const widths = JSON.parse(localStorage.getItem('col-widths') ?? '{}');
   *   delete widths[field];
   *   localStorage.setItem('col-widths', JSON.stringify(widths));
   * });
   * ```
   *
   * @see {@link ColumnResizeResetDetail}
   * @group Core Events
   */
  'column-resize-reset': ColumnResizeResetDetail;

  /**
   * Fired when column state changes — reordering, resizing, visibility toggle,
   * or sort changes. Use with `getColumnState()` / `columnState` setter for
   * full state persistence.
   *
   * @example
   * ```typescript
   * grid.on('column-state-change', (state) => {
   *   localStorage.setItem('grid-state', JSON.stringify(state));
   *   console.log(`${state.columns.length} columns in state`);
   * });
   *
   * // Restore on load
   * const saved = localStorage.getItem('grid-state');
   * if (saved) grid.applyColumnState(JSON.parse(saved));
   * ```
   *
   * @see {@link GridColumnState}
   * @see {@link ColumnState}
   * @group Core Events
   */
  'column-state-change': GridColumnState;

  // Note: 'cell-commit', 'row-commit', 'changed-rows-reset' are added via
  // module augmentation by EditingPlugin when imported
}

/**
 * Extracts the event detail type for a given event name.
 *
 * Utility type for getting the detail payload type of a specific event.
 *
 * @example
 * ```typescript
 * // Extract detail type for specific event
 * type ClickDetail = DataGridEventDetail<'cell-click', Employee>;
 * // Equivalent to: CellClickDetail<Employee>
 *
 * // Use in generic handler
 * function logDetail<K extends keyof DataGridEventMap>(
 *   eventName: K,
 *   detail: DataGridEventDetail<K>,
 * ): void {
 *   console.log(`${eventName}:`, detail);
 * }
 * ```
 *
 * @see {@link DataGridEventMap} for all event types
 * @category Events
 */
export type DataGridEventDetail<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = DataGridEventMap<TRow>[K];

/**
 * Custom event type for DataGrid events with typed detail payload.
 *
 * Primarily useful when you need to declare handler parameters with
 * `addEventListener`. For most use cases, prefer {@link DataGridElement.on | grid.on()}
 * which handles typing automatically.
 *
 * @example
 * ```typescript
 * // Typed handler for addEventListener
 * function onCellClick(e: DataGridCustomEvent<'cell-click', Employee>): void {
 *   const { row, field, value } = e.detail;
 *   console.log(`Clicked ${field} = ${value} on ${row.name}`);
 * }
 * grid.addEventListener('cell-click', onCellClick);
 *
 * // With grid.on() you don't need this type — it's inferred:
 * grid.on('cell-click', ({ row, field, value }) => {
 *   console.log(`Clicked ${field} = ${value} on ${row.name}`);
 * });
 * ```
 *
 * @see {@link DataGridElement.on} for the recommended subscription API
 * @see {@link DataGridEventMap} for all event types
 * @see `DataGridEventDetail` for extracting detail type only
 * @category Events
 * @since 0.1.1
 */
export type DataGridCustomEvent<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = CustomEvent<
  DataGridEventMap<TRow>[K]
>;

/**
 * Template evaluation context for dynamic templates.
 *
 * @category Plugin Development
 * @since 0.1.1
 */
export interface EvalContext {
  value: unknown;
  row: Record<string, unknown> | null;
}
// #endregion

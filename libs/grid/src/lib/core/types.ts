import type { RowPosition } from './internal/virtualization';
import type { PluginQuery } from './plugin/base-plugin';
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

// #region DataGridElement Interface
/**
 * The compiled web component interface for DataGrid.
 *
 * This interface represents the `<tbw-grid>` custom element, combining
 * the public grid API with standard HTMLElement functionality.
 *
 * @example
 * ```typescript
 * // Query existing grid
 * const grid = document.querySelector('tbw-grid') as DataGridElement<Employee>;
 * grid.rows = employees;
 * grid.addEventListener('cell-click', (e) => console.log(e.detail));
 *
 * // Create grid programmatically
 * import { createGrid } from '@toolbox-web/grid';
 * const grid = createGrid<Employee>({
 *   columns: [{ field: 'name' }, { field: 'email' }],
 * });
 * document.body.appendChild(grid);
 * ```
 *
 * @see {@link PublicGrid} for the public API methods and properties
 * @see {@link createGrid} for typed grid creation
 * @see {@link queryGrid} for typed grid querying
 */
export interface DataGridElement extends PublicGrid, HTMLElement {}
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
   * @example
   * ```typescript
   * const selection = grid.getPlugin(SelectionPlugin);
   * if (selection) {
   *   selection.selectAll();
   * }
   * ```
   */
  getPlugin?<P>(PluginClass: new (...args: any[]) => P): P | undefined;
  /**
   * Get a plugin instance by its name.
   * Prefer `getPlugin(PluginClass)` for type safety.
   */
  getPluginByName?(name: string): GridPlugin | undefined;

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
   */
  openToolPanel?(): void;
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
   * Set/restore the column state.
   * Can be set before or after grid initialization.
   *
   * @example
   * ```typescript
   * const saved = localStorage.getItem('gridState');
   * if (saved) {
   *   grid.columnState = JSON.parse(saved);
   * }
   * ```
   */
  columnState?: GridColumnState;

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
 */
export interface InternalGrid<T = any> extends PublicGrid<T>, GridConfig<T> {
  // Element methods available because DataGridElement extends HTMLElement
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
  effectiveConfig?: GridConfig<T>;
  findHeaderRow?: () => HTMLElement;
  refreshVirtualWindow: (full: boolean, skipAfterRender?: boolean) => boolean;
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
  _dispatchHeaderClick?: (event: MouseEvent, col: ColumnConfig, headerEl: HTMLElement) => boolean;
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
  /** Query all plugins with a generic query and collect responses */
  queryPlugins?: <T>(query: PluginQuery) => T[];
  /** Request emission of column-state-change event (debounced) */
  requestStateChange?: () => void;
}
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
  /** For select type - available options */
  options?: Array<{ label: string; value: unknown }> | (() => Array<{ label: string; value: unknown }>);
  /** For select - allow multi select */
  multi?: boolean;
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
  /** Arbitrary extra metadata */
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
   * ```
   */
  cellClass?: (value: unknown, row: TRow, column: ColumnConfig<TRow>) => string[];

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
   * grid.addEventListener('cell-commit', (e) => {
   *   if (e.detail.field === 'quantity') {
   *     e.detail.updateRow({ total: e.detail.row.price * e.detail.value });
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
   */
  createRenderer<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnViewRenderer<TRow, TValue>;

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
   * @returns Type defaults for renderer/editor, or undefined if not registered
   */
  getTypeDefault?<TRow = unknown>(type: string): TypeDefault<TRow> | undefined;

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
 *   groupBy: ['department', 'team'],
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
 * @example
 * ```typescript
 * // Built-in aggregator
 * { field: 'amount', aggregator: 'sum' }
 *
 * // Custom aggregator function
 * { field: 'price', aggregator: (rows, field) => {
 *   const values = rows.map(r => r[field]).filter(v => v != null);
 *   return values.length ? Math.max(...values) : null;
 * }}
 * ```
 *
 * @see {@link RowGroupRenderConfig} for using aggregators in group rows
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
 */
export const FitModeEnum = {
  STRETCH: 'stretch',
  FIXED: 'fixed',
} as const;
export type FitMode = (typeof FitModeEnum)[keyof typeof FitModeEnum]; // evaluates to 'stretch' | 'fixed'
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
 * // Accessing plugin instance at runtime
 * const selection = grid.getPlugin(SelectionPlugin);
 * if (selection) {
 *   selection.selectAll();
 * }
 * ```
 *
 * @category Plugin Development
 */
export interface GridPlugin {
  /** Unique plugin identifier */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** CSS styles to inject into the grid */
  readonly styles?: string;
}
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
   * ```
   */
  rowClass?: (row: TRow) => string[];
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
   * Provides consistent icons across all plugins (tree, grouping, sorting, etc.).
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
   * Custom sort handler for full control over sorting behavior.
   *
   * When provided, this handler is called instead of the built-in sorting logic.
   * Enables custom sorting algorithms, server-side sorting, or plugin-specific sorting.
   *
   * The handler receives:
   * - `rows`: Current row array to sort
   * - `sortState`: Sort field and direction (1 = asc, -1 = desc)
   * - `columns`: Column configurations (for accessing sortComparator)
   *
   * Return the sorted array (sync) or a Promise that resolves to the sorted array (async).
   * For server-side sorting, return a Promise that resolves when data is fetched.
   *
   * @example
   * ```ts
   * // Custom stable sort
   * sortHandler: (rows, state, cols) => {
   *   return stableSort(rows, (a, b) => compare(a[state.field], b[state.field]) * state.direction);
   * }
   *
   * // Server-side sorting
   * sortHandler: async (rows, state) => {
   *   const response = await fetch(`/api/data?sort=${state.field}&dir=${state.direction}`);
   *   return response.json();
   * }
   * ```
   */
  sortHandler?: SortHandler<TRow>;

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
   * @example
   * ```ts
   * gridConfig = { gridAriaLabel: 'Employee data' };
   * ```
   */
  gridAriaLabel?: string;

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
}
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
 * Enables full control over sorting behavior including server-side sorting,
 * custom algorithms, or multi-column sorting.
 *
 * @param rows - Current row array to sort
 * @param sortState - Sort field and direction
 * @param columns - Column configurations (for accessing sortComparator)
 * @returns Sorted array (sync) or Promise resolving to sorted array (async)
 *
 * @example
 * ```typescript
 * // Custom client-side sort with locale awareness
 * const localeSortHandler: SortHandler<Employee> = (rows, state, cols) => {
 *   const col = cols.find(c => c.field === state.field);
 *   return [...rows].sort((a, b) => {
 *     const aVal = String(a[state.field] ?? '');
 *     const bVal = String(b[state.field] ?? '');
 *     return aVal.localeCompare(bVal) * state.direction;
 *   });
 * };
 *
 * // Server-side sorting
 * const serverSortHandler: SortHandler<Employee> = async (rows, state) => {
 *   const response = await fetch(
 *     `/api/employees?sortBy=${state.field}&dir=${state.direction}`
 *   );
 *   return response.json();
 * };
 *
 * grid.gridConfig = {
 *   sortHandler: localeSortHandler,
 * };
 * ```
 *
 * @see {@link SortState} for the sort state object
 * @see {@link GridConfig.sortHandler} for configuring the handler
 * @see {@link BaseColumnConfig.sortComparator} for column-level comparators
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
 */
export type LoadingRenderer = (context: LoadingContext) => HTMLElement | string;

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
 * grid.addEventListener('cell-change', (e) => {
 *   const { source, field, newValue } = e.detail;
 *
 *   // Only cascade updates for user edits
 *   if (source === 'user' && field === 'price') {
 *     // Update calculated field (marked as 'cascade')
 *     grid.updateRow(e.detail.rowId, {
 *       total: newValue * e.detail.row.quantity,
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
 * grid.addEventListener('cell-change', (e: CustomEvent<CellChangeDetail>) => {
 *   const { row, rowId, field, oldValue, newValue, source } = e.detail;
 *
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
 * @see {@link CellCommitDetail} for the commit event (editing lifecycle)
 * @category Events
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
 */
export interface RowUpdate<TRow = unknown> {
  /** Row identifier (from getRowId) */
  id: string;
  /** Fields to update */
  changes: Partial<TRow>;
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

/** Default animation configuration */
export const DEFAULT_ANIMATION_CONFIG: Required<Omit<AnimationConfig, 'sort'>> = {
  mode: 'reduced-motion',
  duration: 200,
  easing: 'ease-out',
};

// #endregion

// #region Grid Icons

/** Icon value - can be a string (text/HTML) or HTMLElement */
export type IconValue = string | HTMLElement;

/**
 * Grid-wide icon configuration.
 * All icons are optional - sensible defaults are used when not specified.
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

/** Default filter icon SVG */
const DEFAULT_FILTER_ICON =
  '<svg viewBox="0 0 16 16" width="12" height="12"><path fill="currentColor" d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/></svg>';

/** Default icons used when not overridden */
export const DEFAULT_GRID_ICONS: Required<GridIcons> = {
  expand: '▶',
  collapse: '▼',
  sortAsc: '▲',
  sortDesc: '▼',
  sortNone: '⇅',
  submenuArrow: '▶',
  dragHandle: '⋮⋮',
  toolPanel: '☰',
  filter: DEFAULT_FILTER_ICON,
  filterActive: DEFAULT_FILTER_ICON,
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
 *       defaultOpen: 'columns', // Open by default
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
 */
export interface ShellHeaderConfig {
  /** Grid title displayed on the left (optional) */
  title?: string;
  /** Custom toolbar content (rendered before tool panel toggle) */
  toolbarContents?: ToolbarContentDefinition[];
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
 */
export interface ToolPanelConfig {
  /** Panel position: 'left' | 'right' (default: 'right') */
  position?: 'left' | 'right';
  /** Default panel width in pixels (default: 280) */
  width?: number;
  /** Panel ID to open by default on load */
  defaultOpen?: string;
  /** Whether to persist open/closed state (requires Column State Events) */
  persistState?: boolean;
  /**
   * Close the tool panel when clicking outside of it.
   * When `true`, clicking anywhere outside the tool panel (but inside the grid)
   * will close the panel automatically.
   * @default false
   */
  closeOnClickOutside?: boolean;
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
 *     const update = () => span.textContent = `${grid.rows.length} rows`;
 *     grid.addEventListener('data-change', update);
 *
 *     return () => {
 *       grid.removeEventListener('data-change', update);
 *     };
 *   },
 * });
 * ```
 *
 * @see {@link ShellConfig} for shell configuration
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
 * if (saved) {
 *   grid.columnState = JSON.parse(saved);
 * }
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
 * grid.columnState = JSON.parse(localStorage.getItem('grid-state'));
 * ```
 *
 * @see {@link ColumnState} for individual column state
 * @see {@link PublicGrid.getColumnState} for retrieving state
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
 * grid.addEventListener('cell-click', (e: CustomEvent<CellClickDetail>) => {
 *   const { row, field, value, rowIndex, colIndex } = e.detail;
 *   console.log(`Clicked ${field} = ${value} in row ${rowIndex}`);\n *
 *   // Access the full row data
 *   if (row.status === 'pending') {
 *     showApprovalDialog(row);
 *   }
 * });
 * ```
 *
 * @category Events
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
 * grid.addEventListener('row-click', (e: CustomEvent<RowClickDetail>) => {
 *   const { row, rowIndex, rowEl } = e.detail;
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
 * grid.addEventListener('sort-change', (e: CustomEvent<SortChangeDetail>) => {
 *   const { field, direction } = e.detail;
 *
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
 * grid.addEventListener('column-resize', (e: CustomEvent<ColumnResizeDetail>) => {
 *   const { field, width } = e.detail;
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
 */
export interface ColumnResizeDetail {
  /** Resized column field key. */
  field: string;
  /** New width in pixels. */
  width: number;
}

/**
 * Trigger type for cell activation.
 * - `'keyboard'`: Enter key pressed on focused cell
 * - `'pointer'`: Mouse/touch/pen click on cell
 *
 * @see {@link CellActivateDetail} for the activation event detail
 * @category Events
 */
export type CellActivateTrigger = 'keyboard' | 'pointer';

/**
 * Fired when a cell is activated by user interaction (Enter key or click).
 * Unified event for both keyboard and pointer activation.
 *
 * @example
 * ```typescript
 * grid.addEventListener('cell-activate', (e: CustomEvent<CellActivateDetail>) => {
 *   const { row, field, value, trigger, cellEl } = e.detail;
 *
 *   if (trigger === 'keyboard') {
 *     console.log('Activated via Enter key');
 *   } else {
 *     console.log('Activated via click/tap');
 *   }
 *
 *   // Start custom editing for specific columns
 *   if (field === 'notes') {
 *     openNotesEditor(row, cellEl);
 *     e.preventDefault(); // Prevent default editing
 *   }
 * });
 * ```
 *
 * @see {@link CellClickDetail} for click-only events
 * @see {@link CellActivateTrigger} for trigger types
 * @category Events
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
 * @deprecated Use `CellActivateDetail` instead. Will be removed in next major version.
 * Kept for backwards compatibility.
 *
 * @category Events
 */
export interface ActivateCellDetail {
  /** Zero-based row index now focused. */
  row: number;
  /** Zero-based column index now focused. */
  col: number;
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
 * grid.addEventListener('mount-external-view', (e: CustomEvent<ExternalMountViewDetail>) => {
 *   const { placeholder, spec, context } = e.detail;
 *   // Mount framework component into placeholder
 *   mountComponent(spec.component, placeholder, context);
 * });
 * ```
 *
 * @see {@link ColumnConfig.externalView} for external view spec
 * @see {@link FrameworkAdapter} for adapter interface
 * @category Framework Adapters
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
 * grid.addEventListener('mount-external-editor', (e: CustomEvent<ExternalMountEditorDetail>) => {
 *   const { placeholder, spec, context } = e.detail;
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
 * Use this interface for strongly typed event handling.
 *
 * @example
 * ```typescript
 * // Type-safe event listener
 * function handleEvent<K extends keyof DataGridEventMap>(
 *   grid: DataGridElement,
 *   event: K,
 *   handler: (detail: DataGridEventMap[K]) => void,
 * ): void {
 *   grid.addEventListener(event, (e: CustomEvent) => handler(e.detail));
 * }
 *
 * handleEvent(grid, 'cell-click', (detail) => {
 *   console.log(detail.field); // Type-safe access
 * });
 * ```
 *
 * @see {@link DataGridCustomEvent} for typed CustomEvent wrapper
 * @see {@link DGEvents} for event name constants
 * @category Events
 */
export interface DataGridEventMap<TRow = unknown> {
  'cell-click': CellClickDetail<TRow>;
  'row-click': RowClickDetail<TRow>;
  'cell-activate': CellActivateDetail<TRow>;
  'cell-change': CellChangeDetail<TRow>;
  'mount-external-view': ExternalMountViewDetail<TRow>;
  'mount-external-editor': ExternalMountEditorDetail<TRow>;
  'sort-change': SortChangeDetail;
  'column-resize': ColumnResizeDetail;
  /** @deprecated Use 'cell-activate' instead */
  'activate-cell': ActivateCellDetail;
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
 * Use this type when you need to cast or declare event handler parameters.
 *
 * @example
 * ```typescript
 * // Strongly typed event handler
 * function onCellClick(e: DataGridCustomEvent<'cell-click', Employee>): void {
 *   const { row, field, value } = e.detail;
 *   console.log(`Clicked ${field} = ${value} on ${row.name}`);
 * }
 *
 * grid.addEventListener('cell-click', onCellClick);
 * ```
 *
 * @see {@link DataGridEventMap} for all event types
 * @see {@link DataGridEventDetail} for extracting detail type only
 * @category Events
 */
export type DataGridCustomEvent<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = CustomEvent<
  DataGridEventMap<TRow>[K]
>;

/**
 * Template evaluation context for dynamic templates.
 *
 * @category Plugin Development
 */
export interface EvalContext {
  value: unknown;
  row: Record<string, unknown> | null;
}
// #endregion

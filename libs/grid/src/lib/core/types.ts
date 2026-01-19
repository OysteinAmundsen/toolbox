import type { PluginQuery } from './plugin/base-plugin';
import type { CellMouseEvent } from './plugin/types';

/**
 * The compiled webcomponent interface for DataGrid
 */
export interface DataGridElement extends PublicGrid, HTMLElement {}

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
}

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
  /** Snapshots of row data before editing. Injected by EditingPlugin. @internal */
  _rowEditSnapshots?: Map<number, T>;
  /** Set of row indices that have been modified. Injected by EditingPlugin. @internal */
  _changedRowIndices?: Set<number>;
  /** Get all changed rows. Injected by EditingPlugin. */
  changedRows?: T[];
  /** Get indices of all changed rows. Injected by EditingPlugin. */
  changedRowIndices?: number[];
  effectiveConfig?: GridConfig<T>;
  findHeaderRow?: () => HTMLElement;
  refreshVirtualWindow: (full: boolean) => void;
  updateTemplate?: () => void;
  findRenderedRowElement?: (rowIndex: number) => HTMLElement | null;
  /** Begin bulk edit on a row. Injected by EditingPlugin. */
  beginBulkEdit?: (rowIndex: number) => void;
  /** Commit active row edit. Injected by EditingPlugin. */
  commitActiveRowEdit?: () => void;
  /** Dispatch cell click to plugin system, returns true if handled */
  _dispatchCellClick?: (event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement) => boolean;
  /** Dispatch row click to plugin system, returns true if handled */
  _dispatchRowClick?: (event: MouseEvent, rowIndex: number, row: any, rowEl: HTMLElement) => boolean;
  /** Dispatch header click to plugin system, returns true if handled */
  _dispatchHeaderClick?: (event: MouseEvent, colIndex: number, headerEl: HTMLElement) => boolean;
  /** Dispatch keydown to plugin system, returns true if handled */
  _dispatchKeyDown?: (event: KeyboardEvent) => boolean;
  /** Dispatch cell mouse events for drag operations. Returns true if any plugin started a drag. */
  _dispatchCellMouseDown?: (event: CellMouseEvent) => boolean;
  /** Dispatch cell mouse move during drag. */
  _dispatchCellMouseMove?: (event: CellMouseEvent) => void;
  /** Dispatch cell mouse up to end drag. */
  _dispatchCellMouseUp?: (event: CellMouseEvent) => void;
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

export type PrimitiveColumnType = 'number' | 'string' | 'date' | 'boolean' | 'select' | 'typeahead';

/**
 * Base contract for a column. Public; kept intentionally lean so host apps can extend via intersection types.
 * Prefer adding optional properties here only when broadly useful to most grids.
 */
export interface BaseColumnConfig<TRow = any, TValue = any> {
  /** Unique field key referencing property in row objects */
  field: keyof TRow & string;
  /** Visible header label; defaults to capitalized field */
  header?: string;
  /** Column data type; inferred if omitted */
  type?: PrimitiveColumnType;
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
  /** For select/typeahead types - available options */
  options?: Array<{ label: string; value: unknown }> | (() => Array<{ label: string; value: unknown }>);
  /** For select/typeahead - allow multi select */
  multi?: boolean;
  /** Optional formatter */
  format?: (value: TValue, row: TRow) => string;
  /** Arbitrary extra metadata */
  meta?: Record<string, unknown>;
}

/**
 * Full column configuration including optional custom view/renderer & grouping metadata.
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
}

export type ColumnConfigMap<TRow = any> = ColumnConfig<TRow>[];

/** External editor spec: tag name, factory function, or external mount spec */
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
  /** Accept the edit; triggers change tracking + rerender. */
  commit: (newValue: TValue) => void;
  /** Abort edit without persisting changes. */
  cancel: () => void;
}

/**
 * Context passed to custom view renderers (pure display – no commit helpers).
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

export type ColumnViewRenderer<TRow = unknown, TValue = unknown> = (
  ctx: CellRenderContext<TRow, TValue>,
) => Node | string | void | null;

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
   */
  createEditor<TRow = unknown, TValue = unknown>(element: HTMLElement): ColumnEditorSpec<TRow, TValue>;

  /**
   * Creates a tool panel renderer from a light DOM element.
   * The renderer receives a container element and optionally returns a cleanup function.
   */
  createToolPanelRenderer?(element: HTMLElement): ((container: HTMLElement) => void | (() => void)) | undefined;
}

// #region Internal-only augmented types (not re-exported publicly)

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
 * @category Plugin Development
 */
export interface EditorExecContext<T = any> extends CellContext<T> {
  commit: (newValue: unknown) => void;
  cancel: () => void;
}

/**
 * Controller managing drag-based column resize lifecycle.
 *
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
 * Used within grouping-rows plugin config for presentation of group rows.
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

export type AggregatorRef = string | ((rows: unknown[], field: string, column?: unknown) => unknown);

/** Result of automatic column inference from sample rows. */
export interface InferredColumnResult<TRow = unknown> {
  columns: ColumnConfigMap<TRow>;
  typeMap: Record<string, PrimitiveColumnType>;
}

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
 * - `editOn` property - shorthand for `gridConfig.editOn`
 * - Light DOM `<tbw-grid-column>` - declarative columns (merged into `columns`)
 * - Light DOM `<tbw-grid-header>` - declarative shell header (merged into `shell.header`)
 *
 * **Precedence (when same property set multiple ways):**
 * Individual props (`fitMode`, `editOn`) > `columns` prop > Light DOM > `gridConfig`
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
  /** Column definitions. Can also be set via `columns` prop or `<tbw-grid-column>` light DOM. */
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
  /** Edit activation mode ('click' | 'dblClick' | false). Set to false to disable editing. Can also be set via `editOn` prop. */
  editOn?: string | boolean;
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
   *
   * @default Auto-measured from first row (respects --tbw-row-height CSS variable)
   *
   * @example
   * ```ts
   * // Fixed height for rows that may wrap to 2 lines
   * gridConfig = { rowHeight: 56 };
   * ```
   */
  rowHeight?: number;
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
}
// #endregion

// #region Animation

/**
 * Sort state passed to custom sort handlers.
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
 * @param rows - Current row array to sort
 * @param sortState - Sort field and direction
 * @param columns - Column configurations (for accessing sortComparator)
 * @returns Sorted array (sync) or Promise resolving to sorted array (async)
 */
export type SortHandler<TRow = any> = (
  rows: TRow[],
  sortState: SortState,
  columns: ColumnConfig<TRow>[],
) => TRow[] | Promise<TRow[]>;

/**
 * Animation behavior mode.
 * - `true` or `'on'`: Animations always enabled
 * - `false` or `'off'`: Animations always disabled
 * - `'reduced-motion'`: Respects `prefers-reduced-motion` media query (default)
 */
export type AnimationMode = boolean | 'on' | 'off' | 'reduced-motion';

/**
 * Animation style for visual transitions.
 * - `'slide'`: Slide/transform animation (e.g., expand down, slide left/right)
 * - `'fade'`: Opacity fade animation
 * - `'flip'`: FLIP technique for position changes (First, Last, Invert, Play)
 * - `false`: No animation for this specific feature
 */
export type AnimationStyle = 'slide' | 'fade' | 'flip' | false;

/**
 * Animation style for expand/collapse operations.
 * Subset of AnimationStyle - excludes 'flip' which is for position changes.
 * - `'slide'`: Slide down/up animation for expanding/collapsing content
 * - `'fade'`: Fade in/out animation
 * - `false`: No animation
 */
export type ExpandCollapseAnimation = 'slide' | 'fade' | false;

/**
 * Grid-wide animation configuration.
 * Controls global animation behavior - individual plugins define their own animation styles.
 * Duration and easing values set corresponding CSS variables on the grid element.
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
}

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
};
// #endregion

// #region Shell Configuration

/**
 * Shell configuration for the grid's optional header bar and tool panels.
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
   * Custom toolbar buttons (rendered before tool panel toggles)
   * @deprecated Use `toolbarContents` instead. Will be removed in a future version.
   */
  toolbarButtons?: ToolbarButtonConfig[];
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
}

/**
 * Toolbar button defined via config (programmatic approach).
 *
 * The grid does NOT create buttons - developers have full control over their own buttons.
 * Provide either:
 * - `element`: A ready-made DOM element (grid appends it to toolbar)
 * - `render`: A factory function that receives a container and appends content
 *
 * For declarative HTML buttons, use light-dom instead:
 * ```html
 * <tbw-grid>
 *   <tbw-grid-header>
 *     <button slot="toolbar">My Button</button>
 *   </tbw-grid-header>
 * </tbw-grid>
 * ```
 * @deprecated Use ToolbarContentDefinition with registerToolbarContent() instead.
 */
export interface ToolbarButtonConfig {
  /** Unique button ID */
  id: string;
  /** Tooltip / aria-label (for accessibility, used when grid generates panel toggle) */
  label?: string;
  /** Order priority (lower = first, default: 100) */
  order?: number;

  /**
   * User-provided element. Grid appends it to the toolbar.
   * User is responsible for styling, event handlers, accessibility, etc.
   */
  element?: HTMLElement;
  /**
   * Render function called once. Receives container, user appends their DOM.
   * User is responsible for event handlers.
   * Return a cleanup function (optional).
   */
  render?: (container: HTMLElement) => void | (() => void);
}

/**
 * Toolbar button info returned by getToolbarButtons().
 * @deprecated Use getToolbarContents() instead.
 */
export interface ToolbarButtonInfo {
  id: string;
  label: string;
  /** Source of this button: 'config' | 'light-dom' | 'panel-toggle' */
  source: 'config' | 'light-dom' | 'panel-toggle';
  /** For panel toggles, the associated panel ID */
  panelId?: string;
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
 * @example
 * ```ts
 * // In filtering plugin
 * declare module '@toolbox-web/grid' {
 *   interface ColumnState {
 *     filter?: FilterValue;
 *   }
 * }
 * ```
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
  /** Sort state (undefined = not sorted) */
  sort?: ColumnSortState;
}

/**
 * Sort state for a column
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
 */
export interface GridColumnState {
  columns: ColumnState[];
}
// #endregion

// #region Public Event Detail Interfaces
/**
 * Event detail for cell value commit.
 *
 * @category Events
 */
export interface CellCommitDetail<TRow = unknown> {
  /** The row object (not yet mutated if event is cancelable). */
  row: TRow;
  /** Field name whose value changed. */
  field: string;
  /** Previous value before change. */
  oldValue: unknown;
  /** New value to be stored. */
  value: unknown;
  /** Index of the row in current data set. */
  rowIndex: number;
  /** All rows that have at least one committed change (snapshot list). */
  changedRows: TRow[];
  /** Indices parallel to changedRows. */
  changedRowIndices: number[];
  /** True if this row just entered the changed set. */
  firstTimeForRow: boolean;
}

/**
 * Detail payload for a committed row edit (may or may not include changes).
 *
 * @category Events
 */
export interface RowCommitDetail<TRow = unknown> {
  /** Row index that lost edit focus. */
  rowIndex: number;
  /** Row object reference. */
  row: TRow;
  /** Whether any cell changes were actually committed in this row during the session. */
  changed: boolean;
  /** Current changed row collection. */
  changedRows: TRow[];
  /** Indices of changed rows. */
  changedRowIndices: number[];
}

/**
 * Emitted when the changed rows tracking set is cleared programmatically.
 *
 * @category Events
 */
export interface ChangedRowsResetDetail<TRow = unknown> {
  /** New (empty) changed rows array after reset. */
  rows: TRow[];
  /** Parallel indices (likely empty). */
  indices: number[];
}

/**
 * Detail for a sort change (direction 0 indicates cleared sort).
 *
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
 * @category Events
 */
export interface ColumnResizeDetail {
  /** Resized column field key. */
  field: string;
  /** New width in pixels. */
  width: number;
}

/**
 * Fired when keyboard navigation or programmatic focus changes active cell.
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
 * @category Events
 */
export interface ExternalMountViewDetail<TRow = unknown> {
  placeholder: HTMLElement;
  spec: unknown;
  context: { row: TRow; value: unknown; field: string; column: unknown };
}

/**
 * Event detail for mounting external editor renderers.
 *
 * @category Events
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
 * @category Events
 */
export interface DataGridEventMap<TRow = unknown> {
  'cell-commit': CellCommitDetail<TRow>;
  'row-commit': RowCommitDetail<TRow>;
  'changed-rows-reset': ChangedRowsResetDetail<TRow>;
  'mount-external-view': ExternalMountViewDetail<TRow>;
  'mount-external-editor': ExternalMountEditorDetail<TRow>;
  'sort-change': SortChangeDetail;
  'column-resize': ColumnResizeDetail;
  'activate-cell': ActivateCellDetail;
  'column-state-change': GridColumnState;
}

/**
 * Extracts the event detail type for a given event name.
 *
 * @category Events
 */
export type DataGridEventDetail<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = DataGridEventMap<TRow>[K];

/**
 * Custom event type for DataGrid events with typed detail payload.
 *
 * @category Events
 */
export type DataGridCustomEvent<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = CustomEvent<
  DataGridEventMap<TRow>[K]
>;

// Internal code now reuses the public ColumnEditorContext; provide alias for backward compatibility
export type EditorContext<T = unknown> = ColumnEditorContext<T, unknown>;

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

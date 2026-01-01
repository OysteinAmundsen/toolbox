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
}

/**
 * Internal-only augmented interface for DataGrid component
 */
export interface InternalGrid<T = any> extends PublicGrid<T>, GridConfig<T> {
  shadowRoot: ShadowRoot | null;
  _rows: T[];
  _columns: ColumnInternal<T>[];
  /** Visible columns only (excludes hidden). Use for rendering. */
  visibleColumns: ColumnInternal<T>[];
  headerRowEl: HTMLElement;
  bodyEl: HTMLElement;
  rowPool: HTMLElement[];
  resizeController: ResizeController;
  sortState: { field: string; direction: 1 | -1 } | null;
  __originalOrder: T[];
  __rowRenderEpoch: number;
  __didInitialAutoSize?: boolean;
  __lightDomColumnsCache?: ColumnInternal[];
  __originalColumnNodes?: HTMLElement[];
  gridTemplate: string;
  virtualization: VirtualState;
  focusRow: number;
  focusCol: number;
  activeEditRows: number;
  rowEditSnapshots: Map<number, T>;
  _changedRowIndices: Set<number>;
  changedRows?: T[];
  changedRowIndices?: number[];
  effectiveConfig?: GridConfig<T>;
  findHeaderRow?: () => HTMLElement;
  refreshVirtualWindow: (full: boolean) => void;
  updateTemplate?: () => void;
  findRenderedRowElement?: (rowIndex: number) => HTMLElement | null;
  beginBulkEdit?: (rowIndex: number) => void;
  commitActiveRowEdit?: () => void;
  /** Dispatch cell click to plugin system, returns true if handled */
  dispatchCellClick?: (event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement) => boolean;
  /** Dispatch header click to plugin system, returns true if handled */
  dispatchHeaderClick?: (event: MouseEvent, colIndex: number, headerEl: HTMLElement) => boolean;
  /** Dispatch keydown to plugin system, returns true if handled */
  dispatchKeyDown?: (event: KeyboardEvent) => boolean;
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
  /** Whether the field is editable (enables editors) */
  editable?: boolean;
  /** Optional custom editor factory or element tag name */
  editor?: ColumnEditorSpec<TRow, TValue>;
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
  /** Prevent this column from being hidden by the visibility plugin */
  lockVisible?: boolean;
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
}

export type ColumnViewRenderer<TRow = unknown, TValue = unknown> = (
  ctx: CellRenderContext<TRow, TValue>,
) => Node | string | void;

// #region Internal-only augmented types (not re-exported publicly)
export interface ColumnInternal<T = any> extends ColumnConfig<T> {
  __autoSized?: boolean;
  __userResized?: boolean;
  __renderedWidth?: number;
  __viewTemplate?: HTMLElement;
  __editorTemplate?: HTMLElement;
  __headerTemplate?: HTMLElement;
  __compiledView?: (ctx: CellContext<T>) => string;
  __compiledEditor?: (ctx: EditorExecContext<T>) => string;
}

/**
 * Runtime cell context used internally for compiled template execution.
 */
export interface CellContext<T = any> {
  row: T;
  value: unknown;
  field: string;
  column: ColumnInternal<T>;
}

/**
 * Internal editor execution context extending the generic cell context with commit helpers.
 */
export interface EditorExecContext<T = any> extends CellContext<T> {
  commit: (newValue: unknown) => void;
  cancel: () => void;
}

/** Controller managing drag-based column resize lifecycle. */
export interface ResizeController {
  start: (e: MouseEvent, colIndex: number, cell: HTMLElement) => void;
  dispose: () => void;
  /** True while a resize drag is in progress (used to suppress header click/sort). */
  isResizing: boolean;
}

/** Virtual window bookkeeping; modified in-place as scroll position changes. */
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
 */
export interface GridPlugin {
  /** Unique plugin identifier */
  readonly name: string;
  /** Plugin version */
  readonly version: string;
  /** CSS styles to inject into grid's shadow DOM */
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
  /** Sizing mode for columns. Can also be set via `fitMode` prop. */
  fitMode?: FitMode;
  /** Edit activation mode ('click' | 'dblclick'). Can also be set via `editOn` prop. */
  editOn?: string;
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
}
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
}

/**
 * Shell header bar configuration
 */
export interface ShellHeaderConfig {
  /** Grid title displayed on the left (optional) */
  title?: string;
  /** Custom toolbar buttons (rendered before tool panel toggles) */
  toolbarButtons?: ToolbarButtonConfig[];
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
 * Supports three modes:
 * - Simple: provide `icon` + `action` for grid to create button
 * - Element: provide `element` for user-created DOM
 * - Render: provide `render` function for complex widgets
 */
export interface ToolbarButtonConfig {
  /** Unique button ID */
  id: string;
  /** Tooltip / aria-label (required for accessibility) */
  label: string;
  /** Order priority (lower = first, default: 100) */
  order?: number;
  /** Whether button is disabled (only applies to grid-rendered buttons) */
  disabled?: boolean;

  // ===== Option A: Simple - Grid renders the button =====
  /** Button content: SVG string, emoji, or text. Grid creates <button> with this. */
  icon?: string;
  /** Click handler (required when using icon) */
  action?: () => void;

  // ===== Option B: Custom DOM - User provides element or render function =====
  /**
   * User-provided element. Grid wraps it but doesn't modify it.
   * User is responsible for event handlers.
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
 */
export interface ToolbarButtonInfo {
  id: string;
  label: string;
  disabled: boolean;
  /** Source of this button: 'config' | 'light-dom' | 'panel-toggle' */
  source: 'config' | 'light-dom' | 'panel-toggle';
  /** For panel toggles, the associated panel ID */
  panelId?: string;
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
export interface CellCommitDetail<TRow = unknown> {
  /** The mutated row after commit. */
  row: TRow;
  /** Field name whose value changed. */
  field: string;
  /** New value stored. */
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

/** Detail payload for a committed row edit (may or may not include changes). */
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

/** Emitted when the changed rows tracking set is cleared programmatically. */
export interface ChangedRowsResetDetail<TRow = unknown> {
  /** New (empty) changed rows array after reset. */
  rows: TRow[];
  /** Parallel indices (likely empty). */
  indices: number[];
}

/** Detail for a sort change (direction 0 indicates cleared sort). */
export interface SortChangeDetail {
  /** Sorted field key. */
  field: string;
  /** Direction: 1 ascending, -1 descending, 0 cleared. */
  direction: 1 | -1 | 0;
}

/** Column resize event detail containing final pixel width. */
export interface ColumnResizeDetail {
  /** Resized column field key. */
  field: string;
  /** New width in pixels. */
  width: number;
}

/** Fired when keyboard navigation or programmatic focus changes active cell. */
export interface ActivateCellDetail {
  /** Zero-based row index now focused. */
  row: number;
  /** Zero-based column index now focused. */
  col: number;
}

export interface ExternalMountViewDetail<TRow = unknown> {
  placeholder: HTMLElement;
  spec: unknown;
  context: { row: TRow; value: unknown; field: string; column: unknown };
}

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

export type DataGridEventDetail<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = DataGridEventMap<TRow>[K];
export type DataGridCustomEvent<K extends keyof DataGridEventMap<unknown>, TRow = unknown> = CustomEvent<
  DataGridEventMap<TRow>[K]
>;

// Internal code now reuses the public ColumnEditorContext; provide alias for backward compatibility
export type EditorContext<T = unknown> = ColumnEditorContext<T, unknown>;

export interface EvalContext {
  value: unknown;
  row: Record<string, unknown> | null;
}
// #endregion

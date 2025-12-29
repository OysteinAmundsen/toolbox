import styles from './grid.css?inline';
import { applyColumnState, collectColumnState, createStateChangeHandler } from './internal/column-state';
import { autoSizeColumns, getColumnConfiguration, updateTemplate } from './internal/columns';
import { exitRowEdit, startRowEdit } from './internal/editing';
import { renderHeader } from './internal/header';
import { inferColumns } from './internal/inference';
import { handleGridKeyDown } from './internal/keyboard';
import { createResizeController } from './internal/resize';
import { invalidateCellCache, renderVisibleRows } from './internal/rows';
import {
  cleanupShellState,
  createShellState,
  getToolbarButtonsInfo,
  parseLightDomShell,
  renderCustomToolbarButtons,
  renderHeaderContent,
  renderPanelContent,
  renderShellBody,
  renderShellHeader,
  setupShellEventListeners,
  shouldRenderShellHeader,
  updatePanelState,
  updateToolbarActiveStates,
  type ShellState,
} from './internal/shell';
import type { CellMouseEvent, ScrollEvent } from './plugin';
import type { BaseGridPlugin, CellClickEvent, HeaderClickEvent } from './plugin/base-plugin';
import { PluginManager } from './plugin/plugin-manager';
import type {
  ActivateCellDetail,
  CellCommitDetail,
  ColumnConfig,
  ColumnConfigMap,
  ColumnInternal,
  ColumnResizeDetail,
  FitMode,
  GridColumnState,
  GridConfig,
  HeaderContentDefinition,
  InternalGrid,
  ResizeController,
  RowCommitDetail,
  SortChangeDetail,
  ToolbarButtonConfig,
  ToolbarButtonInfo,
  ToolPanelDefinition,
  VirtualState,
} from './types';

/**
 * High-performance data grid web component.
 * During migration, uses tbw-grid tag to avoid conflicts with existing datagrid.
 * Will be renamed back to data-grid when migration is complete.
 *
 * ## Configuration Architecture
 *
 * The grid follows a **single source of truth** pattern where all configuration
 * converges into `#effectiveConfig`. Users can set configuration via multiple inputs:
 *
 * **Input Sources (precedence low → high):**
 * 1. `gridConfig` property - base configuration object
 * 2. Light DOM elements:
 *    - `<tbw-grid-column>` → `effectiveConfig.columns`
 *    - `<tbw-grid-header title="...">` → `effectiveConfig.shell.header.title`
 *    - `<tbw-grid-header-content>` → `effectiveConfig.shell.header.content`
 * 3. `columns` property → merged into `effectiveConfig.columns`
 * 4. `fitMode` property → merged into `effectiveConfig.fitMode`
 * 5. `editOn` property → merged into `effectiveConfig.editOn`
 * 6. Column inference from first row (if no columns defined)
 *
 * **Derived State:**
 * - `_columns` - processed columns from `effectiveConfig.columns` after plugin hooks
 * - `_rows` - processed rows after plugin hooks (grouping, filtering, etc.)
 *
 * The `#mergeEffectiveConfig()` method is the single place where all inputs converge.
 * All rendering and logic should read from `effectiveConfig` or derived state.
 *
 * @element tbw-grid
 *
 * @csspart container - The main grid container
 * @csspart header - The header row container
 * @csspart body - The body/rows container
 *
 * @fires cell-commit - Fired when a cell value is committed
 * @fires row-commit - Fired when a bulk row edit session commits
 * @fires changed-rows-reset - Fired after resetChangedRows() unless silent
 * @fires mount-external-view - Fired to request mounting of an external view renderer
 * @fires mount-external-editor - Fired to request mounting of an external editor renderer
 * @fires sort-change - Fired when sort state changes for a column
 * @fires column-resize - Fired after a column resize drag completes
 * @fires activate-cell - Fired when a cell activation intent occurs
 * @fires group-toggle - Fired when a group row is toggled
 *
 * @cssprop --tbw-color-bg - Background color
 * @cssprop --tbw-color-fg - Foreground/text color
 */
export class DataGridElement<T = any> extends HTMLElement implements InternalGrid<T> {
  // TODO: Rename to 'data-grid' when migration is complete
  static readonly tagName = 'tbw-grid';

  readonly #shadow: ShadowRoot;
  #initialized = false;

  // ---------------- Ready Promise ----------------
  #readyPromise: Promise<void>;
  #readyResolve?: () => void;

  // ================== INPUT PROPERTIES ==================
  // These backing fields store raw user input. They are merged into
  // #effectiveConfig by #mergeEffectiveConfig(). Never read directly
  // for rendering logic - always use effectiveConfig or derived state.
  #rows: T[] = [];
  #columns?: ColumnConfig<T>[] | ColumnConfigMap<T>;
  #gridConfig?: GridConfig<T>;
  #fitMode?: FitMode;
  #editOn?: string;

  // ================== SINGLE SOURCE OF TRUTH ==================
  // All input sources converge here. This is the canonical config
  // that all rendering and logic should read from.
  #effectiveConfig: GridConfig<T> = {};
  #connected = false;
  #scrollRaf = 0;
  #pendingScrollTop: number | null = null;
  #hasScrollPlugins = false; // Cached flag for plugin scroll handlers
  #renderRowHook?: (row: any, rowEl: HTMLElement, rowIndex: number) => boolean; // Cached hook to avoid closures
  #isDragging = false;
  #touchStartY: number | null = null;
  #touchStartX: number | null = null;
  #touchScrollTop: number | null = null;
  #touchScrollLeft: number | null = null;
  #eventAbortController?: AbortController;
  #resizeObserver?: ResizeObserver;

  // ---------------- Plugin System ----------------
  #pluginManager!: PluginManager;

  // ---------------- Column State ----------------
  #stateChangeHandler?: () => void;
  #initialColumnState?: GridColumnState;

  // ---------------- Shell State ----------------
  #shellState: ShellState = createShellState();
  #shellInitialized = false;

  // ================== DERIVED STATE ==================
  // _rows: result of applying plugin processRows hooks
  _rows: T[] = [];

  // _columns is a getter/setter that operates on effectiveConfig.columns
  // This ensures effectiveConfig.columns is the single source of truth for columns
  // _columns always contains ALL columns (including hidden)
  get _columns(): ColumnInternal<T>[] {
    return (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
  }
  set _columns(value: ColumnInternal<T>[]) {
    this.#effectiveConfig.columns = value as ColumnConfig<T>[];
  }

  // visibleColumns returns only visible columns for rendering
  // This is what header/row rendering should use
  get visibleColumns(): ColumnInternal<T>[] {
    return this._columns.filter((c) => !c.hidden);
  }

  // ================== RUNTIME STATE ==================
  // User-driven state changes at runtime (sort, etc.)
  // Visibility is stored in effectiveConfig.columns[].hidden
  rowPool: HTMLElement[] = [];
  __rowRenderEpoch = 0;
  activeEditRows = -1;
  resizeController!: ResizeController;
  __didInitialAutoSize = false;
  __lightDomColumnsCache?: ColumnInternal[];
  __originalColumnNodes?: HTMLElement[];
  headerRowEl!: HTMLElement;
  bodyEl!: HTMLElement;
  virtualization: VirtualState = {
    enabled: true,
    rowHeight: 28, // Initial state - will recalculate after first render
    bypassThreshold: 24, // Skip virtualization if <= this many rows (saves overhead)
    start: 0,
    end: 0,
    container: null, // Faux scrollbar element
    viewportEl: null, // Rows viewport for measuring visible height
    totalHeightEl: null, // Spacer for virtual height
  };
  sortState: { field: string; direction: 1 | -1 } | null = null;
  __originalOrder: T[] = [];
  focusRow = 0;
  focusCol = 0;
  gridTemplate = '';
  rowEditSnapshots = new Map<number, T>();
  _changedRowIndices = new Set<number>();

  // ---------------- Public API Props (getters/setters) ----------------
  // Getters return the EFFECTIVE value (after merging), not the raw input.
  // This is what consumers and plugins need - the current resolved state.
  // Setters update input properties which trigger re-merge into effectiveConfig.

  get rows(): T[] {
    return this._rows;
  }
  set rows(value: T[]) {
    const oldValue = this.#rows;
    this.#rows = value;
    if (oldValue !== value) {
      this.#onRowsChanged();
    }
  }

  /**
   * Get the original unfiltered/unprocessed rows.
   * Use this when you need access to all source data regardless of active filters.
   */
  get sourceRows(): T[] {
    return this.#rows;
  }

  get columns(): ColumnConfig<T>[] {
    return [...this._columns] as ColumnConfig<T>[];
  }
  set columns(value: ColumnConfig<T>[] | ColumnConfigMap<T> | undefined) {
    const oldValue = this.#columns;
    this.#columns = value;
    if (oldValue !== value) {
      this.#onColsChanged();
    }
  }

  get gridConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }
  set gridConfig(value: GridConfig<T> | undefined) {
    const oldValue = this.#gridConfig;
    this.#gridConfig = value;
    if (oldValue !== value) {
      this.#onGridConfigChanged();
    }
  }

  get fitMode(): FitMode {
    return this.#effectiveConfig.fitMode ?? 'stretch';
  }
  set fitMode(value: FitMode | undefined) {
    const oldValue = this.#fitMode;
    this.#fitMode = value;
    if (oldValue !== value) {
      this.#onFitChanged();
    }
  }

  get editOn(): string | undefined {
    return this.#effectiveConfig.editOn;
  }
  set editOn(value: string | undefined) {
    const oldValue = this.#editOn;
    this.#editOn = value;
    if (oldValue !== value) {
      this.#onEditModeChanged();
    }
  }

  // Effective config accessor for internal modules and plugins
  // Returns the merged config (single source of truth) before plugin processing
  // Use this when you need the raw merged config (e.g., for column definitions including hidden)
  get effectiveConfig(): GridConfig<T> {
    return this.#effectiveConfig;
  }

  /**
   * Get the disconnect signal for event listener cleanup.
   * This signal is aborted when the grid disconnects from the DOM.
   * Plugins and internal code can use this for automatic listener cleanup.
   * @example
   * element.addEventListener('click', handler, { signal: this.grid.disconnectSignal });
   */
  get disconnectSignal(): AbortSignal {
    // Ensure AbortController exists (created in connectedCallback before plugins attach)
    if (!this.#eventAbortController) {
      this.#eventAbortController = new AbortController();
    }
    return this.#eventAbortController.signal;
  }

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open' });
    this.#injectStyles();
    this.#readyPromise = new Promise((res) => (this.#readyResolve = res));
  }

  #injectStyles(): void {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.#shadow.adoptedStyleSheets = [sheet];
  }

  // ---------------- Plugin System ----------------

  /**
   * Get a plugin instance by its class.
   * Used by plugins for inter-plugin communication.
   */
  getPlugin<P extends BaseGridPlugin>(PluginClass: new (...args: any[]) => P): P | undefined {
    return this.#pluginManager?.getPlugin(PluginClass);
  }

  /**
   * Get a plugin instance by its name.
   * Used for loose coupling between plugins (avoids static imports).
   */
  getPluginByName(name: string): BaseGridPlugin | undefined {
    return this.#pluginManager?.getPluginByName(name);
  }

  /**
   * Request a full re-render of the grid.
   * Called by plugins when they need the grid to update.
   * Note: This does NOT reset plugin state - just re-processes rows/columns and renders.
   */
  requestRender(): void {
    this.#rebuildRowModel();
    this.#processColumns();
    this.#renderHeader();
    this.updateTemplate();
    this.refreshVirtualWindow(true);
  }

  /**
   * Request a lightweight style update without rebuilding DOM.
   * Called by plugins when they only need to update CSS classes/styles.
   * This runs all plugin afterRender hooks without rebuilding row/column DOM.
   */
  requestAfterRender(): void {
    this.#executeAfterRender();
  }

  /**
   * Initialize plugin system with instances from config.
   * Plugins are class instances passed in gridConfig.plugins[].
   */
  #initializePlugins(): void {
    // Create plugin manager for this grid
    this.#pluginManager = new PluginManager(this);

    // Get plugin instances from config - ensure it's an array
    const pluginsConfig = this.#effectiveConfig?.plugins;
    const plugins = Array.isArray(pluginsConfig) ? (pluginsConfig as BaseGridPlugin[]) : [];

    // Attach all plugins
    this.#pluginManager.attachAll(plugins);
  }

  /**
   * Inject all plugin styles into the shadow DOM.
   * Must be called after #render() since innerHTML wipes existing content.
   */
  #injectAllPluginStyles(): void {
    const allStyles = this.#pluginManager?.getAllStyles() ?? '';
    if (allStyles) {
      const styleEl = document.createElement('style');
      styleEl.setAttribute('data-plugin', 'all');
      styleEl.textContent = allStyles;
      this.#shadow.appendChild(styleEl);
    }
  }

  /**
   * Update plugins when grid config changes.
   * With class-based plugins, we need to detach old and attach new.
   */
  #updatePluginConfigs(): void {
    // With class-based plugins, config changes require re-initialization
    // The new plugins are in the new config - detach old, attach new
    if (this.#pluginManager) {
      this.#pluginManager.detachAll();
    }
    this.#initializePlugins();
    this.#injectAllPluginStyles();
    // Update cached scroll plugin flag
    this.#hasScrollPlugins = this.#pluginManager?.getAll().some((p) => p.onScroll) ?? false;
  }

  /**
   * Clean up plugin states when grid disconnects.
   */
  #destroyPlugins(): void {
    this.#pluginManager?.detachAll();
  }

  /**
   * Collect tool panels and header content from all plugins.
   * Called after plugins are attached but before render.
   */
  #collectPluginShellContributions(): void {
    if (!this.#pluginManager) return;

    // Collect tool panels from plugins
    const pluginPanels = this.#pluginManager.getToolPanels();
    for (const { panel } of pluginPanels) {
      // Skip if already registered (light DOM or API takes precedence)
      if (!this.#shellState.toolPanels.has(panel.id)) {
        this.#shellState.toolPanels.set(panel.id, panel);
      }
    }

    // Collect header contents from plugins
    const pluginContents = this.#pluginManager.getHeaderContents();
    for (const { content } of pluginContents) {
      // Skip if already registered (light DOM or API takes precedence)
      if (!this.#shellState.headerContents.has(content.id)) {
        this.#shellState.headerContents.set(content.id, content);
      }
    }
  }

  // ---------------- Lifecycle ----------------
  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) (this as any).tabIndex = 0;
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Create AbortController for all event listeners (grid internal + plugins)
    // This must happen BEFORE plugins attach so they can use disconnectSignal
    // Abort any previous controller first (in case of re-connect)
    this.#eventAbortController?.abort();
    this.#eventAbortController = new AbortController();

    // Merge all config sources into effectiveConfig (including columns)
    this.#mergeEffectiveConfig();

    // Initialize plugin system (now plugins can access disconnectSignal)
    this.#initializePlugins();

    // Collect tool panels and header content from plugins (must be before render)
    this.#collectPluginShellContributions();

    if (!this.#initialized) {
      this.#render();
      this.#injectAllPluginStyles(); // Inject plugin styles after render
      this.#initialized = true;
    }
    this.#afterConnect();
  }

  disconnectedCallback(): void {
    // Clean up plugin states
    this.#destroyPlugins();

    // Clean up shell state
    cleanupShellState(this.#shellState);
    this.#shellInitialized = false;

    // Abort all event listeners (internal + document-level)
    // This cleans up all listeners added with { signal } option
    if (this.#eventAbortController) {
      this.#eventAbortController.abort();
      this.#eventAbortController = undefined;
    }

    if (this.resizeController) {
      this.resizeController.dispose();
    }
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = undefined;
    }
    this.#connected = false;
  }

  #afterConnect(): void {
    // Shell changes the DOM structure - need to find elements appropriately
    const gridContent = this.#shadow.querySelector('.tbw-grid-content');
    const gridRoot = gridContent ?? this.#shadow.querySelector('.tbw-grid-root');

    this.headerRowEl = gridRoot?.querySelector('.header-row') as HTMLElement;
    // Faux scrollbar pattern:
    // - .faux-vscroll-spacer sets virtual height
    // - .rows-viewport provides visible height for virtualization calculations
    this.virtualization.totalHeightEl = gridRoot?.querySelector('.faux-vscroll-spacer') as HTMLElement;
    this.virtualization.viewportEl = gridRoot?.querySelector('.rows-viewport') as HTMLElement;
    this.bodyEl = gridRoot?.querySelector('.rows') as HTMLElement;

    // Initialize shell header content and custom buttons if shell is active
    if (this.#shellInitialized) {
      // Render plugin header content
      renderHeaderContent(this.#shadow, this.#shellState);
      // Render custom toolbar buttons (element/render modes)
      renderCustomToolbarButtons(this.#shadow, this.#effectiveConfig?.shell, this.#shellState);
      // Open default panel if configured
      const defaultOpen = this.#effectiveConfig?.shell?.toolPanel?.defaultOpen;
      if (defaultOpen && this.#shellState.toolPanels.has(defaultOpen)) {
        this.openToolPanel(defaultOpen);
      }
    }

    // Mark for tests that afterConnect ran
    this.setAttribute('data-upgraded', '');
    if (!this.hasAttribute('role')) this.setAttribute('role', 'grid');
    this.#connected = true;

    // Get the signal for event listener cleanup (AbortController created in connectedCallback)
    const signal = this.disconnectSignal;

    // Run setup
    this.#setup();

    // Element-level keydown handler (uses signal for automatic cleanup)
    this.addEventListener('keydown', (e) => handleGridKeyDown(this as any, e), { signal });

    // Document-level listeners (also use signal for automatic cleanup)
    // Escape key to cancel row editing
    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.activeEditRows !== -1) {
          this.#exitRowEdit(this.activeEditRows, true);
        }
      },
      { capture: true, signal }
    );

    // Click outside to commit row editing
    document.addEventListener(
      'mousedown',
      (e: MouseEvent) => {
        if (this.activeEditRows === -1) return;
        const rowEl = this.findRenderedRowElement(this.activeEditRows);
        if (!rowEl) return;
        const path = (e.composedPath && e.composedPath()) || [];
        if (path.includes(rowEl)) return;
        this.#exitRowEdit(this.activeEditRows, false);
      },
      { signal }
    );

    // Faux scrollbar pattern: scroll events come from the fake scrollbar element
    // Content area doesn't scroll - rows are positioned via transforms
    // This prevents blank viewport: old content stays until transforms are updated
    // Reuse gridRoot from earlier in this function
    const fauxScrollbar = gridRoot?.querySelector('.faux-vscroll') as HTMLElement;
    const rowsEl = gridRoot?.querySelector('.rows') as HTMLElement;

    // Store reference for scroll position reading in refreshVirtualWindow
    this.virtualization.container = fauxScrollbar ?? this;

    // Cache whether any plugin has scroll handlers (checked once during setup)
    this.#hasScrollPlugins = this.#pluginManager?.getAll().some((p) => p.onScroll) ?? false;

    if (fauxScrollbar && rowsEl) {
      fauxScrollbar.addEventListener(
        'scroll',
        () => {
          // Fast exit if no scroll processing needed
          if (!this.virtualization.enabled && !this.#hasScrollPlugins) return;

          const currentScrollTop = fauxScrollbar.scrollTop;
          const rowHeight = this.virtualization.rowHeight;

          // Smooth scroll: apply offset immediately for fluid motion
          // Calculate even-aligned start to preserve zebra stripe parity
          // DOM nth-child(even) will always match data row parity
          const rawStart = Math.floor(currentScrollTop / rowHeight);
          const evenAlignedStart = rawStart - (rawStart % 2);
          const subPixelOffset = -(currentScrollTop - evenAlignedStart * rowHeight);
          rowsEl.style.transform = `translateY(${subPixelOffset}px)`;

          // Batch content update with requestAnimationFrame
          // Old content stays visible with smooth offset until new content renders
          this.#pendingScrollTop = currentScrollTop;
          if (!this.#scrollRaf) {
            this.#scrollRaf = requestAnimationFrame(() => {
              this.#scrollRaf = 0;
              if (this.#pendingScrollTop !== null) {
                this.#onScrollBatched(this.#pendingScrollTop);
                this.#pendingScrollTop = null;
              }
            });
          }
        },
        { passive: true, signal }
      );

      // Forward wheel events from content area to faux scrollbar
      // Without this, mouse wheel over content wouldn't scroll
      // Listen on .tbw-grid-content to capture wheel events from entire grid area
      // Note: gridRoot may already BE .tbw-grid-content when shell is active, so search from shadow root
      const gridContentEl = this.#shadow.querySelector('.tbw-grid-content') as HTMLElement;
      const scrollArea = this.#shadow.querySelector('.tbw-scroll-area') as HTMLElement;
      if (gridContentEl) {
        gridContentEl.addEventListener(
          'wheel',
          (e: WheelEvent) => {
            // Prevent default to stop any residual scroll behavior
            e.preventDefault();

            // SHIFT+wheel = horizontal scroll
            // Also handle trackpad horizontal scroll (deltaX)
            if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
              // Horizontal scroll - apply to scroll area
              if (scrollArea) {
                scrollArea.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX;
              }
            } else {
              // Vertical scroll - apply to faux scrollbar
              fauxScrollbar.scrollTop += e.deltaY;
            }
          },
          { passive: false, signal }
        );

        // Touch scrolling support for mobile devices
        // Supports both vertical (via faux scrollbar) and horizontal (via scroll area) scrolling
        gridContentEl.addEventListener(
          'touchstart',
          (e: TouchEvent) => {
            if (e.touches.length === 1) {
              this.#touchStartY = e.touches[0].clientY;
              this.#touchStartX = e.touches[0].clientX;
              this.#touchScrollTop = fauxScrollbar.scrollTop;
              this.#touchScrollLeft = scrollArea?.scrollLeft ?? 0;
            }
          },
          { passive: true, signal }
        );

        gridContentEl.addEventListener(
          'touchmove',
          (e: TouchEvent) => {
            if (
              e.touches.length === 1 &&
              this.#touchStartY !== null &&
              this.#touchStartX !== null &&
              this.#touchScrollTop !== null &&
              this.#touchScrollLeft !== null
            ) {
              const deltaY = this.#touchStartY - e.touches[0].clientY;
              const deltaX = this.#touchStartX - e.touches[0].clientX;

              // Apply both vertical and horizontal scroll
              fauxScrollbar.scrollTop = this.#touchScrollTop + deltaY;
              if (scrollArea) {
                scrollArea.scrollLeft = this.#touchScrollLeft + deltaX;
              }

              // Prevent page scroll when scrolling within grid
              e.preventDefault();
            }
          },
          { passive: false, signal }
        );

        gridContentEl.addEventListener(
          'touchend',
          () => {
            this.#touchStartY = null;
            this.#touchStartX = null;
            this.#touchScrollTop = null;
            this.#touchScrollLeft = null;
          },
          { passive: true, signal }
        );
      }
    }

    this.resizeController = createResizeController(this as any);

    // Central mouse event handling for plugins (uses signal for automatic cleanup)
    this.#shadow.addEventListener('mousedown', (e) => this.#handleMouseDown(e as MouseEvent), { signal });

    // Track global mousemove/mouseup for drag operations (uses signal for automatic cleanup)
    document.addEventListener('mousemove', (e: MouseEvent) => this.#handleMouseMove(e), { signal });
    document.addEventListener('mouseup', (e: MouseEvent) => this.#handleMouseUp(e), { signal });

    if (this.virtualization.enabled) {
      requestAnimationFrame(() => this.refreshVirtualWindow(true));
    }

    // Measure actual row height after first paint for accurate spacer sizing
    requestAnimationFrame(() => {
      const firstRow = this.bodyEl.querySelector('.data-grid-row');
      if (firstRow) {
        const h = (firstRow as HTMLElement).getBoundingClientRect().height;
        if (h && Math.abs(h - this.virtualization.rowHeight) > 0.1) {
          this.virtualization.rowHeight = h;
          this.refreshVirtualWindow(true);
        }
      }
    });

    // ResizeObserver to refresh virtual window when viewport size changes
    // This ensures more rows are rendered when the grid grows in height
    if (this.virtualization.viewportEl) {
      this.#resizeObserver = new ResizeObserver(() => {
        // Debounce with RAF to avoid excessive recalculations
        if (!this.#scrollRaf) {
          this.#scrollRaf = requestAnimationFrame(() => {
            this.#scrollRaf = 0;
            this.refreshVirtualWindow(true);
          });
        }
      });
      this.#resizeObserver.observe(this.virtualization.viewportEl);
    }

    // Initialize ARIA selection state
    queueMicrotask(() => this.#updateAriaSelection());

    requestAnimationFrame(() => requestAnimationFrame(() => this.#readyResolve?.()));
  }

  // ---------------- Event Emitters ----------------
  #emit<D>(eventName: string, detail: D): void {
    this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
  }

  emitCellCommit(detail: CellCommitDetail<T>): void {
    this.#emit('cell-commit', detail);
  }

  emitRowCommit(detail: RowCommitDetail<T>): void {
    this.#emit('row-commit', detail);
  }

  emitSortChange(detail: SortChangeDetail): void {
    this.#emit('sort-change', detail);
  }

  emitColumnResize(detail: ColumnResizeDetail): void {
    this.#emit('column-resize', detail);
  }

  emitActivateCell(detail: ActivateCellDetail): void {
    this.#emit('activate-cell', detail);
  }

  /** Update ARIA selection attributes on rendered rows/cells */
  #updateAriaSelection(): void {
    // Mark active row and cell with aria-selected
    const rows = this.bodyEl?.querySelectorAll('.data-grid-row');
    rows?.forEach((row, rowIdx) => {
      const isActiveRow = rowIdx === this.focusRow;
      row.setAttribute('aria-selected', String(isActiveRow));
      row.querySelectorAll('.cell').forEach((cell, colIdx) => {
        (cell as HTMLElement).setAttribute('aria-selected', String(isActiveRow && colIdx === this.focusCol));
      });
    });
  }

  // ---------------- Watch Handlers ----------------
  #onFitChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
    const mode = this.#effectiveConfig.fitMode;
    if (mode === 'fixed') {
      this.__didInitialAutoSize = false;
      this.#autoSizeColumns();
    } else {
      this._columns.forEach((c: any) => {
        if (!c.__userResized && c.__autoSized) delete c.width;
      });
      this.updateTemplate();
    }
  }

  #onEditModeChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
    this.rowPool.length = 0;
    if (this.bodyEl) this.bodyEl.innerHTML = '';
    this.__rowRenderEpoch++;
    this.refreshVirtualWindow(true);
  }

  #onRowsChanged(): void {
    this._rows = Array.isArray(this.#rows) ? [...this.#rows] : [];
    this.#rebuildRowModel();
    // If no explicit columns provided, trigger full setup so inference runs
    if (!this.#columns || (Array.isArray(this.#columns) && this.#columns.length === 0)) {
      this.#setup();
    } else {
      this.refreshVirtualWindow(true);
    }
  }

  #onColsChanged(): void {
    // Invalidate caches that depend on column configuration
    invalidateCellCache(this as unknown as any);

    // Re-merge config and setup - _columns will be set through effectiveConfig
    if (this.#connected) {
      this.#mergeEffectiveConfig();
      this.#setup();
    }
  }

  #onGridConfigChanged(): void {
    if (!this.#connected) return;
    this.#mergeEffectiveConfig();
    this.#updatePluginConfigs(); // Sync plugin configs with new grid config
    this.#rebuildRowModel();
    this.#processColumns(); // Process columns after rows for tree plugin
    this.#renderHeader();
    this.updateTemplate();
    this.refreshVirtualWindow(true);
  }

  // ---------------- Helper Wrappers ----------------
  #getColumnConfiguration(): void {
    getColumnConfiguration(this as unknown as any);
  }

  #renderHeader(): void {
    renderHeader(this as unknown as any);
    // Grouped header cell classes are applied by plugins via afterRender
  }

  updateTemplate(): void {
    updateTemplate(this as unknown as any);
  }

  #autoSizeColumns(): void {
    autoSizeColumns(this as unknown as any);
  }

  #processColumns(): void {
    // Let plugins process visible columns (column grouping, etc.)
    // Note: _columns always contains ALL columns; plugins work on visible subset
    if (this.#pluginManager) {
      // Get visible columns for plugin processing
      const visibleCols = this._columns.filter((c) => !c.hidden);
      const processedColumns = this.#pluginManager.processColumns([...visibleCols] as any[]);

      // If plugins modified visible columns, update them in place preserving hidden column positions
      if (processedColumns !== visibleCols) {
        // Build a map of processed columns by field for quick lookup
        const processedMap = new Map(processedColumns.map((c: any, i: number) => [c.field, { col: c, order: i }]));

        // Update visible columns in _columns with their processed versions
        // Hidden columns keep their original position
        const updatedColumns = this._columns.map((c) => {
          if (c.hidden) return c; // Keep hidden columns unchanged
          const processed = processedMap.get(c.field);
          return processed ? processed.col : c;
        });

        this._columns = updatedColumns as ColumnInternal<T>[];
      }
    }
  }

  /** Execute all plugin afterRender hooks */
  #executeAfterRender(): void {
    this.#pluginManager?.afterRender();
  }

  /** Recompute row model via plugin hooks (grouping, tree, filtering, etc.). */
  #rebuildRowModel(): void {
    // Invalidate cell display value cache - rows are changing
    invalidateCellCache(this as unknown as any);

    // Start fresh from original rows (plugins will transform them)
    const originalRows = Array.isArray(this.#rows) ? [...this.#rows] : [];

    // Let plugins process rows (row grouping, tree, filtering, etc.)
    // Plugins can transform the rows array, adding markers like __isGroupRow
    // The renderRow hook will handle rendering specialized row types
    const processedRows = this.#pluginManager?.processRows(originalRows) ?? originalRows;

    // Store processed rows for rendering
    // Note: processedRows may contain group markers that plugins handle via renderRow hook
    this._rows = processedRows as T[];
  }

  /**
   * Build the canonical effective configuration by merging all input sources.
   *
   * This is the **single source of truth** for the grid's configuration.
   * All inputs (gridConfig, light DOM, individual props) converge here.
   *
   * **Precedence (lowest → highest):**
   * 1. `gridConfig` property - base config object
   * 2. Light DOM `<tbw-grid-column>` elements - declarative columns
   * 3. `columns` property - programmatic columns override
   * 4. Inferred columns - auto-detected from row data
   * 5. Individual props (`fitMode`, `editOn`) - convenience overrides
   *
   * After this method runs:
   * - `#effectiveConfig` contains the merged result
   * - `_columns` is NOT set here (done by #getColumnConfiguration + #processColumns)
   * - Plugins receive config via their attach() method
   */
  #mergeEffectiveConfig(): void {
    const base: GridConfig<T> = this.#gridConfig ? { ...this.#gridConfig } : {};
    let columns: ColumnConfig<T>[] = Array.isArray(base.columns) ? [...base.columns] : [];

    // Light DOM cached parse (if already parsed by columns pipeline); non-invasive merge (fill gaps only)
    const domCols: ColumnConfig<T>[] = ((this as any).__lightDomColumnsCache || []).map((c: ColumnConfig<T>) => ({
      ...c,
    }));
    if (domCols.length) {
      const map: Record<string, ColumnConfig<T>> = {};
      columns.forEach((c) => (map[(c as any).field] = c));
      domCols.forEach((c: any) => {
        const exist = map[c.field];
        if (!exist) {
          columns.push(c);
          map[c.field] = c;
        } else {
          if (c.header && !exist.header) exist.header = c.header;
          if (c.type && !exist.type) exist.type = c.type;
          exist.sortable = exist.sortable || c.sortable;
          if (c.resizable) exist.resizable = true;
          if (c.editable) exist.editable = true;
        }
      });
    }

    // Columns prop highest structural precedence
    if (this.#columns && (this.#columns as ColumnConfig<T>[]).length) {
      columns = [...(this.#columns as ColumnConfig<T>[])];
    }

    // Inference if still empty
    if ((!columns || columns.length === 0) && this._rows.length) {
      const result = inferColumns(this._rows as Record<string, unknown>[]);
      columns = result.columns as ColumnConfig<T>[];
    }

    if (columns.length) {
      // Apply per-column defaults (sortable/resizable default true unless explicitly false)
      columns.forEach((c) => {
        if (c.sortable === undefined) c.sortable = true;
        if (c.resizable === undefined) c.resizable = true;
      });
      // Preserve processed columns (with __compiledView etc.) if already set by #getColumnConfiguration
      // Only set base.columns if effectiveConfig.columns is empty or doesn't have compiled templates
      const existingCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
      const alreadyProcessed = existingCols?.some((c) => c.__compiledView || c.__compiledEditor);
      if (alreadyProcessed) {
        // Keep existing processed columns
        base.columns = existingCols as ColumnConfig<T>[];
      } else {
        base.columns = columns;
      }
    } else {
      // No new columns computed, but preserve existing if processed
      const existingCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
      if (existingCols?.some((c) => c.__compiledView || c.__compiledEditor)) {
        base.columns = existingCols as ColumnConfig<T>[];
      }
    }

    // Individual prop overrides (behavioral)
    if (this.#fitMode) base.fitMode = this.#fitMode;
    if (!base.fitMode) base.fitMode = 'stretch';
    if (this.#editOn) base.editOn = this.#editOn;

    // Store columnState from gridConfig if not already set
    if (base.columnState && !this.#initialColumnState) {
      this.#initialColumnState = base.columnState;
    }

    this.#effectiveConfig = base;
    // Note: _columns is a getter/setter for effectiveConfig.columns
    // #getColumnConfiguration() populates it, and we preserve those processed columns above
    // Plugins (like ReorderPlugin) modify effectiveConfig.columns via the _columns setter

    // If fixed mode and width not specified: assign default 80px
    if (base.fitMode === 'fixed') {
      this._columns.forEach((c) => {
        if (c.width == null) (c as ColumnConfig<T>).width = 80;
      });
    }
  }

  // ---------------- Delegate Wrappers ----------------
  #renderVisibleRows(start: number, end: number, epoch = this.__rowRenderEpoch): void {
    // Use cached hook to avoid creating closures on every render (hot path optimization)
    if (!this.#renderRowHook) {
      this.#renderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number): boolean => {
        return this.#pluginManager?.renderRow(row, rowEl, rowIndex) ?? false;
      };
    }
    renderVisibleRows(this as any, start, end, epoch, this.#renderRowHook);
  }

  #startRowEdit(rowIndex: number, rowData: any): void {
    startRowEdit(this as unknown as any, rowIndex, rowData);
  }

  #exitRowEdit(rowIndex: number, revert: boolean): void {
    exitRowEdit(this as unknown as any, rowIndex, revert);
  }

  // ---------------- Core Helpers ----------------
  #setup(): void {
    if (!this.isConnected) return;
    if (!this.headerRowEl || !this.bodyEl) {
      return;
    }

    // Seed effectiveConfig.columns from config sources before getColumnConfiguration
    // This ensures columns from gridConfig/columns prop are available for merging with light DOM
    // Preserve hidden state from existing columns (visibility is runtime state)
    const configCols = (this.#gridConfig?.columns || this.#columns || []) as ColumnConfig<T>[];
    if (configCols.length) {
      // Preserve hidden state from existing effectiveConfig.columns
      const existingHiddenMap = new Map(this._columns.filter((c) => c.hidden).map((c) => [c.field, true]));
      const seeded = configCols.map((c) => ({
        ...c,
        hidden: existingHiddenMap.get(c.field) ?? c.hidden,
      }));
      this._columns = seeded as ColumnInternal<T>[];
    }

    this.#getColumnConfiguration();
    this.#mergeEffectiveConfig();
    this.#updatePluginConfigs(); // Sync plugin configs (including auto-detection) before processing
    this.#rebuildRowModel(); // Runs processRows hooks (must run before processColumns for tree plugin)
    this.#processColumns(); // Runs processColumns hooks

    // Apply initial column state (from gridConfig.columnState or columnState setter)
    if (this.#initialColumnState) {
      const state = this.#initialColumnState;
      this.#initialColumnState = undefined; // Clear to avoid re-applying
      this.#applyColumnStateInternal(state);
    }

    this.#renderHeader();
    this.updateTemplate();
    this.refreshVirtualWindow(true);

    const mode = this.#effectiveConfig.fitMode;
    if (mode === 'fixed' && !this.__didInitialAutoSize) {
      requestAnimationFrame(() => this.#autoSizeColumns());
    }

    // Ensure legacy inline grid styles are cleared from container
    if (this.bodyEl) {
      this.bodyEl.style.display = '';
      this.bodyEl.style.gridTemplateColumns = '';
    }

    // Run plugin afterRender hooks (column groups, sticky, etc.)
    queueMicrotask(() => this.#executeAfterRender());
  }

  /** Internal method to apply column state without triggering setup loop */
  #applyColumnStateInternal(state: GridColumnState): void {
    // Get all columns from effectiveConfig (single source of truth)
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];

    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    applyColumnState(this, state, allCols, plugins);

    // Update hidden property on columns based on state
    for (const colState of state.columns) {
      const col = allCols.find((c) => c.field === colState.field);
      if (col) {
        col.hidden = !colState.visible;
      }
    }
  }

  #shouldBypassVirtualization(): boolean {
    return this._rows.length <= this.virtualization.bypassThreshold;
  }

  #onScrollBatched(scrollTop: number): void {
    // Faux scrollbar pattern: content never scrolls, just update transforms
    // Old content stays visible until new transforms are applied
    this.refreshVirtualWindow(false);

    // Let plugins reapply visual state to recycled DOM elements
    this.#pluginManager?.onScrollRender();

    // Dispatch to plugins (using cached flag)
    if (this.#hasScrollPlugins) {
      const fauxScrollbar = this.virtualization.container;
      const scrollEvent: ScrollEvent = {
        scrollTop,
        scrollLeft: fauxScrollbar?.scrollLeft ?? 0,
        scrollHeight: fauxScrollbar?.scrollHeight ?? 0,
        scrollWidth: fauxScrollbar?.scrollWidth ?? 0,
        clientHeight: fauxScrollbar?.clientHeight ?? 0,
        clientWidth: fauxScrollbar?.clientWidth ?? 0,
        originalEvent: new Event('scroll'),
      };
      this.#pluginManager?.onScroll(scrollEvent);
    }
  }

  findHeaderRow(): HTMLElement {
    return this.#shadow.querySelector('.header-row') as HTMLElement;
  }

  findRenderedRowElement(rowIndex: number): HTMLElement | null {
    return (
      (Array.from(this.bodyEl.querySelectorAll('.data-grid-row')) as HTMLElement[]).find((r) => {
        const cell = r.querySelector('.cell[data-row]');
        return cell && Number(cell.getAttribute('data-row')) === rowIndex;
      }) || null
    );
  }

  /**
   * Dispatch a cell click event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  dispatchCellClick(event: MouseEvent, rowIndex: number, colIndex: number, cellEl: HTMLElement): boolean {
    const row = this._rows[rowIndex];
    const col = this._columns[colIndex];
    if (!row || !col) return false;

    const cellClickEvent: CellClickEvent = {
      row,
      rowIndex,
      colIndex,
      field: col.field,
      value: (row as any)[col.field],
      cellEl,
      originalEvent: event,
    };

    return this.#pluginManager?.onCellClick(cellClickEvent) ?? false;
  }

  /**
   * Dispatch a header click event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  dispatchHeaderClick(event: MouseEvent, colIndex: number, headerEl: HTMLElement): boolean {
    const col = this._columns[colIndex];
    if (!col) return false;

    const headerClickEvent: HeaderClickEvent = {
      colIndex,
      field: col.field,
      column: col,
      headerEl,
      originalEvent: event,
    };

    return this.#pluginManager?.onHeaderClick(headerClickEvent) ?? false;
  }

  /**
   * Dispatch a keyboard event to the plugin system.
   * Returns true if any plugin handled the event.
   */
  dispatchKeyDown(event: KeyboardEvent): boolean {
    return this.#pluginManager?.onKeyDown(event) ?? false;
  }

  /**
   * Build a CellMouseEvent from a native MouseEvent.
   * Extracts cell/row information from the event target.
   */
  #buildCellMouseEvent(e: MouseEvent, type: 'mousedown' | 'mousemove' | 'mouseup'): CellMouseEvent {
    // For document-level events (mousemove/mouseup during drag), e.target won't be inside shadow DOM.
    // Use composedPath to find elements inside shadow roots, or fall back to elementFromPoint.
    let target: Element | null = null;

    // composedPath gives us the full path including shadow DOM elements
    const path = e.composedPath?.() as Element[] | undefined;
    if (path && path.length > 0) {
      target = path[0];
    } else {
      target = e.target as Element;
    }

    // If target is still not inside our shadow root (e.g., for document-level events),
    // use elementFromPoint to find the actual element under the mouse
    if (target && !this.#shadow.contains(target)) {
      const elAtPoint = this.#shadow.elementFromPoint(e.clientX, e.clientY);
      if (elAtPoint) {
        target = elAtPoint;
      }
    }

    // Cells have data-col and data-row attributes
    const cellEl = target?.closest?.('[data-col]') as HTMLElement | null;
    const rowEl = target?.closest?.('.data-grid-row') as HTMLElement | null;
    const headerEl = target?.closest?.('.header-row') as HTMLElement | null;

    let rowIndex: number | undefined;
    let colIndex: number | undefined;
    let row: T | undefined;
    let field: string | undefined;
    let value: unknown;
    let column: any;

    if (cellEl) {
      // Get indices from cell attributes
      rowIndex = parseInt(cellEl.getAttribute('data-row') ?? '-1', 10);
      colIndex = parseInt(cellEl.getAttribute('data-col') ?? '-1', 10);
      if (rowIndex >= 0 && colIndex >= 0) {
        row = this._rows[rowIndex];
        column = this._columns[colIndex];
        field = column?.field;
        value = row && field ? (row as any)[field] : undefined;
      }
    }

    return {
      type,
      row,
      rowIndex: rowIndex !== undefined && rowIndex >= 0 ? rowIndex : undefined,
      colIndex: colIndex !== undefined && colIndex >= 0 ? colIndex : undefined,
      field,
      value,
      column,
      originalEvent: e,
      cellElement: cellEl ?? undefined,
      rowElement: rowEl ?? undefined,
      isHeader: !!headerEl,
      cell:
        rowIndex !== undefined && colIndex !== undefined && rowIndex >= 0 && colIndex >= 0
          ? { row: rowIndex, col: colIndex }
          : undefined,
    };
  }

  /**
   * Handle mousedown events and dispatch to plugin system.
   */
  #handleMouseDown(e: MouseEvent): void {
    const event = this.#buildCellMouseEvent(e, 'mousedown');
    const handled = this.#pluginManager?.onCellMouseDown(event) ?? false;

    // If any plugin handled mousedown, start tracking for drag
    if (handled) {
      this.#isDragging = true;
    }
  }

  /**
   * Handle mousemove events (only when dragging).
   */
  #handleMouseMove(e: MouseEvent): void {
    if (!this.#isDragging) return;

    const event = this.#buildCellMouseEvent(e, 'mousemove');
    this.#pluginManager?.onCellMouseMove(event);
  }

  /**
   * Handle mouseup events.
   */
  #handleMouseUp(e: MouseEvent): void {
    if (!this.#isDragging) return;

    const event = this.#buildCellMouseEvent(e, 'mouseup');
    this.#pluginManager?.onCellMouseUp(event);
    this.#isDragging = false;
  }

  // API consumed by internal utils (rows.ts)
  get changedRows(): T[] {
    return Array.from(this._changedRowIndices).map((i) => this._rows[i]);
  }

  get changedRowIndices(): number[] {
    return Array.from(this._changedRowIndices);
  }

  async resetChangedRows(silent?: boolean): Promise<void> {
    this._changedRowIndices.clear();
    if (!silent) {
      this.#emit('changed-rows-reset', { rows: this.changedRows, indices: this.changedRowIndices });
    }
    this.rowPool.forEach((r) => r.classList.remove('changed'));
  }

  async beginBulkEdit(rowIndex: number): Promise<void> {
    this.#startRowEdit(rowIndex, this._rows[rowIndex]);
  }

  async commitActiveRowEdit(): Promise<void> {
    if (this.activeEditRows !== -1) {
      this.#exitRowEdit(this.activeEditRows, false);
    }
  }

  async ready(): Promise<void> {
    return this.#readyPromise;
  }

  async forceLayout(): Promise<void> {
    this.#setup();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  /** Public method: returns a frozen snapshot of the merged effective configuration */
  async getConfig(): Promise<Readonly<GridConfig<T>>> {
    return Object.freeze({ ...(this.#effectiveConfig || {}) });
  }

  // ---------------- Column Visibility API ----------------

  /**
   * Set the visibility of a column.
   * @param field - The field name of the column
   * @param visible - Whether the column should be visible
   * @returns True if visibility was changed, false if column not found or locked
   */
  setColumnVisible(field: string, visible: boolean): boolean {
    // Find the column in effectiveConfig.columns (includes hidden columns)
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);

    // If column not found, cannot change visibility
    if (!col) return false;

    // Check lockVisible - cannot hide locked columns
    if (!visible && col.lockVisible) return false;

    // Check if at least one column would remain visible
    if (!visible) {
      const currentVisible = (allCols ?? []).filter((c) => !c.hidden && c.field !== field).length;
      if (currentVisible === 0) return false;
    }

    const wasHidden = !!col.hidden;
    const willBeHidden = !visible;

    // Only refresh if visibility actually changed
    if (wasHidden !== willBeHidden) {
      // Update the hidden property on the column in effectiveConfig
      col.hidden = willBeHidden;

      // Emit event for consumer preference saving
      this.#emit('column-visibility', {
        field,
        visible,
        visibleColumns: (allCols ?? []).filter((c) => !c.hidden).map((c) => c.field),
      });

      // Clear row pool to force complete rebuild with new column count
      this.rowPool.length = 0;
      if (this.bodyEl) this.bodyEl.innerHTML = '';
      this.__rowRenderEpoch++;

      // Re-setup to rebuild columns with updated visibility
      this.#setup();

      // Trigger state change after visibility change
      this.requestStateChange();
      return true;
    }
    return false;
  }

  /**
   * Toggle the visibility of a column.
   * @param field - The field name of the column
   * @returns True if visibility was toggled, false if column not found or locked
   */
  toggleColumnVisibility(field: string): boolean {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);
    const isCurrentlyHidden = !!col?.hidden;
    return this.setColumnVisible(field, isCurrentlyHidden);
  }

  /**
   * Check if a column is currently visible.
   * @param field - The field name of the column
   * @returns True if visible, false if hidden or not found
   */
  isColumnVisible(field: string): boolean {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const col = allCols?.find((c) => c.field === field);
    return col ? !col.hidden : false;
  }

  /**
   * Show all columns.
   */
  showAllColumns(): void {
    const allCols = this.#effectiveConfig.columns as ColumnInternal<T>[] | undefined;
    const hasHidden = allCols?.some((c) => c.hidden);
    if (!hasHidden) return;

    // Clear hidden flag on all columns
    allCols?.forEach((c) => {
      c.hidden = false;
    });

    this.#emit('column-visibility', {
      visibleColumns: (allCols ?? []).map((c) => c.field),
    });

    // Clear row pool to force complete rebuild with new column count
    this.rowPool.length = 0;
    if (this.bodyEl) this.bodyEl.innerHTML = '';
    this.__rowRenderEpoch++;

    this.#setup();

    // Trigger state change after visibility change
    this.requestStateChange();
  }

  /**
   * Get list of all column fields (including hidden).
   * Returns columns reflecting current display order (after reordering).
   * Hidden columns are interleaved at their original relative positions.
   * @returns Array of all field names with their visibility status
   */
  getAllColumns(): Array<{ field: string; header: string; visible: boolean; lockVisible?: boolean }> {
    // effectiveConfig.columns is the single source of truth
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];

    // Return all columns with their current visibility state
    return allCols.map((c) => ({
      field: c.field,
      header: c.header || c.field,
      visible: !c.hidden,
      lockVisible: c.lockVisible,
    }));
  }

  /**
   * Reorder columns according to the specified field order.
   * This directly updates _columns in place without going through processColumns.
   * @param order - Array of field names in the desired order
   */
  setColumnOrder(order: string[]): void {
    if (!order.length) return;

    const columnMap = new Map<string, ColumnInternal<T>>(this._columns.map((c) => [c.field as string, c]));
    const reordered: ColumnInternal<T>[] = [];

    // Add columns in specified order
    for (const field of order) {
      const col = columnMap.get(field);
      if (col) {
        reordered.push(col);
        columnMap.delete(field);
      }
    }

    // Add any remaining columns not in order
    for (const col of columnMap.values()) {
      reordered.push(col);
    }

    this._columns = reordered;

    // Re-render with new order
    this.#renderHeader();
    this.updateTemplate();
    this.refreshVirtualWindow(true);
  }

  /**
   * Get the current column order as an array of field names.
   * @returns Array of field names in display order
   */
  getColumnOrder(): string[] {
    return this._columns.map((c) => c.field);
  }

  // ---------------- Column State API ----------------

  /**
   * Get the current column state, including order, width, visibility, sort, and plugin state.
   * Returns a serializable object suitable for localStorage or database storage.
   */
  getColumnState(): GridColumnState {
    const plugins = this.#pluginManager?.getAll() ?? [];
    return collectColumnState(this, plugins as BaseGridPlugin[]);
  }

  /**
   * Set the column state, restoring order, width, visibility, sort, and plugin state.
   * Use this to restore previously saved column state.
   */
  set columnState(state: GridColumnState | undefined) {
    if (!state) return;

    // Store for use after initialization if called before ready
    this.#initialColumnState = state;

    // If already initialized, apply immediately
    if (this.#initialized) {
      this.#applyColumnState(state);
    }
  }

  /**
   * Get the current column state.
   */
  get columnState(): GridColumnState | undefined {
    return this.getColumnState();
  }

  /**
   * Apply column state internally.
   */
  #applyColumnState(state: GridColumnState): void {
    // Clear hidden flags before applying state
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
    allCols.forEach((c) => {
      c.hidden = false;
    });

    this.#applyColumnStateInternal(state);

    // Re-setup to apply changes
    this.#setup();
  }

  /**
   * Request a state change event to be emitted.
   * Called internally after resize, reorder, visibility, or sort changes.
   * Plugins should call this after changing their state.
   * The event is debounced to avoid excessive events during drag operations.
   */
  requestStateChange(): void {
    if (!this.#stateChangeHandler) {
      this.#stateChangeHandler = createStateChangeHandler(
        this,
        () => (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[],
        (state) => this.#emit('column-state-change', state)
      );
    }
    this.#stateChangeHandler();
  }

  /**
   * Reset column state to initial configuration.
   * Clears all user modifications (order, width, visibility, sort).
   */
  resetColumnState(): void {
    // Clear initial state
    this.#initialColumnState = undefined;

    // Clear hidden flag on all columns
    const allCols = (this.#effectiveConfig.columns ?? []) as ColumnInternal<T>[];
    allCols.forEach((c) => {
      c.hidden = false;
    });

    // Reset sort state
    this.sortState = null;
    this.__originalOrder = [];

    // Re-initialize columns from config
    this.#mergeEffectiveConfig();
    this.#setup();

    // Notify plugins to reset their state
    const plugins = (this.#pluginManager?.getAll() ?? []) as BaseGridPlugin[];
    for (const plugin of plugins) {
      if (plugin.applyColumnState) {
        // Pass empty state to indicate reset
        for (const col of this._columns) {
          plugin.applyColumnState(col.field, {
            field: col.field,
            order: 0,
            visible: true,
          });
        }
      }
    }

    // Emit state change
    this.requestStateChange();
  }

  // ---------------- Shell / Tool Panel API ----------------

  /**
   * Get the currently active tool panel ID, or null if none is open.
   */
  get activeToolPanel(): string | null {
    return this.#shellState.activePanel;
  }

  /**
   * Open a tool panel by ID.
   * Closes any currently open panel first.
   */
  openToolPanel(panelId: string): void {
    const panel = this.#shellState.toolPanels.get(panelId);
    if (!panel) {
      console.warn(`[tbw-grid] Tool panel "${panelId}" not found`);
      return;
    }

    // Close current panel if different
    if (this.#shellState.activePanel && this.#shellState.activePanel !== panelId) {
      this.closeToolPanel();
    }

    // Set active panel
    this.#shellState.activePanel = panelId;

    // Update UI
    updateToolbarActiveStates(this.#shadow, this.#shellState);
    updatePanelState(this.#shadow, this.#shellState);

    // Render panel content
    renderPanelContent(this.#shadow, this.#shellState);

    // Emit event
    this.#emit('tool-panel-open', { id: panelId });
  }

  /**
   * Close the currently open tool panel.
   */
  closeToolPanel(): void {
    if (!this.#shellState.activePanel) return;

    const panelId = this.#shellState.activePanel;
    const panel = this.#shellState.toolPanels.get(panelId);

    // Clean up panel content
    if (this.#shellState.activePanelCleanup) {
      this.#shellState.activePanelCleanup();
      this.#shellState.activePanelCleanup = null;
    }

    // Call panel's onClose callback
    panel?.onClose?.();

    // Clear active panel
    this.#shellState.activePanel = null;

    // Update UI
    updateToolbarActiveStates(this.#shadow, this.#shellState);
    updatePanelState(this.#shadow, this.#shellState);

    // Emit event
    this.#emit('tool-panel-close', { id: panelId });
  }

  /**
   * Toggle a tool panel open/closed.
   */
  toggleToolPanel(panelId: string): void {
    if (this.#shellState.activePanel === panelId) {
      this.closeToolPanel();
    } else {
      this.openToolPanel(panelId);
    }
  }

  /**
   * Get registered tool panel definitions.
   */
  getToolPanels(): ToolPanelDefinition[] {
    return [...this.#shellState.toolPanels.values()];
  }

  /**
   * Register a custom tool panel (without creating a plugin).
   */
  registerToolPanel(panel: ToolPanelDefinition): void {
    if (this.#shellState.toolPanels.has(panel.id)) {
      console.warn(`[tbw-grid] Tool panel "${panel.id}" already registered`);
      return;
    }
    this.#shellState.toolPanels.set(panel.id, panel);

    // Re-render shell if needed to show new toolbar button
    if (this.#shellInitialized) {
      this.#refreshShellHeader();
    }
  }

  /**
   * Unregister a custom tool panel.
   */
  unregisterToolPanel(panelId: string): void {
    // Close panel if it's open
    if (this.#shellState.activePanel === panelId) {
      this.closeToolPanel();
    }

    this.#shellState.toolPanels.delete(panelId);

    // Re-render shell if needed to remove toolbar button
    if (this.#shellInitialized) {
      this.#refreshShellHeader();
    }
  }

  /**
   * Get registered header content definitions.
   */
  getHeaderContents(): HeaderContentDefinition[] {
    return [...this.#shellState.headerContents.values()];
  }

  /**
   * Register custom header content (without creating a plugin).
   */
  registerHeaderContent(content: HeaderContentDefinition): void {
    if (this.#shellState.headerContents.has(content.id)) {
      console.warn(`[tbw-grid] Header content "${content.id}" already registered`);
      return;
    }
    this.#shellState.headerContents.set(content.id, content);

    // Render the content if shell is initialized
    if (this.#shellInitialized) {
      renderHeaderContent(this.#shadow, this.#shellState);
    }
  }

  /**
   * Unregister custom header content.
   */
  unregisterHeaderContent(contentId: string): void {
    // Clean up
    const cleanup = this.#shellState.headerContentCleanups.get(contentId);
    if (cleanup) {
      cleanup();
      this.#shellState.headerContentCleanups.delete(contentId);
    }

    // Call onDestroy
    const content = this.#shellState.headerContents.get(contentId);
    content?.onDestroy?.();

    this.#shellState.headerContents.delete(contentId);

    // Remove DOM element
    const el = this.#shadow.querySelector(`[data-header-content="${contentId}"]`);
    el?.remove();
  }

  /**
   * Get all registered toolbar buttons.
   */
  getToolbarButtons(): ToolbarButtonInfo[] {
    return getToolbarButtonsInfo(this.#effectiveConfig?.shell, this.#shellState);
  }

  /**
   * Register a custom toolbar button programmatically.
   */
  registerToolbarButton(button: ToolbarButtonConfig): void {
    if (this.#shellState.toolbarButtons.has(button.id)) {
      console.warn(`[tbw-grid] Toolbar button "${button.id}" already registered`);
      return;
    }
    this.#shellState.toolbarButtons.set(button.id, button);

    // Re-render shell if needed
    if (this.#shellInitialized) {
      this.#refreshShellHeader();
    }
  }

  /**
   * Unregister a custom toolbar button.
   */
  unregisterToolbarButton(buttonId: string): void {
    // Clean up
    const cleanup = this.#shellState.toolbarButtonCleanups.get(buttonId);
    if (cleanup) {
      cleanup();
      this.#shellState.toolbarButtonCleanups.delete(buttonId);
    }

    this.#shellState.toolbarButtons.delete(buttonId);

    // Re-render shell if needed
    if (this.#shellInitialized) {
      this.#refreshShellHeader();
    }
  }

  /**
   * Enable/disable a toolbar button by ID.
   */
  setToolbarButtonDisabled(buttonId: string, disabled: boolean): void {
    // Check API-registered buttons
    const apiBtn = this.#shellState.toolbarButtons.get(buttonId);
    if (apiBtn) {
      apiBtn.disabled = disabled;
    }

    // Update DOM
    const btn = this.#shadow.querySelector(`[data-btn="${buttonId}"]`) as HTMLButtonElement | null;
    if (btn) {
      btn.disabled = disabled;
    }
  }

  /**
   * Re-parse light DOM shell elements and refresh shell header.
   * Call this after dynamically modifying <tbw-grid-header> children.
   */
  refreshShellHeader(): void {
    this.#refreshShellHeader();
  }

  /**
   * Internal shell header refresh.
   */
  #refreshShellHeader(): void {
    // Re-parse light DOM
    parseLightDomShell(this, this.#shellState);

    // Re-render the entire grid (shell structure may change)
    this.#render();
    this.#afterConnect();
  }

  // ---------------- Virtual Window ----------------
  /**
   * Core virtualization routine. Chooses between bypass (small datasets), grouped window rendering,
   * or standard row window rendering.
   */
  refreshVirtualWindow(force = false): void {
    if (!this.bodyEl) return;

    const totalRows = this._rows.length;

    if (!this.virtualization.enabled) {
      this.#renderVisibleRows(0, totalRows);
      this.#executeAfterRender();
      return;
    }

    if (this.#shouldBypassVirtualization()) {
      this.virtualization.start = 0;
      this.virtualization.end = totalRows;
      this.bodyEl.style.transform = 'translateY(0px)';
      this.#renderVisibleRows(0, totalRows, this.__rowRenderEpoch);
      if (this.virtualization.totalHeightEl) {
        this.virtualization.totalHeightEl.style.height = `${totalRows * this.virtualization.rowHeight}px`;
      }
      this.setAttribute('aria-rowcount', String(totalRows));
      this.setAttribute('aria-colcount', String(this.visibleColumns.length));
      this.#executeAfterRender();
      return;
    }

    // --- Normal virtualization path with faux scrollbar pattern ---
    // Faux scrollbar provides scrollTop, viewport provides visible height
    const fauxScrollbar = this.virtualization.container ?? this;
    const viewportEl = this.virtualization.viewportEl ?? fauxScrollbar;
    const viewportHeight = viewportEl.clientHeight;
    const rowHeight = this.virtualization.rowHeight;
    const scrollTop = fauxScrollbar.scrollTop;

    // When plugins add extra height (e.g., expanded details), the scroll position
    // includes that extra height. We need to find the actual row at scrollTop
    // by iteratively accounting for cumulative extra heights.
    // This prevents jumping when scrolling past expanded content.
    let start = Math.floor(scrollTop / rowHeight);

    // Iteratively refine: the initial guess may be too high because scrollTop
    // includes extra heights from expanded rows before it. Adjust downward.
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loop
    while (iterations < maxIterations) {
      const extraHeightBefore = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
      const adjustedStart = Math.floor((scrollTop - extraHeightBefore) / rowHeight);
      if (adjustedStart >= start || adjustedStart < 0) break;
      start = adjustedStart;
      iterations++;
    }

    // Faux scrollbar pattern: calculate effective position for this start
    // With translateY(0), the first rendered row appears at viewport top
    // Round down to even number so DOM nth-child(even) always matches data row parity
    // This prevents zebra stripe flickering during scroll since rows shift in pairs
    start = start - (start % 2);
    if (start < 0) start = 0;

    // Allow plugins to extend the start index backwards
    // (e.g., to keep expanded detail rows visible as they scroll out)
    const pluginAdjustedStart = this.#pluginManager?.adjustVirtualStart(start, scrollTop, rowHeight);
    if (pluginAdjustedStart !== undefined && pluginAdjustedStart < start) {
      start = pluginAdjustedStart;
      // Re-apply even alignment after plugin adjustment
      start = start - (start % 2);
      if (start < 0) start = 0;
    }

    // Faux pattern buffer: render 2 extra rows below for smooth edge transition
    // This is smaller than traditional overscan since sub-pixel offset handles smoothness
    // +1 extra to account for the even-alignment above potentially showing 1 more row at top
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 3;
    let end = start + visibleCount;
    if (end > totalRows) end = totalRows;

    this.virtualization.start = start;
    this.virtualization.end = end;

    // Height spacer for scrollbar
    // Add 1 extra row height to account for even-alignment: when we round down
    // from odd to even start, we need extra scroll range to reveal the last row
    // Also add footer height: faux-vscroll is outside .tbw-scroll-area so it doesn't
    // shrink when footer is present - we need extra spacer to scroll past the footer
    const footerEl = this.#shadow.querySelector('.tbw-footer') as HTMLElement;
    const footerHeight = footerEl?.offsetHeight ?? 0;
    // Add extra height from plugins (e.g., expanded master-detail rows)
    // This ensures the scrollbar range accounts for all content including expanded details
    const pluginExtraHeight = this.#pluginManager?.getExtraHeight() ?? 0;
    if (this.virtualization.totalHeightEl) {
      this.virtualization.totalHeightEl.style.height = `${
        totalRows * rowHeight + rowHeight + footerHeight + pluginExtraHeight
      }px`;
    }

    // Smooth scroll: apply offset for fluid motion
    // Since start is even-aligned, offset is distance from that aligned position
    // This creates smooth sliding while preserving zebra stripe parity
    // Account for extra heights (expanded details) before the start row
    const extraHeightBeforeStart = this.#pluginManager?.getExtraHeightBefore?.(start) ?? 0;
    const subPixelOffset = -(scrollTop - start * rowHeight - extraHeightBeforeStart);
    this.bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    this.#renderVisibleRows(start, end, force ? ++this.__rowRenderEpoch : this.__rowRenderEpoch);

    this.setAttribute('aria-rowcount', String(totalRows));
    this.setAttribute('aria-colcount', String(this.visibleColumns.length));

    // Only run plugin afterRender hooks on force refresh (structural changes)
    // Skip on scroll-triggered renders for maximum performance
    if (force) {
      this.#executeAfterRender();
    }
  }

  // ---------------- Render ----------------
  #render(): void {
    // Parse light DOM shell elements before rendering
    parseLightDomShell(this, this.#shellState);

    // Get shell config
    const shellConfig = this.#effectiveConfig?.shell;

    // Determine if shell should be rendered
    const hasShell = shouldRenderShellHeader(shellConfig, this.#shellState);

    // Core grid content HTML
    // Uses faux scrollbar pattern (like AG Grid) for smooth virtualized scrolling:
    // - .tbw-grid-content: outer container (row layout: scroll-area + faux-vscroll)
    // - .tbw-scroll-area: horizontal scroll container (overflow-x: auto) - footer appends here
    // - .rows-body-wrapper: header + rows in column layout
    // - .faux-vscroll: vertical scrollbar at inline-end, sticky during horizontal scroll
    // - .rows-viewport: visible rows area (no scroll, overflow hidden)
    // - Scroll events come from faux scrollbar, content positioned via transforms
    // This prevents blank viewport during fast scroll - old content stays until new renders
    const gridContentHtml = `
      <div class="tbw-scroll-area">
        <div class="rows-body-wrapper">
          <div class="rows-body">
            <div class="header">
              <div class="header-row" part="header-row"></div>
            </div>
            <div class="rows-container">
              <div class="rows-viewport">
                <div class="rows"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="faux-vscroll">
        <div class="faux-vscroll-spacer"></div>
      </div>
    `;

    if (hasShell) {
      // Build shell DOM structure
      const shellHeaderHtml = renderShellHeader(shellConfig, this.#shellState);
      const shellBodyHtml = renderShellBody(shellConfig, this.#shellState, gridContentHtml);

      this.#shadow.innerHTML = `
        <div class="tbw-grid-root has-shell">
          ${shellHeaderHtml}
          ${shellBodyHtml}
        </div>
      `;

      // Set up shell event listeners
      this.#setupShellListeners();

      // Mark shell as initialized
      this.#shellInitialized = true;
    } else {
      // Build minimal DOM structure (no shell)
      // Wrap in .tbw-grid-content for consistent horizontal scroll behavior
      this.#shadow.innerHTML = `
        <div class="tbw-grid-root">
          <div class="tbw-grid-content">
            ${gridContentHtml}
          </div>
        </div>
      `;
    }
  }

  /**
   * Set up shell event listeners after render.
   */
  #setupShellListeners(): void {
    setupShellEventListeners(this.#shadow, this.#effectiveConfig?.shell, this.#shellState, {
      onPanelToggle: (panelId) => this.toggleToolPanel(panelId),
      onPanelClose: () => this.closeToolPanel(),
      onToolbarButtonClick: (buttonId) => this.#handleToolbarButtonClick(buttonId),
    });
  }

  /**
   * Handle toolbar button click (for config buttons with action).
   */
  #handleToolbarButtonClick(buttonId: string): void {
    // Check config buttons
    const configButtons = this.#effectiveConfig?.shell?.header?.toolbarButtons ?? [];
    const configBtn = configButtons.find((b) => b.id === buttonId);
    if (configBtn?.action) {
      configBtn.action();
      return;
    }

    // Check API-registered buttons
    const apiBtn = this.#shellState.toolbarButtons.get(buttonId);
    if (apiBtn?.action) {
      apiBtn.action();
    }
  }
}

// Self-registering custom element
if (!customElements.get(DataGridElement.tagName)) {
  customElements.define(DataGridElement.tagName, DataGridElement);
}

// Type augmentation for querySelector/createElement
declare global {
  interface HTMLElementTagNameMap {
    'tbw-grid': DataGridElement;
  }
}

/**
 * Master/Detail Plugin (Class-based)
 *
 * Enables expandable detail rows showing additional content for each row.
 * Animation style is plugin-configured; respects grid-level animation.mode.
 */

import { evalTemplateString, sanitizeHTML } from '../../core/internal/sanitize';
import {
  BaseGridPlugin,
  CellClickEvent,
  GridElement,
  type PluginManifest,
  RowClickEvent,
} from '../../core/plugin/base-plugin';
import { createExpanderColumnConfig, findExpanderColumn, isExpanderColumn } from '../../core/plugin/expander-column';
import type { ColumnConfig, GridHost } from '../../core/types';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  FetchChildrenQuery,
} from '../server-side/datasource-types';
import { isFormFieldKeyTarget } from '../shared/form-field-target';
import {
  isMasterDetailToggleTarget,
  isStructuralToggleTarget,
  MASTER_DETAIL_TOGGLE_CLASS,
} from '../shared/structural-toggle';
import { collapseDetailRow, createDetailElement, expandDetailRow, isDetailExpanded } from './master-detail';
import styles from './master-detail.css?inline';
import type { DetailExpandDetail, DetailLoadErrorDetail, ExpandCollapseAnimation, MasterDetailConfig } from './types';

/**
 * Master-Detail Plugin for tbw-grid
 *
 * Creates expandable detail rows that reveal additional content beneath each master row.
 * Perfect for order/line-item UIs, employee/department views, or any scenario where
 * you need to show related data without navigating away.
 *
 * ## Installation
 *
 * ```ts
 * import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
 * ```
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-master-detail-bg` | `var(--tbw-color-row-alt)` | Detail row background |
 * | `--tbw-master-detail-border` | `var(--tbw-color-border)` | Detail row border |
 * | `--tbw-detail-padding` | `1em` | Detail content padding |
 * | `--tbw-animation-duration` | `200ms` | Expand/collapse animation |
 *
 * @example Basic Master-Detail with HTML Template
 * ```ts
 * import '@toolbox-web/grid';
 * import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
 *
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'orderId', header: 'Order ID' },
 *     { field: 'customer', header: 'Customer' },
 *     { field: 'total', header: 'Total', type: 'currency' },
 *   ],
 *   plugins: [
 *     new MasterDetailPlugin({
 *       detailRenderer: (row) => `
 *         <div class="order-details">
 *           <h4>Order Items</h4>
 *           <ul>${row.items.map(i => `<li>${i.name} - $${i.price}</li>`).join('')}</ul>
 *         </div>
 *       `,
 *     }),
 *   ],
 * };
 * ```
 *
 * @example Nested Grid in Detail
 * ```ts
 * new MasterDetailPlugin({
 *   detailRenderer: (row) => {
 *     const childGrid = document.createElement('tbw-grid');
 *     childGrid.style.height = '200px';
 *     childGrid.gridConfig = { columns: [...] };
 *     childGrid.rows = row.items || [];
 *     return childGrid;
 *   },
 * })
 * ```
 *
 * @see {@link MasterDetailConfig} for all configuration options
 * @see {@link DetailExpandDetail} for expand/collapse event details
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class MasterDetailPlugin extends BaseGridPlugin<MasterDetailConfig> {
  /** @internal */
  readonly name = 'masterDetail';
  /** @internal */
  override readonly styles = styles;

  /**
   * Plugin manifest - declares hook priorities.
   * @internal
   */
  static override readonly manifest: PluginManifest<MasterDetailConfig> = {
    hookPriority: {
      // Claim toggle clicks before Editing/Selection, whatever the registration order (#565)
      onCellClick: -10,
    },
  };

  /**
   * Optional dependency on ServerSide for async detail data.
   * When loaded, MasterDetail can fetch detail data via `datasource:fetch-children`.
   */
  static override readonly dependencies = [
    { name: 'serverSide', required: false, reason: 'Fetches detail data via datasource:fetch-children on expand' },
  ];

  /** Typed internal grid accessor. */
  get #internalGrid(): GridHost {
    return this.grid;
  }

  /** @internal */
  protected override get defaultConfig(): Partial<MasterDetailConfig> {
    return {
      detailHeight: 'auto',
      expandOnRowClick: false,
      // Note: showExpandColumn is intentionally NOT defaulted here.
      // If undefined, processColumns() adds expander only when detailRenderer is provided.
      // Set to true for framework adapters that register renderers asynchronously.
      animation: 'slide', // Plugin's own default
    };
  }

  // #region Light DOM Parsing

  /**
   * Called when plugin is attached to the grid.
   * Parses light DOM for `<tbw-grid-detail>` elements to configure detail templates.
   * @internal
   */
  override attach(grid: GridElement): void {
    super.attach(grid);
    this.parseLightDomDetail();

    // Listen for datasource:children — receive async detail data from ServerSide
    this.on('datasource:children', (detail: unknown) => {
      const d = detail as DataSourceChildrenDetail;
      if (d.context?.source !== 'master-detail') return;
      d.claimed = true;

      const row = d.context.row;
      this.detailLoads.delete(row);
      if (row && this.#isRowExpanded(row)) {
        this.detailDataMap.set(row, d.rows);
        this.#invalidateDetail(row);
        this.requestRender();
      }
    });

    // Listen for datasource:error — release the row's loading state so the
    // detail re-renders; collapsing and re-expanding retries the fetch.
    this.on('datasource:error', (detail: unknown) => {
      const d = detail as DataSourceErrorDetail;
      if (d.context?.source !== 'master-detail') return;
      const row = d.context.row as Record<string, unknown> | undefined;
      if (!row || !this.detailLoads.delete(row)) return;
      this.#invalidateDetail(row);
      this.emit<DetailLoadErrorDetail>('detail-load-error', {
        rowIndex: this.rows.indexOf(row),
        row,
        error: d.error,
      });
      this.requestRender();
    });

    // Root rows were replaced (block load, page change, refresh). Sweep on the
    // next render, once `rows` reflects the new data and `claimed` is settled.
    this.on('datasource:data', (detail: unknown) => {
      this.#rootDataReplaced = detail as DataSourceDataDetail;
    });
  }

  /**
   * Abort detail loads whose master row was discarded by a root-data replacement.
   * ServerSide leaves child-request cancellation to the requester, so without this
   * repeated refreshes with slow responses pile up obsolete rows forever (#539).
   *
   * Skipped when a hierarchy plugin claimed the data: it derives its own row model
   * and keeps collapsed children off `rows`, so absence is not proof of discard.
   */
  #sweepDiscardedLoads(): void {
    const replaced = this.#rootDataReplaced;
    this.#rootDataReplaced = undefined;
    if (!replaced || replaced.claimed || this.detailLoads.size === 0) return;

    const live = new Set<unknown>(this.rows);
    for (const row of this.detailLoads.keys()) {
      if (!live.has(row)) this.#cancelDetailLoad(row);
    }
  }

  /**
   * Whether a row can have a detail panel. Synthetic group headers and
   * ServerSide loading placeholders (`__loading`) never do (#535).
   */
  #isDetailRow(row: unknown): boolean {
    if (row == null) return false;
    const r = row as { __isGroupRow?: unknown; __loading?: unknown };
    return !r.__isGroupRow && r.__loading !== true;
  }

  /**
   * Whether a row's detail is currently expanded. While `expandAll()` is active
   * expansion is DERIVED — every detail row counts as expanded unless it was
   * explicitly collapsed — so rows the data source delivers later (ServerSide
   * blocks, Tree / GroupingRows children) are expanded the moment they appear,
   * without storing a reference to every row ever seen (#535).
   */
  #isRowExpanded(row: unknown): boolean {
    if (!this.#isDetailRow(row)) return false;
    if (isDetailExpanded(this.expandedRows, row as object)) return true;
    return this.#expandAllActive && !this.#expandAllExcluded.has(row as object);
  }

  /** Whether any row could be expanded — cheap pre-check for the render paths. */
  #hasExpandedRows(): boolean {
    return this.#expandAllActive || this.expandedRows.size > 0;
  }

  /** Record an explicit expand/collapse, overriding the `expandAll()` default. */
  #setExpanded(row: object, expanded: boolean): void {
    if (expanded) {
      this.#expandAllExcluded.delete(row);
      this.expandedRows = expandDetailRow(this.expandedRows, row);
    } else {
      this.expandedRows = collapseDetailRow(this.expandedRows, row);
      if (this.#expandAllActive) this.#expandAllExcluded.add(row);
    }
  }

  /** Remove a row's detail element so `#syncDetailRows` recreates it on the next render. */
  #invalidateDetail(row: unknown): void {
    const existingDetail = this.detailElements.get(row);
    if (existingDetail) {
      this.#releaseDetail(row, existingDetail);
      this.measuredDetailHeights.delete(row);
    }
  }

  /**
   * Tear down a detail panel: release framework adapter resources (React root,
   * Vue app, Angular view) BEFORE removing the DOM, then stop tracking it.
   * Every removal path MUST go through here — dropping the `detailElements`
   * entry without `unmount` orphans the framework view until adapter teardown.
   */
  #releaseDetail(row: unknown, detailEl: HTMLElement): void {
    const adapter = this.#internalGrid.__frameworkAdapter;
    if (adapter?.unmount) {
      const detailCell = detailEl.querySelector('.master-detail-cell');
      const container = detailCell?.firstElementChild as HTMLElement | null;
      if (container) adapter.unmount(container);
    }
    if (detailEl.parentNode) detailEl.remove();
    this.detailElements.delete(row);
  }

  /**
   * Request a newly expanded row's detail data from ServerSide. EVERY expand
   * path (expander click, `expand`, `toggle`, `expandAll`) MUST call this (#532).
   * No-op when the data is cached or in flight, for ServerSide loading
   * placeholders, or when no data source is active. `expandAll` passes
   * `serverSideActive` so the query runs once, not once per row.
   */
  #requestDetailData(row: unknown, rowIndex: number, serverSideActive?: boolean): void {
    if (this.detailDataMap.has(row) || this.detailLoads.has(row)) return;
    if (!this.#isDetailRow(row)) return;
    // One attempt per row until it is explicitly collapsed — `#syncDetailRows`
    // calls this on every render, so a failed fetch must not retry in a loop.
    if (this.#detailRequested.has(row as object)) return;
    if (!(serverSideActive ?? this.queryBoolean('datasource:is-active'))) return;
    this.#detailRequested.add(row as object);
    const controller = new AbortController();
    this.detailLoads.set(row, controller);
    this.grid.query('datasource:fetch-children', {
      context: { source: 'master-detail', row, rowIndex },
      signal: controller.signal,
    } satisfies FetchChildrenQuery);
  }

  /** A collapsed row discards its detail data, so abort its in-flight fetch. */
  #cancelDetailLoad(row: unknown): void {
    this.detailLoads.get(row)?.abort();
    this.detailLoads.delete(row);
    if (row !== null && typeof row === 'object') this.#detailRequested.delete(row);
  }

  /**
   * Parse `<tbw-grid-detail>` elements from the grid's light DOM.
   *
   * Allows declarative configuration:
   * ```html
   * <tbw-grid [rows]="data">
   *   <tbw-grid-detail>
   *     <div class="detail-content">
   *       <p>Name: {{ row.name }}</p>
   *       <p>Email: {{ row.email }}</p>
   *     </div>
   *   </tbw-grid-detail>
   * </tbw-grid>
   * ```
   *
   * Attributes:
   * - `animation`: 'slide' | 'fade' | 'false' (default: 'slide')
   * - `show-expand-column`: 'true' | 'false' (default: 'true')
   * - `expand-on-row-click`: 'true' | 'false' (default: 'false')
   * - `height`: number (pixels) or 'auto' (default: 'auto')
   */
  private parseLightDomDetail(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const detailEl = gridEl.querySelector('tbw-grid-detail');
    if (!detailEl) return;

    // Check if a framework adapter wants to handle this element
    // (e.g., Angular adapter intercepts for ng-template rendering)
    const adapter = this.#internalGrid.__frameworkAdapter;
    if (adapter?.parseDetailElement) {
      const adapterRenderer = adapter.parseDetailElement(detailEl);
      if (adapterRenderer) {
        this.config = { ...this.config, detailRenderer: adapterRenderer };
        return;
      }
    }

    // Parse attributes for configuration
    const animation = detailEl.getAttribute('animation');
    const showExpandColumn = detailEl.getAttribute('show-expand-column');
    const expandOnRowClick = detailEl.getAttribute('expand-on-row-click');
    const heightAttr = detailEl.getAttribute('height');

    const configUpdates: Partial<MasterDetailConfig> = {};

    if (animation !== null) {
      configUpdates.animation = animation === 'false' ? false : (animation as 'slide' | 'fade');
    }
    if (showExpandColumn !== null) {
      configUpdates.showExpandColumn = showExpandColumn !== 'false';
    }
    if (expandOnRowClick !== null) {
      configUpdates.expandOnRowClick = expandOnRowClick === 'true';
    }
    if (heightAttr !== null) {
      configUpdates.detailHeight = heightAttr === 'auto' ? 'auto' : parseInt(heightAttr, 10);
    }

    // Get template content from innerHTML
    const templateHTML = detailEl.innerHTML.trim();
    if (templateHTML && !this.config.detailRenderer) {
      // Create a template-based renderer using the inner HTML
      configUpdates.detailRenderer = (row: any, _rowIndex: number): string => {
        // Evaluate template expressions like {{ row.field }}
        const evaluated = evalTemplateString(templateHTML, { value: row, row });
        // Sanitize the result to prevent XSS
        return sanitizeHTML(evaluated);
      };
    }

    // Merge updates into config
    if (Object.keys(configUpdates).length > 0) {
      this.config = { ...this.config, ...configUpdates };
    }
  }

  // #endregion

  // #region Animation Helpers

  /**
   * Get expand/collapse animation style from plugin config.
   * Uses base class isAnimationEnabled to respect grid-level settings.
   */
  private get animationStyle(): ExpandCollapseAnimation {
    if (!this.isAnimationEnabled) return false;
    return this.config.animation ?? 'slide';
  }

  /**
   * Apply expand animation to a detail element.
   * Returns true if animation was applied, false if skipped.
   * When animated, height measurement is deferred to animationend to avoid
   * measuring during the max-height: 0 CSS animation constraint.
   */
  private animateExpand(detailEl: HTMLElement, row?: any, rowIndex?: number): boolean {
    if (!this.isAnimationEnabled || this.animationStyle === false) return false;

    detailEl.classList.add('tbw-expanding');

    let measured = false;
    const measureOnce = () => {
      if (measured) return;
      measured = true;
      detailEl.classList.remove('tbw-expanding');

      // Measure height AFTER animation completes - the element now has its
      // natural height without the max-height constraint from the animation.
      if (row !== undefined && rowIndex !== undefined) {
        this.#measureAndCacheDetailHeight(detailEl, row, rowIndex);
      }
    };

    detailEl.addEventListener('animationend', measureOnce, { once: true });
    // Fallback timeout in case animationend doesn't fire (e.g., element detached,
    // animation removed, or framework rendering delays). Matches animateCollapse pattern.
    setTimeout(measureOnce, this.animationDuration + 50);
    return true;
  }

  /**
   * Apply collapse animation to a detail element and remove after animation.
   */
  private animateCollapse(detailEl: HTMLElement, onComplete: () => void): void {
    if (!this.isAnimationEnabled || this.animationStyle === false) {
      onComplete();
      return;
    }

    detailEl.classList.add('tbw-collapsing');
    const cleanup = () => {
      detailEl.classList.remove('tbw-collapsing');
      onComplete();
    };
    detailEl.addEventListener('animationend', cleanup, { once: true });
    // Fallback timeout in case animation doesn't fire
    setTimeout(cleanup, this.animationDuration + 50);
  }

  /**
   * Measure a detail element's height and update the position cache if it changed.
   * Used after layout settles (RAF) or after animation completes (animationend).
   */
  #measureAndCacheDetailHeight(detailEl: HTMLElement, row: any, rowIndex: number): void {
    if (!detailEl.isConnected) return;

    const height = detailEl.offsetHeight;
    if (height > 0) {
      const previousHeight = this.measuredDetailHeights.get(row);
      this.measuredDetailHeights.set(row, height);

      // Only invalidate if height actually changed
      // This triggers an incremental position cache update, not a full rebuild
      if (previousHeight !== height) {
        this.grid.invalidateRowHeight(rowIndex);
      }
    }
  }

  // #endregion

  // #region Internal State
  private expandedRows: Set<any> = new Set();
  private detailElements: Map<any, HTMLElement> = new Map();
  /**
   * Cached measured heights - persists even when elements are virtualized out.
   * Weak: under `expandAll()` every row scrolled into view is measured, so a
   * strong map would pin rows the ServerSide block cache has already evicted.
   */
  private measuredDetailHeights: WeakMap<any, number> = new WeakMap();
  /** Rows that were just expanded by user action and should animate.
   * Prevents re-animation when rows scroll back into the virtual window. */
  private rowsToAnimate: Set<any> = new Set();
  /**
   * In-flight `datasource:fetch-children` requests, keyed by row — also the
   * source of truth for {@link isDetailLoading}. Each controller's signal is
   * passed as `FetchChildrenQuery.signal`, so aborting it (collapse, detach)
   * cancels `getChildRows()` and drops its result.
   */
  private detailLoads: Map<unknown, AbortController> = new Map();
  /**
   * Child rows received via datasource:children, keyed by parent row reference.
   * Weak for the same reason as `measuredDetailHeights`.
   */
  private detailDataMap: WeakMap<any, unknown[]> = new WeakMap();
  /**
   * Set by `expandAll()`, cleared by `collapseAll()` / `detach()`. While set,
   * every detail row counts as expanded unless listed in `#expandAllExcluded`,
   * so rows delivered later are expanded without being tracked (#535).
   */
  #expandAllActive = false;
  /** Rows explicitly collapsed while `#expandAllActive` — weak, so dropped rows are collectable. */
  #expandAllExcluded = new WeakSet<object>();
  /** Rows whose detail data was already requested once (reset on explicit collapse). */
  #detailRequested = new WeakSet<object>();
  /** Pending `datasource:data` broadcast, consumed by the next `#sweepDiscardedLoads()`. */
  #rootDataReplaced: DataSourceDataDetail | undefined;

  /** Default height for detail rows when not configured */
  private static readonly DEFAULT_DETAIL_HEIGHT = 150;

  /**
   * Get the estimated height for a detail row.
   * Uses cached measured height when available (survives virtualization).
   * Avoids reading offsetHeight during CSS animations to prevent poisoning the cache.
   */
  private getDetailHeight(row: any): number {
    // Try DOM element first - works for tests and when element is connected
    const detailEl = this.detailElements.get(row);
    if (detailEl) {
      // Skip DOM measurement if currently animating (max-height constraint gives wrong value)
      const isAnimating = detailEl.classList.contains('tbw-expanding') || detailEl.classList.contains('tbw-collapsing');
      if (!isAnimating) {
        const height = detailEl.offsetHeight;
        if (height > 0) {
          // Cache the measurement for when this row is virtualized out
          this.measuredDetailHeights.set(row, height);
          return height;
        }
      }
    }

    // DOM element missing, detached, or animating - check cached measurement
    const cachedHeight = this.measuredDetailHeights.get(row);
    if (cachedHeight && cachedHeight > 0) {
      return cachedHeight;
    }

    // Fallback to config or default
    return typeof this.config?.detailHeight === 'number'
      ? this.config.detailHeight
      : MasterDetailPlugin.DEFAULT_DETAIL_HEIGHT;
  }

  /**
   * Toggle a row's detail and emit event.
   * Skips synthetic rows (e.g., group headers from GroupingRowsPlugin).
   */
  private toggleAndEmit(row: any, rowIndex: number): void {
    // Synthetic rows (group headers, loading placeholders) don't have detail content
    if (!this.#isDetailRow(row)) return;

    const expanded = !this.#isRowExpanded(row);
    this.#setExpanded(row as object, expanded);
    if (expanded) this.rowsToAnimate.add(row);
    else this.#cancelDetailLoad(row);

    // Announce the new state before fetching: the request can fail synchronously,
    // and `detail-load-error` must never precede its `detail-expand` (#539).
    this.emit<DetailExpandDetail>('detail-expand', {
      rowIndex,
      row: row as Record<string, unknown>,
      expanded,
    });

    // A `detail-expand` listener may have collapsed the row again.
    if (expanded && this.#isRowExpanded(row)) this.#requestDetailData(row, rowIndex);
    this.requestRender();
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.expandedRows.clear();
    this.detailElements.clear();
    this.measuredDetailHeights = new WeakMap();
    this.rowsToAnimate.clear();
    for (const controller of this.detailLoads.values()) controller.abort();
    this.detailLoads.clear();
    this.detailDataMap = new WeakMap();
    this.#expandAllActive = false;
    this.#expandAllExcluded = new WeakSet();
    this.#detailRequested = new WeakSet();
    this.#rootDataReplaced = undefined;
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Determine whether to add the expander column:
    // 1. If showExpandColumn === false: never add (explicit opt-out)
    // 2. If showExpandColumn === true: always add (explicit opt-in, for framework adapters)
    // 3. If showExpandColumn is undefined: add only if detailRenderer is provided
    //
    // This supports React/Angular adapters which register renderers asynchronously via light DOM.
    // They must set showExpandColumn: true to get the column immediately, avoiding layout shift.
    const shouldAddExpander =
      this.config.showExpandColumn === true || (this.config.showExpandColumn !== false && !!this.config.detailRenderer);

    if (!shouldAddExpander) {
      return [...columns];
    }

    const cols = [...columns];

    // Check if expander column already exists (from this or another plugin)
    const existingExpander = findExpanderColumn(cols);
    if (existingExpander) {
      // Another plugin already added an expander column - don't add duplicate
      // Our expand logic will be handled via onCellClick on the expander column
      return cols;
    }

    // Create dedicated expander column that stays fixed at position 0
    const expanderCol = createExpanderColumnConfig(this.name);
    expanderCol.viewRenderer = (renderCtx) => {
      const { row } = renderCtx;
      const isExpanded = this.#isRowExpanded(row);

      const container = document.createElement('span');
      container.className = 'master-detail-expander expander-cell';

      // Expand/collapse toggle icon
      const toggle = document.createElement('span');
      toggle.className = `${MASTER_DETAIL_TOGGLE_CLASS}${isExpanded ? ' expanded' : ''}`;
      // Use grid-level icons (fall back to defaults)
      this.setIcon(toggle, isExpanded ? 'collapse' : 'expand');
      // role="button" is required for aria-expanded to be valid
      toggle.setAttribute('role', 'button');
      toggle.setAttribute('tabindex', '0');
      toggle.setAttribute('aria-expanded', String(isExpanded));
      toggle.setAttribute('aria-label', isExpanded ? 'Collapse details' : 'Expand details');
      container.appendChild(toggle);

      return container;
    };

    // Prepend expander column to ensure it's always first
    return [expanderCol, ...cols];
  }

  /** @internal */
  override onRowClick(event: RowClickEvent): boolean | void {
    if (!this.config.expandOnRowClick || !this.config.detailRenderer) return;
    // Toggle clicks (ours, tree, group) belong to their expander's onCellClick; toggling here
    // too would undo ours or open a detail for someone else's (PR #567 review)
    if (isStructuralToggleTarget(event.originalEvent)) return;
    this.toggleAndEmit(event.row, event.rowIndex);
    return false;
  }

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean | void {
    // Handle click on master-detail toggle icon (same pattern as TreePlugin)
    if (isMasterDetailToggleTarget(event.originalEvent)) {
      this.toggleAndEmit(event.row, event.rowIndex);
      return true; // Prevent default handling
    }

    // Sync detail rows after cell click triggers refreshVirtualWindow
    // This runs in microtask to ensure DOM updates are complete
    if (this.#hasExpandedRows()) {
      queueMicrotask(() => this.#syncDetailRows());
    }
    return; // Don't prevent default
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion when focus is on the expander column
    if (event.key !== ' ') return;
    // Inputs in an editor or the detail panel own Space (#546).
    if (isFormFieldKeyTarget(event)) return;

    const focusCol = this.grid._focusCol;
    const focusRow = this.grid._focusRow;
    // _focusCol is a visible-column index (set from data-col), so use visibleColumns
    const column = this.visibleColumns[focusCol];

    // Only handle SPACE on expander column
    if (!column || !isExpanderColumn(column)) return;

    const row = this.rows[focusRow];
    if (!row) return;

    event.preventDefault();
    this.toggleAndEmit(row, focusRow);

    // Restore focus styling after render completes via render pipeline
    this.requestRenderWithFocus();
    return true;
  }

  /** @internal */
  override afterRender(): void {
    this.#sweepDiscardedLoads();
    this.#fixExpanderHeaderSpan();
    this.#syncDetailRows();
  }

  /**
   * The expander header cell is hidden (display:none), so the next sibling
   * header cell must span two CSS grid tracks (the expander's + its own)
   * to keep the header aligned with data rows.  The column position is
   * computed dynamically so that pinned columns can appear before the expander.
   */
  #fixExpanderHeaderSpan(): void {
    const expanderHeader = this.gridElement?.querySelector(
      '.header-row .cell[data-field="__tbw_expander"]',
    ) as HTMLElement | null;
    if (!expanderHeader) return;

    const colIdx = parseInt(expanderHeader.getAttribute('data-col') || '0', 10);
    const nextCell = expanderHeader.nextElementSibling as HTMLElement | null;
    if (nextCell) {
      // CSS grid columns are 1-based; span from the expander's track to the next cell's track.
      nextCell.style.gridColumn = `${colIdx + 1} / ${colIdx + 3}`;
    }
  }

  /**
   * Called on scroll to sync detail elements with visible rows.
   * Removes details for rows that scrolled out of view and reattaches for visible rows.
   * @internal
   */
  override onScrollRender(): void {
    if (!this.config.detailRenderer || !this.#hasExpandedRows()) return;
    // Full sync needed on scroll to clean up orphaned details
    this.#syncDetailRows();
  }

  /**
   * Full sync of detail rows - cleans up stale elements and creates new ones.
   * Detail rows are inserted as siblings AFTER their master row to survive row rebuilds.
   *
   * PERF: Uses the grid's row pool (_rowPool) and virtual window (_virtualization.start/end)
   * to avoid querySelectorAll on every scroll frame. The pool is index-aligned with the
   * virtual window, so pool[i] corresponds to row index (start + i).
   */
  #syncDetailRows(): void {
    const detailRenderer = this.config.detailRenderer;
    if (!detailRenderer) return;

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const visibleRowMap = this.#collectVisibleRowMap(body);
    this.#pruneDetachedDetails(visibleRowMap);

    // Insert detail rows for expanded rows that are visible. We also toggle
    // `.tbw-row-expanded` on every visible master row (matches Tree /
    // GroupingRows) so devs can style expanded rows via CSS instead of
    // depending on `[aria-expanded="true"]` (which lives on the toggle
    // button, not the row). MUST clear on the negative branch — the row
    // pool recycles elements as the virtual window slides.
    const columnCount = this.columns.length;
    // Once per sync, not per row — this runs on every render and scroll frame.
    const serverSideActive = this.#hasExpandedRows() && this.queryBoolean('datasource:is-active');
    for (const [rowIndex, rowEl] of visibleRowMap) {
      const row = this.rows[rowIndex];
      if (row) this.#syncDetailRow(row, rowIndex, rowEl, columnCount, detailRenderer, serverSideActive);
    }
  }

  /** Sync one visible master row: expanded class, deferred fetch, and its detail panel. */
  #syncDetailRow(
    row: object,
    rowIndex: number,
    rowEl: Element,
    columnCount: number,
    detailRenderer: NonNullable<MasterDetailConfig['detailRenderer']>,
    serverSideActive: boolean,
  ): void {
    // Defense in depth: a loading placeholder never gets a detail panel (#535).
    const isExpanded = this.#isRowExpanded(row);
    rowEl.classList.toggle('tbw-row-expanded', isExpanded);
    if (!isExpanded) return;

    this.#requestDetailData(row, rowIndex, serverSideActive);
    // The fetch can fail synchronously (no `getChildRows`), and a
    // `detail-load-error` listener may have collapsed the row (#539).
    if (!this.#isRowExpanded(row)) {
      rowEl.classList.remove('tbw-row-expanded');
      return;
    }

    const existingDetail = this.detailElements.get(row);
    if (!existingDetail) {
      this.#insertDetailRow(row, rowIndex, rowEl, columnCount, detailRenderer);
    } else if (existingDetail.previousElementSibling !== rowEl) {
      // Keep the detail positioned as the master row's next sibling.
      rowEl.after(existingDetail);
    }
  }

  /**
   * Map visible row index → row element.
   *
   * PERF: prefers the grid's index-aligned row pool (`_rowPool[i]` renders row
   * `_virtualization.start + i`) so no `querySelectorAll` runs per scroll frame;
   * falls back to a DOM query when the pool is not accessible.
   */
  #collectVisibleRowMap(body: Element): Map<number, Element> {
    const gridInternal = this.grid as any;
    const rowPool: HTMLElement[] | undefined = gridInternal._rowPool;
    const visibleStart: number = gridInternal._virtualization?.start ?? 0;
    const visibleEnd: number = gridInternal._virtualization?.end ?? 0;

    const visibleRowMap = new Map<number, Element>();
    if (rowPool) {
      const poolLen = Math.min(rowPool.length, visibleEnd - visibleStart);
      for (let i = 0; i < poolLen; i++) {
        const rowEl = rowPool[i];
        if (rowEl.parentNode === body) {
          visibleRowMap.set(visibleStart + i, rowEl);
        }
      }
      return visibleRowMap;
    }

    for (const rowEl of body.querySelectorAll('.data-grid-row')) {
      const firstCell = rowEl.querySelector('.cell[data-row]');
      const rowIndex = firstCell ? parseInt(firstCell.getAttribute('data-row') ?? '-1', 10) : -1;
      if (rowIndex >= 0) {
        visibleRowMap.set(rowIndex, rowEl);
      }
    }
    return visibleRowMap;
  }

  /**
   * Remove detail rows whose master row is no longer visible or no longer
   * expanded. Iterates the owned `detailElements` map instead of the DOM.
   */
  #pruneDetachedDetails(visibleRowMap: Map<number, Element>): void {
    for (const [row, detailEl] of this.detailElements) {
      const rowIndex = this.rows.indexOf(row);
      const isRowVisible = rowIndex >= 0 && visibleRowMap.has(rowIndex);
      if (this.#isRowExpanded(row) && isRowVisible) continue;
      this.#releaseDetail(row, detailEl);
    }
  }

  /**
   * Create a detail element and insert it as the next sibling of its master row.
   * Animates only when the row was just expanded by a user action — rows
   * re-appearing from scroll (virtualization) must not re-animate.
   */
  #insertDetailRow(
    row: object,
    rowIndex: number,
    rowEl: Element,
    columnCount: number,
    detailRenderer: NonNullable<MasterDetailConfig['detailRenderer']>,
  ): void {
    const detailEl = createDetailElement(row, rowIndex, detailRenderer, columnCount);

    if (typeof this.config.detailHeight === 'number') {
      detailEl.style.height = `${this.config.detailHeight}px`;
    }

    // Insert as sibling after the row element (not as child)
    rowEl.after(detailEl);
    this.detailElements.set(row, detailEl);

    const shouldAnimate = this.rowsToAnimate.has(row);
    if (shouldAnimate) {
      this.rowsToAnimate.delete(row);
    }

    // When animating, measurement is deferred to the animationend callback
    // (inside animateExpand) to avoid measuring during the max-height: 0 constraint.
    if (shouldAnimate && this.animateExpand(detailEl, row, rowIndex)) return;

    // No animation - measure height after layout settles via RAF
    requestAnimationFrame(() => {
      this.#measureAndCacheDetailHeight(detailEl, row, rowIndex);
    });
  }

  /**
   * Get the height of a specific row, including any expanded detail content.
   * Always returns a height to ensure the position cache uses plugin-controlled values
   * rather than stale DOM measurements.
   *
   * @param row - The row data
   * @param _index - The row index (unused, but part of the interface)
   * @returns The row height in pixels (base height for collapsed, base + detail for expanded)
   */
  override getRowHeight(row: unknown, _index: number): number | undefined {
    const isExpanded = this.#isRowExpanded(row);

    if (!isExpanded) {
      // Collapsed row - return undefined to let the grid use its measured/estimated height.
      // This ensures the position cache uses the correct row height from CSS/config.
      return undefined;
    }

    // Row is expanded - return base height plus detail height
    // Use grid's defaultRowHeight which reflects the actual measured/configured height
    const baseHeight = this.grid.defaultRowHeight ?? 28;
    const detailHeight = this.getDetailHeight(row);

    return baseHeight + detailHeight;
  }

  /** Expanded rows displayed before `start`, ascending. */
  #expandedRowsBefore(start: number): Array<{ index: number; row: unknown }> {
    const rows = this.rows;
    const result: Array<{ index: number; row: unknown }> = [];
    for (let i = 0, end = Math.min(start, rows.length); i < end; i++) {
      if (this.#isRowExpanded(rows[i])) result.push({ index: i, row: rows[i] });
    }
    return result;
  }

  /**
   * Variable-heights path of {@link adjustVirtualStart}. Each entry's height
   * already includes its detail, so a row's bottom (`offset + height`) grows
   * with its index: only the run directly above `start` can still reach
   * `scrollTop`. Walking back from `start` keeps this O(visible) on the scroll
   * hot path instead of O(start) under `expandAll()`.
   */
  #adjustStartFromPositionCache(
    start: number,
    scrollTop: number,
    positionCache: ReadonlyArray<{ offset: number; height: number }>,
  ): number {
    const rows = this.rows;
    let minStart = start;
    for (let i = Math.min(start, positionCache.length) - 1; i >= 0; i--) {
      const entry = positionCache[i];
      if (entry.offset + entry.height <= scrollTop) break;
      if (this.#isRowExpanded(rows[i])) minStart = i;
    }
    return minStart;
  }

  /**
   * Adjust the virtualization start index to keep expanded row visible while its detail is visible.
   * This ensures the detail scrolls smoothly out of view instead of disappearing abruptly.
   */
  override adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
    if (!this.#hasExpandedRows()) return start;

    // Use position cache for accurate row positions when available (variable heights mode)
    const positionCache = (this.grid as any)?._virtualization?.positionCache as
      Array<{ offset: number; height: number }> | undefined;

    if (positionCache && positionCache.length > 0) {
      return this.#adjustStartFromPositionCache(start, scrollTop, positionCache);
    }

    // Fixed heights fallback: accumulate detail heights manually
    let minStart = start;
    let cumulativeExtraHeight = 0;
    for (const { index: rowIndex, row } of this.#expandedRowsBefore(start)) {
      const actualRowTop = rowIndex * rowHeight + cumulativeExtraHeight;
      const detailHeight = this.getDetailHeight(row);
      const actualDetailBottom = actualRowTop + rowHeight + detailHeight;

      cumulativeExtraHeight += detailHeight;

      if (actualDetailBottom > scrollTop && rowIndex < minStart) {
        minStart = rowIndex;
      }
    }

    return minStart;
  }
  // #endregion

  // #region Public API

  /**
   * Expand the detail row at the given index.
   * With `ServerSidePlugin` active, requests the row's detail data via `getChildRows()`
   * (unless already cached or loading), exactly like clicking the expander.
   * @param rowIndex - Index of the row to expand
   */
  expand(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (this.#isDetailRow(row)) {
      const wasExpanded = this.#isRowExpanded(row);
      this.rowsToAnimate.add(row);
      this.#setExpanded(row, true);
      if (!wasExpanded) this.#requestDetailData(row, rowIndex);
      this.requestRender();
    }
  }

  /**
   * Collapse the detail row at the given index.
   * @param rowIndex - Index of the row to collapse
   */
  collapse(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.#setExpanded(row, false);
      this.#cancelDetailLoad(row);
      this.requestRender();
    }
  }

  /**
   * Toggle the detail row at the given index.
   * Expanding requests ServerSide detail data like {@link expand}; collapsing aborts an in-flight request.
   * @param rowIndex - Index of the row to toggle
   */
  toggle(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (this.#isDetailRow(row)) {
      const expanded = !this.#isRowExpanded(row);
      this.#setExpanded(row, expanded);
      if (expanded) {
        this.rowsToAnimate.add(row);
        this.#requestDetailData(row, rowIndex);
      } else {
        this.#cancelDetailLoad(row);
      }
      this.requestRender();
    }
  }

  /**
   * Check if the detail row at the given index is expanded.
   * @param rowIndex - Index of the row to check
   * @returns Whether the detail row is expanded
   */
  isExpanded(rowIndex: number): boolean {
    const row = this.rows[rowIndex];
    return row ? this.#isRowExpanded(row) : false;
  }

  /**
   * Expand all detail rows.
   * Skips synthetic rows (group headers from GroupingRowsPlugin, ServerSide loading placeholders).
   * With `ServerSidePlugin` active, requests detail data for every newly expanded
   * loaded row (one `getChildRows()` call per row). Expansion then becomes the
   * default for every detail row until {@link collapseAll} is called, so rows that
   * appear later — ServerSide blocks replacing loading placeholders, or Tree /
   * GroupingRows children — render expanded straight away; their detail data is
   * requested once they scroll into view.
   */
  expandAll(): void {
    const serverSideActive = this.queryBoolean('datasource:is-active');
    const rows = this.rows;
    const newlyExpanded: Array<{ row: unknown; index: number }> = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!this.#isDetailRow(row) || this.#isRowExpanded(row)) continue;
      newlyExpanded.push({ row, index: i });
    }
    this.#expandAllActive = true;
    this.#expandAllExcluded = new WeakSet();
    // Fetch only after the mode is live: a request can fail synchronously, and a
    // `detail-load-error` listener collapsing rows must not be undone here (#539).
    for (const { row, index } of newlyExpanded) {
      if (!this.#isRowExpanded(row)) continue;
      this.rowsToAnimate.add(row);
      this.#requestDetailData(row, index, serverSideActive);
    }
    this.requestRender();
  }

  /**
   * Collapse all detail rows.
   * Also ends the {@link expandAll} mode, so rows appearing later stay collapsed.
   */
  collapseAll(): void {
    this.#expandAllActive = false;
    this.#expandAllExcluded = new WeakSet();
    for (const row of [...this.detailLoads.keys()]) this.#cancelDetailLoad(row);
    // Rows whose fetch already failed are no longer in `detailLoads`, so clear
    // every one-shot marker here — re-expanding must retry those too.
    this.#detailRequested = new WeakSet();
    this.expandedRows.clear();
    this.requestRender();
  }

  /**
   * Get the indices of all expanded rows.
   * @returns Array of row indices that are expanded, ascending
   */
  getExpandedRows(): number[] {
    return this.#expandedRowsBefore(this.rows.length).map((e) => e.index);
  }

  /**
   * Get the detail element for a specific row.
   * @param rowIndex - Index of the row
   * @returns The detail HTMLElement or undefined
   */
  getDetailElement(rowIndex: number): HTMLElement | undefined {
    const row = this.rows[rowIndex];
    return row ? this.detailElements.get(row) : undefined;
  }

  /**
   * Get async detail data fetched via `ServerSidePlugin` for a specific row.
   *
   * Returns the child rows received from `datasource:children` after a
   * `datasource:fetch-children` query was fired on expand. Returns `undefined`
   * when ServerSide is not loaded or data has not arrived yet.
   *
   * @param rowIndex - Index of the row
   * @returns Array of child rows or undefined
   */
  getDetailData(rowIndex: number): unknown[] | undefined {
    const row = this.rows[rowIndex];
    return row ? this.detailDataMap.get(row) : undefined;
  }

  /**
   * Check if detail data is currently being loaded for a row.
   * @param rowIndex - Index of the row
   * @returns Whether the detail is loading
   */
  isDetailLoading(rowIndex: number): boolean {
    const row = this.rows[rowIndex];
    return row ? this.detailLoads.has(row) : false;
  }

  /**
   * Re-parse light DOM to refresh the detail renderer.
   * Call this after framework templates are registered (e.g., Angular ngAfterContentInit).
   *
   * This allows frameworks to register templates asynchronously and then
   * update the plugin's detailRenderer.
   */
  refreshDetailRenderer(): void {
    // Force re-parse by temporarily clearing the renderer
    const currentRenderer = this.config.detailRenderer;
    this.config = { ...this.config, detailRenderer: undefined };
    this.parseLightDomDetail();

    // If no new renderer was found, restore the original
    if (!this.config.detailRenderer && currentRenderer) {
      this.config = { ...this.config, detailRenderer: currentRenderer };
    }

    // Request a COLUMNS phase re-render so processColumns runs again with the new detailRenderer
    // This ensures the expand toggle is added to the first column.
    // Must use refreshColumns() (COLUMNS phase) not requestRender() (ROWS phase)
    // because processColumns only runs at COLUMNS phase or higher.
    if (this.config.detailRenderer) {
      const grid = this.#internalGrid;
      if (typeof grid.refreshColumns === 'function') {
        grid.refreshColumns();
      } else {
        // Fallback to requestRender if refreshColumns not available
        this.requestRender();
      }
    }
  }
  // #endregion
}

/**
 * Master/Detail Plugin (Class-based)
 *
 * Enables expandable detail rows showing additional content for each row.
 * Animation style is plugin-configured; respects grid-level animation.mode.
 */

import { evalTemplateString, sanitizeHTML } from '../../core/internal/sanitize';
import { BaseGridPlugin, CellClickEvent, GridElement, RowClickEvent } from '../../core/plugin/base-plugin';
import { createExpanderColumnConfig, findExpanderColumn, isExpanderColumn } from '../../core/plugin/expander-column';
import type { ColumnConfig } from '../../core/types';
import {
  collapseDetailRow,
  createDetailElement,
  expandDetailRow,
  isDetailExpanded,
  toggleDetailRow,
} from './master-detail';
import styles from './master-detail.css?inline';
import type { DetailExpandDetail, ExpandCollapseAnimation, MasterDetailConfig } from './types';

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
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `detailRenderer` | `(row) => HTMLElement \| string` | required | Render function for detail content |
 * | `expandOnRowClick` | `boolean` | `false` | Expand when clicking the row |
 * | `detailHeight` | `number \| 'auto'` | `'auto'` | Fixed height or auto-size |
 * | `collapseOnClickOutside` | `boolean` | `false` | Collapse when clicking outside |
 * | `showExpandColumn` | `boolean` | `true` | Show expand/collapse column |
 * | `animation` | `false \| 'slide' \| 'fade'` | `'slide'` | Animation style |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `expandRow` | `(rowIndex) => void` | Expand a specific row |
 * | `collapseRow` | `(rowIndex) => void` | Collapse a specific row |
 * | `toggleRow` | `(rowIndex) => void` | Toggle row expansion |
 * | `expandAll` | `() => void` | Expand all rows |
 * | `collapseAll` | `() => void` | Collapse all rows |
 * | `isRowExpanded` | `(rowIndex) => boolean` | Check if row is expanded |
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
 */
export class MasterDetailPlugin extends BaseGridPlugin<MasterDetailConfig> {
  /** @internal */
  readonly name = 'masterDetail';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<MasterDetailConfig> {
    return {
      detailHeight: 'auto',
      expandOnRowClick: false,
      collapseOnClickOutside: false,
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
   * - `collapse-on-click-outside`: 'true' | 'false' (default: 'false')
   * - `height`: number (pixels) or 'auto' (default: 'auto')
   */
  private parseLightDomDetail(): void {
    const gridEl = this.grid as unknown as Element;
    if (!gridEl || typeof gridEl.querySelector !== 'function') return;

    const detailEl = gridEl.querySelector('tbw-grid-detail');
    if (!detailEl) return;

    // Check if a framework adapter wants to handle this element
    // (e.g., Angular adapter intercepts for ng-template rendering)
    const gridWithAdapter = gridEl as unknown as {
      __frameworkAdapter?: {
        parseDetailElement?: (el: Element) => ((row: any, rowIndex: number) => HTMLElement | string) | undefined;
      };
    };
    if (gridWithAdapter.__frameworkAdapter?.parseDetailElement) {
      const adapterRenderer = gridWithAdapter.__frameworkAdapter.parseDetailElement(detailEl);
      if (adapterRenderer) {
        this.config = { ...this.config, detailRenderer: adapterRenderer };
        return;
      }
    }

    // Parse attributes for configuration
    const animation = detailEl.getAttribute('animation');
    const showExpandColumn = detailEl.getAttribute('show-expand-column');
    const expandOnRowClick = detailEl.getAttribute('expand-on-row-click');
    const collapseOnClickOutside = detailEl.getAttribute('collapse-on-click-outside');
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
    if (collapseOnClickOutside !== null) {
      configUpdates.collapseOnClickOutside = collapseOnClickOutside === 'true';
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
  /** Cached measured heights - persists even when elements are virtualized out */
  private measuredDetailHeights: Map<any, number> = new Map();
  /** Rows that were just expanded by user action and should animate.
   * Prevents re-animation when rows scroll back into the virtual window. */
  private rowsToAnimate: Set<any> = new Set();

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
   */
  private toggleAndEmit(row: any, rowIndex: number): void {
    this.expandedRows = toggleDetailRow(this.expandedRows, row as object);
    const expanded = this.expandedRows.has(row as object);
    if (expanded) {
      this.rowsToAnimate.add(row);
    }
    this.emit<DetailExpandDetail>('detail-expand', {
      rowIndex,
      row: row as Record<string, unknown>,
      expanded,
    });
    this.requestRender();
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.expandedRows.clear();
    this.detailElements.clear();
    this.measuredDetailHeights.clear();
    this.rowsToAnimate.clear();
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
      const isExpanded = this.expandedRows.has(row as object);

      const container = document.createElement('span');
      container.className = 'master-detail-expander expander-cell';

      // Expand/collapse toggle icon
      const toggle = document.createElement('span');
      toggle.className = `master-detail-toggle${isExpanded ? ' expanded' : ''}`;
      // Use grid-level icons (fall back to defaults)
      this.setIcon(toggle, this.resolveIcon(isExpanded ? 'collapse' : 'expand'));
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
    this.toggleAndEmit(event.row, event.rowIndex);
    return false;
  }

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean | void {
    // Handle click on master-detail toggle icon (same pattern as TreePlugin)
    const target = event.originalEvent?.target as HTMLElement;
    if (target?.classList.contains('master-detail-toggle')) {
      this.toggleAndEmit(event.row, event.rowIndex);
      return true; // Prevent default handling
    }

    // Sync detail rows after cell click triggers refreshVirtualWindow
    // This runs in microtask to ensure DOM updates are complete
    if (this.expandedRows.size > 0) {
      queueMicrotask(() => this.#syncDetailRows());
    }
    return; // Don't prevent default
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion when focus is on the expander column
    if (event.key !== ' ') return;

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
    this.#syncDetailRows();
  }

  /**
   * Called on scroll to sync detail elements with visible rows.
   * Removes details for rows that scrolled out of view and reattaches for visible rows.
   * @internal
   */
  override onScrollRender(): void {
    if (!this.config.detailRenderer || this.expandedRows.size === 0) return;
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
    if (!this.config.detailRenderer) return;

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    // Use grid's virtualization state and row pool for O(1) lookups instead of querySelectorAll.
    // The row pool is an array of DOM elements aligned to the virtual window:
    // _rowPool[i] renders row data at index (_virtualization.start + i).
    const gridInternal = this.grid as any;
    const rowPool: HTMLElement[] | undefined = gridInternal._rowPool;
    const vStart: number = gridInternal._virtualization?.start ?? 0;
    const vEnd: number = gridInternal._virtualization?.end ?? 0;
    const columnCount = this.columns.length;

    // Build visible row index set from the virtual window range
    const visibleStart = vStart;
    const visibleEnd = vEnd;

    // Build a map of row index -> row element using the pool (O(n) where n = visible rows)
    const visibleRowMap = new Map<number, Element>();
    if (rowPool) {
      const poolLen = Math.min(rowPool.length, visibleEnd - visibleStart);
      for (let i = 0; i < poolLen; i++) {
        const rowEl = rowPool[i];
        if (rowEl.parentNode === body) {
          visibleRowMap.set(visibleStart + i, rowEl);
        }
      }
    } else {
      // Fallback: use querySelectorAll if pool is not accessible
      const dataRows = body.querySelectorAll('.data-grid-row');
      for (const rowEl of dataRows) {
        const firstCell = rowEl.querySelector('.cell[data-row]');
        const rowIndex = firstCell ? parseInt(firstCell.getAttribute('data-row') ?? '-1', 10) : -1;
        if (rowIndex >= 0) {
          visibleRowMap.set(rowIndex, rowEl);
        }
      }
    }

    // Remove detail rows whose parent row is no longer visible or no longer expanded.
    // Iterate the detailElements map (which we own) instead of querySelectorAll.
    for (const [row, detailEl] of this.detailElements) {
      const rowIndex = this.rows.indexOf(row);
      const isStillExpanded = this.expandedRows.has(row);
      const isRowVisible = rowIndex >= 0 && visibleRowMap.has(rowIndex);

      if (!isStillExpanded || !isRowVisible) {
        // Clean up framework adapter resources (React root, Vue app, Angular view)
        // before removing to prevent memory leaks.
        const adapter = (this.grid as unknown as { __frameworkAdapter?: { unmount?(c: HTMLElement): void } })
          .__frameworkAdapter;
        if (adapter?.unmount) {
          const detailCell = detailEl.querySelector('.master-detail-cell');
          const container = detailCell?.firstElementChild as HTMLElement | null;
          if (container) adapter.unmount(container);
        }
        if (detailEl.parentNode) detailEl.remove();
        this.detailElements.delete(row);
      }
    }

    // Insert detail rows for expanded rows that are visible
    for (const [rowIndex, rowEl] of visibleRowMap) {
      const row = this.rows[rowIndex];
      if (!row || !this.expandedRows.has(row)) continue;

      // Check if detail already exists for this row
      const existingDetail = this.detailElements.get(row);
      if (existingDetail) {
        // Ensure it's positioned correctly (as next sibling of row element)
        if (existingDetail.previousElementSibling !== rowEl) {
          rowEl.after(existingDetail);
        }
        continue;
      }

      // Create new detail element
      const detailEl = createDetailElement(row, rowIndex, this.config.detailRenderer, columnCount);

      if (typeof this.config.detailHeight === 'number') {
        detailEl.style.height = `${this.config.detailHeight}px`;
      }

      // Insert as sibling after the row element (not as child)
      rowEl.after(detailEl);
      this.detailElements.set(row, detailEl);

      // Only animate if this row was just expanded by a user action (click, keyboard, API).
      // Rows re-appearing from scroll (virtualization) should not re-animate.
      const shouldAnimate = this.rowsToAnimate.has(row);
      if (shouldAnimate) {
        this.rowsToAnimate.delete(row);
      }

      const willAnimate = shouldAnimate && this.animateExpand(detailEl, row, rowIndex);

      if (!willAnimate) {
        // No animation - measure height after layout settles via RAF
        requestAnimationFrame(() => {
          this.#measureAndCacheDetailHeight(detailEl, row, rowIndex);
        });
      }
      // When animating, measurement is deferred to animationend callback
      // (inside animateExpand) to avoid measuring during max-height: 0 constraint
    }
  }

  /**
   * Return total extra height from all expanded detail rows.
   * Used by grid virtualization to adjust scrollbar height.
   *
   * @deprecated Use getRowHeight() instead. This hook will be removed in v3.0.
   */
  override getExtraHeight(): number {
    let totalHeight = 0;
    for (const row of this.expandedRows) {
      totalHeight += this.getDetailHeight(row);
    }
    return totalHeight;
  }

  /**
   * Return extra height that appears before a given row index.
   * This is the sum of heights of all expanded details whose parent row is before the given index.
   *
   * @deprecated Use getRowHeight() instead. This hook will be removed in v3.0.
   */
  override getExtraHeightBefore(beforeRowIndex: number): number {
    let totalHeight = 0;
    for (const row of this.expandedRows) {
      const rowIndex = this.rows.indexOf(row);
      // Include detail if it's for a row before the given index
      if (rowIndex >= 0 && rowIndex < beforeRowIndex) {
        totalHeight += this.getDetailHeight(row);
      }
    }
    return totalHeight;
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
    const isExpanded = this.expandedRows.has(row as object);

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

  /**
   * Adjust the virtualization start index to keep expanded row visible while its detail is visible.
   * This ensures the detail scrolls smoothly out of view instead of disappearing abruptly.
   */
  override adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
    if (this.expandedRows.size === 0) return start;

    // Use position cache for accurate row positions when available (variable heights mode)
    const positionCache = (this.grid as any)?._virtualization?.positionCache as
      | Array<{ offset: number; height: number }>
      | undefined;

    let minStart = start;

    if (positionCache && positionCache.length > 0) {
      // Variable heights: use position cache for accurate offset
      for (const row of this.expandedRows) {
        const rowIndex = this.rows.indexOf(row);
        if (rowIndex < 0 || rowIndex >= start) continue;

        // Position cache already includes cumulative heights from all expanded details
        const detailBottom = positionCache[rowIndex].offset + positionCache[rowIndex].height;

        if (detailBottom > scrollTop && rowIndex < minStart) {
          minStart = rowIndex;
        }
      }
    } else {
      // Fixed heights fallback: accumulate detail heights manually
      // Build sorted list of expanded row indices for cumulative height calculation
      const expandedIndices: Array<{ index: number; row: any }> = [];
      for (const row of this.expandedRows) {
        const index = this.rows.indexOf(row);
        if (index >= 0) {
          expandedIndices.push({ index, row });
        }
      }
      expandedIndices.sort((a, b) => a.index - b.index);

      let cumulativeExtraHeight = 0;

      for (const { index: rowIndex, row } of expandedIndices) {
        const actualRowTop = rowIndex * rowHeight + cumulativeExtraHeight;
        const detailHeight = this.getDetailHeight(row);
        const actualDetailBottom = actualRowTop + rowHeight + detailHeight;

        cumulativeExtraHeight += detailHeight;

        if (rowIndex >= start) continue;

        if (actualDetailBottom > scrollTop && rowIndex < minStart) {
          minStart = rowIndex;
        }
      }
    }

    return minStart;
  }
  // #endregion

  // #region Public API

  /**
   * Expand the detail row at the given index.
   * @param rowIndex - Index of the row to expand
   */
  expand(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.rowsToAnimate.add(row);
      this.expandedRows = expandDetailRow(this.expandedRows, row);
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
      this.expandedRows = collapseDetailRow(this.expandedRows, row);
      this.requestRender();
    }
  }

  /**
   * Toggle the detail row at the given index.
   * @param rowIndex - Index of the row to toggle
   */
  toggle(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.expandedRows = toggleDetailRow(this.expandedRows, row);
      if (this.expandedRows.has(row)) {
        this.rowsToAnimate.add(row);
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
    return row ? isDetailExpanded(this.expandedRows, row) : false;
  }

  /**
   * Expand all detail rows.
   */
  expandAll(): void {
    for (const row of this.rows) {
      this.rowsToAnimate.add(row);
      this.expandedRows.add(row);
    }
    this.requestRender();
  }

  /**
   * Collapse all detail rows.
   */
  collapseAll(): void {
    this.expandedRows.clear();
    this.requestRender();
  }

  /**
   * Get the indices of all expanded rows.
   * @returns Array of row indices that are expanded
   */
  getExpandedRows(): number[] {
    const indices: number[] = [];
    for (const row of this.expandedRows) {
      const idx = this.rows.indexOf(row);
      if (idx >= 0) indices.push(idx);
    }
    return indices;
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
      const grid = this.grid as unknown as { refreshColumns?: () => void };
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

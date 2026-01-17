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
 * Master/Detail Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new MasterDetailPlugin({
 *   enabled: true,
 *   detailRenderer: (row) => `<div>Details for ${row.name}</div>`,
 *   expandOnRowClick: true,
 * })
 * ```
 */
export class MasterDetailPlugin extends BaseGridPlugin<MasterDetailConfig> {
  readonly name = 'masterDetail';
  override readonly styles = styles;

  protected override get defaultConfig(): Partial<MasterDetailConfig> {
    return {
      detailHeight: 'auto',
      expandOnRowClick: false,
      collapseOnClickOutside: false,
      showExpandColumn: true,
      animation: 'slide', // Plugin's own default
    };
  }

  // #region Light DOM Parsing

  /**
   * Called when plugin is attached to the grid.
   * Parses light DOM for `<tbw-grid-detail>` elements to configure detail templates.
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
   */
  private animateExpand(detailEl: HTMLElement): void {
    if (!this.isAnimationEnabled || this.animationStyle === false) return;

    detailEl.classList.add('tbw-expanding');
    detailEl.addEventListener(
      'animationend',
      () => {
        detailEl.classList.remove('tbw-expanding');
      },
      { once: true },
    );
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

  // #endregion

  // #region Internal State
  private expandedRows: Set<any> = new Set();
  private detailElements: Map<any, HTMLElement> = new Map();

  /** Default height for detail rows when not configured */
  private static readonly DEFAULT_DETAIL_HEIGHT = 150;

  /**
   * Get the estimated height for a detail row.
   */
  private getDetailHeight(row: any): number {
    const detailEl = this.detailElements.get(row);
    if (detailEl) return detailEl.offsetHeight;
    return typeof this.config?.detailHeight === 'number'
      ? this.config.detailHeight
      : MasterDetailPlugin.DEFAULT_DETAIL_HEIGHT;
  }

  /**
   * Toggle a row's detail and emit event.
   */
  private toggleAndEmit(row: any, rowIndex: number): void {
    this.expandedRows = toggleDetailRow(this.expandedRows, row as object);
    this.emit<DetailExpandDetail>('detail-expand', {
      rowIndex,
      row: row as Record<string, unknown>,
      expanded: this.expandedRows.has(row as object),
    });
    this.requestRender();
  }
  // #endregion

  // #region Lifecycle

  override detach(): void {
    this.expandedRows.clear();
    this.detailElements.clear();
  }
  // #endregion

  // #region Hooks

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.config.detailRenderer || this.config.showExpandColumn === false) {
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

  override onRowClick(event: RowClickEvent): boolean | void {
    if (!this.config.expandOnRowClick || !this.config.detailRenderer) return;
    this.toggleAndEmit(event.row, event.rowIndex);
    return false;
  }

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

  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion when focus is on the expander column
    if (event.key !== ' ') return;

    const focusCol = this.grid._focusCol;
    const focusRow = this.grid._focusRow;
    const column = this.columns[focusCol];

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

  override afterRender(): void {
    this.#syncDetailRows();
  }

  /**
   * Called on scroll to sync detail elements with visible rows.
   * Removes details for rows that scrolled out of view and reattaches for visible rows.
   */
  override onScrollRender(): void {
    if (!this.config.detailRenderer || this.expandedRows.size === 0) return;
    // Full sync needed on scroll to clean up orphaned details
    this.#syncDetailRows();
  }

  /**
   * Full sync of detail rows - cleans up stale elements and creates new ones.
   * Detail rows are inserted as siblings AFTER their master row to survive row rebuilds.
   */
  #syncDetailRows(): void {
    if (!this.config.detailRenderer) return;

    const body = this.shadowRoot?.querySelector('.rows');
    if (!body) return;

    // Build a map of row index -> row element for visible rows
    const visibleRowMap = new Map<number, Element>();
    const dataRows = body.querySelectorAll('.data-grid-row');
    const columnCount = this.columns.length;

    for (const rowEl of dataRows) {
      const firstCell = rowEl.querySelector('.cell[data-row]');
      const rowIndex = firstCell ? parseInt(firstCell.getAttribute('data-row') ?? '-1', 10) : -1;
      if (rowIndex >= 0) {
        visibleRowMap.set(rowIndex, rowEl);
      }
    }

    // Remove detail rows whose parent row is no longer visible or no longer expanded
    const existingDetails = body.querySelectorAll('.master-detail-row');
    for (const detailEl of existingDetails) {
      const forIndex = parseInt(detailEl.getAttribute('data-detail-for') ?? '-1', 10);
      const row = forIndex >= 0 ? this.rows[forIndex] : undefined;
      const isStillExpanded = row && this.expandedRows.has(row);
      const isRowVisible = visibleRowMap.has(forIndex);

      // Remove detail if not expanded or if parent row scrolled out
      if (!isStillExpanded || !isRowVisible) {
        detailEl.remove();
        if (row) this.detailElements.delete(row);
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

      // Apply expand animation
      this.animateExpand(detailEl);
    }
  }

  /**
   * Return total extra height from all expanded detail rows.
   * Used by grid virtualization to adjust scrollbar height.
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
   * Adjust the virtualization start index to keep expanded row visible while its detail is visible.
   * This ensures the detail scrolls smoothly out of view instead of disappearing abruptly.
   */
  override adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
    if (this.expandedRows.size === 0) return start;

    // Build sorted list of expanded row indices for cumulative height calculation
    const expandedIndices: Array<{ index: number; row: any }> = [];
    for (const row of this.expandedRows) {
      const index = this.rows.indexOf(row);
      if (index >= 0) {
        expandedIndices.push({ index, row });
      }
    }
    expandedIndices.sort((a, b) => a.index - b.index);

    let minStart = start;

    // Calculate actual scroll position for each expanded row,
    // accounting for cumulative detail heights before it
    let cumulativeExtraHeight = 0;

    for (const { index: rowIndex, row } of expandedIndices) {
      // Actual position includes all detail heights before this row
      const actualRowTop = rowIndex * rowHeight + cumulativeExtraHeight;
      const detailHeight = this.getDetailHeight(row);
      const actualDetailBottom = actualRowTop + rowHeight + detailHeight;

      // Update cumulative height for next iteration
      cumulativeExtraHeight += detailHeight;

      // Skip rows that are at or after the calculated start
      if (rowIndex >= start) continue;

      // If any part of the detail is still visible (below the scroll position),
      // we need to keep the parent row in the render range
      if (actualDetailBottom > scrollTop) {
        if (rowIndex < minStart) {
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

/**
 * Pinned Rows Plugin (Class-based)
 *
 * Adds info bars and aggregation rows to the grid.
 * - Info bar: Shows row counts, selection info, and custom panels
 * - Aggregation rows: Footer/header rows with computed values (sum, avg, etc.)
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { buildContext, createAggregationContainer, createInfoBarElement, renderAggregationRows } from './pinned-rows';
import type { AggregationRowConfig, PinnedRowsConfig, PinnedRowsContext, PinnedRowsPanel } from './types';

/**
 * Pinned Rows Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new PinnedRowsPlugin({
 *   enabled: true,
 *   position: 'bottom',
 *   showRowCount: true,
 *   showSelectedCount: true,
 *   aggregationRows: [
 *     { id: 'totals', position: 'bottom', values: { amount: 'sum' } },
 *   ],
 * })
 * ```
 */
export class PinnedRowsPlugin extends BaseGridPlugin<PinnedRowsConfig> {
  readonly name = 'pinnedRows';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<PinnedRowsConfig> {
    return {
      enabled: true,
      position: 'bottom',
      showRowCount: true,
      showSelectedCount: true,
      showFilteredCount: true,
    };
  }

  // ===== Internal State =====
  private infoBarElement: HTMLElement | null = null;
  private topAggregationContainer: HTMLElement | null = null;
  private bottomAggregationContainer: HTMLElement | null = null;
  private footerWrapper: HTMLElement | null = null;

  // ===== Lifecycle =====

  override detach(): void {
    if (this.infoBarElement) {
      this.infoBarElement.remove();
      this.infoBarElement = null;
    }
    if (this.topAggregationContainer) {
      this.topAggregationContainer.remove();
      this.topAggregationContainer = null;
    }
    if (this.bottomAggregationContainer) {
      this.bottomAggregationContainer.remove();
      this.bottomAggregationContainer = null;
    }
    if (this.footerWrapper) {
      this.footerWrapper.remove();
      this.footerWrapper = null;
    }
  }

  // ===== Hooks =====

  override afterRender(): void {
    if (!this.config.enabled) {
      this.cleanup();
      return;
    }

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Use .tbw-scroll-area so footer is inside the horizontal scroll area,
    // otherwise fall back to .tbw-grid-content or root container
    const container =
      shadowRoot.querySelector('.tbw-scroll-area') ??
      shadowRoot.querySelector('.tbw-grid-content') ??
      shadowRoot.children[0];
    if (!container) return;

    // Build context with plugin states
    const selectionState = this.getSelectionState();
    const filterState = this.getFilterState();

    const context = buildContext(
      this.rows as unknown[],
      this.columns as unknown[],
      this.grid as unknown as HTMLElement,
      selectionState,
      filterState
    );

    // ===== Handle Aggregation Rows =====
    const aggregationRows = this.config.aggregationRows || [];
    const topRows = aggregationRows.filter((r) => r.position === 'top');
    const bottomRows = aggregationRows.filter((r) => r.position !== 'top');

    // Top aggregation rows
    if (topRows.length > 0) {
      if (!this.topAggregationContainer) {
        this.topAggregationContainer = createAggregationContainer('top');
        const header = shadowRoot.querySelector('.header');
        if (header && header.nextSibling) {
          container.insertBefore(this.topAggregationContainer, header.nextSibling);
        } else {
          container.appendChild(this.topAggregationContainer);
        }
      }
      renderAggregationRows(
        this.topAggregationContainer,
        topRows,
        this.visibleColumns as ColumnConfig[],
        this.rows as unknown[]
      );
    } else if (this.topAggregationContainer) {
      this.topAggregationContainer.remove();
      this.topAggregationContainer = null;
    }

    // Handle footer
    const hasInfoContent =
      this.config.showRowCount !== false ||
      (this.config.showSelectedCount && context.selectedRows > 0) ||
      (this.config.showFilteredCount && context.filteredRows !== context.totalRows) ||
      (this.config.customPanels && this.config.customPanels.length > 0);
    const hasBottomInfoBar = hasInfoContent && this.config.position !== 'top';
    const needsFooter = bottomRows.length > 0 || hasBottomInfoBar;

    // Handle top info bar
    if (hasInfoContent && this.config.position === 'top') {
      if (!this.infoBarElement) {
        this.infoBarElement = createInfoBarElement(this.config, context);
        container.insertBefore(this.infoBarElement, container.firstChild);
      } else {
        const newInfoBar = createInfoBarElement(this.config, context);
        this.infoBarElement.replaceWith(newInfoBar);
        this.infoBarElement = newInfoBar;
      }
    } else if (this.config.position === 'top' && this.infoBarElement) {
      this.infoBarElement.remove();
      this.infoBarElement = null;
    }

    // Create/manage footer wrapper
    if (needsFooter) {
      if (!this.footerWrapper) {
        this.footerWrapper = document.createElement('div');
        this.footerWrapper.className = 'tbw-footer';
        container.appendChild(this.footerWrapper);
      }

      this.footerWrapper.innerHTML = '';

      if (bottomRows.length > 0) {
        if (!this.bottomAggregationContainer) {
          this.bottomAggregationContainer = createAggregationContainer('bottom');
        }
        this.footerWrapper.appendChild(this.bottomAggregationContainer);
        renderAggregationRows(
          this.bottomAggregationContainer,
          bottomRows,
          this.visibleColumns as ColumnConfig[],
          this.rows as unknown[]
        );
      }

      if (hasBottomInfoBar) {
        this.infoBarElement = createInfoBarElement(this.config, context);
        this.footerWrapper.appendChild(this.infoBarElement);
      }
    } else {
      this.cleanupFooter();
    }
  }

  // ===== Private Methods =====

  private cleanup(): void {
    if (this.infoBarElement) {
      this.infoBarElement.remove();
      this.infoBarElement = null;
    }
    if (this.topAggregationContainer) {
      this.topAggregationContainer.remove();
      this.topAggregationContainer = null;
    }
    if (this.bottomAggregationContainer) {
      this.bottomAggregationContainer.remove();
      this.bottomAggregationContainer = null;
    }
    if (this.footerWrapper) {
      this.footerWrapper.remove();
      this.footerWrapper = null;
    }
  }

  private cleanupFooter(): void {
    if (this.footerWrapper) {
      this.footerWrapper.remove();
      this.footerWrapper = null;
    }
    if (this.bottomAggregationContainer) {
      this.bottomAggregationContainer.remove();
      this.bottomAggregationContainer = null;
    }
    if (this.infoBarElement && this.config.position !== 'top') {
      this.infoBarElement.remove();
      this.infoBarElement = null;
    }
  }

  private getSelectionState(): { selected: Set<number> } | null {
    // Try to get selection plugin state
    try {
      const grid = this.grid as any;
      return grid?.getPluginState?.('selection') ?? null;
    } catch {
      return null;
    }
  }

  private getFilterState(): { cachedResult: unknown[] | null } | null {
    try {
      const grid = this.grid as any;
      return grid?.getPluginState?.('filtering') ?? null;
    } catch {
      return null;
    }
  }

  // ===== Public API =====

  /**
   * Refresh the status bar to reflect current grid state.
   */
  refresh(): void {
    this.requestRender();
  }

  /**
   * Get the current status bar context.
   * @returns The context with row counts and other info
   */
  getContext(): PinnedRowsContext {
    const selectionState = this.getSelectionState();
    const filterState = this.getFilterState();

    return buildContext(
      this.rows as unknown[],
      this.columns as unknown[],
      this.grid as unknown as HTMLElement,
      selectionState,
      filterState
    );
  }

  /**
   * Add a custom panel to the info bar.
   * @param panel - The panel configuration to add
   */
  addPanel(panel: PinnedRowsPanel): void {
    if (!this.config.customPanels) {
      this.config.customPanels = [];
    }
    this.config.customPanels.push(panel);
    this.requestRender();
  }

  /**
   * Remove a custom panel by ID.
   * @param id - The panel ID to remove
   */
  removePanel(id: string): void {
    if (this.config.customPanels) {
      this.config.customPanels = this.config.customPanels.filter((p) => p.id !== id);
      this.requestRender();
    }
  }

  /**
   * Add an aggregation row.
   * @param row - The aggregation row configuration
   */
  addAggregationRow(row: AggregationRowConfig): void {
    if (!this.config.aggregationRows) {
      this.config.aggregationRows = [];
    }
    this.config.aggregationRows.push(row);
    this.requestRender();
  }

  /**
   * Remove an aggregation row by ID.
   * @param id - The aggregation row ID to remove
   */
  removeAggregationRow(id: string): void {
    if (this.config.aggregationRows) {
      this.config.aggregationRows = this.config.aggregationRows.filter((r) => r.id !== id);
      this.requestRender();
    }
  }

  // ===== Styles =====

  override readonly styles = `
    .tbw-footer {
      position: sticky;
      bottom: 0;
      z-index: var(--tbw-z-layer-pinned-rows, 20);
      background: var(--tbw-color-panel-bg);
    }

    .tbw-pinned-rows {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: var(--tbw-pinned-rows-bg, var(--tbw-color-panel-bg));
      border-top: 1px solid var(--tbw-pinned-rows-border, var(--tbw-color-border));
      font-size: 12px;
      color: var(--tbw-pinned-rows-color, var(--tbw-color-fg-muted));
      min-height: 32px;
      box-sizing: border-box;
      min-width: fit-content;
    }
    .tbw-pinned-rows-left,
    .tbw-pinned-rows-center,
    .tbw-pinned-rows-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .tbw-pinned-rows-left {
      justify-content: flex-start;
    }
    .tbw-pinned-rows-center {
      justify-content: center;
      flex: 1;
    }
    .tbw-pinned-rows-right {
      justify-content: flex-end;
    }
    .tbw-status-panel {
      white-space: nowrap;
    }

    .tbw-aggregation-rows {
      min-width: fit-content;
      background: var(--tbw-aggregation-bg, var(--tbw-color-header-bg));
    }
    .tbw-aggregation-rows-top {
      border-bottom: 1px solid var(--tbw-aggregation-border, var(--tbw-color-border));
    }
    .tbw-aggregation-rows-bottom {
      border-top: 1px solid var(--tbw-aggregation-border, var(--tbw-color-border));
    }
    .tbw-aggregation-row {
      display: grid;
      grid-template-columns: var(--tbw-column-template);
      font-weight: var(--tbw-aggregation-font-weight, 600);
    }
    .tbw-aggregation-cell {
      padding: var(--tbw-cell-padding, 2px 8px);
      min-height: var(--tbw-row-height, 28px);
      display: flex;
      align-items: center;
      border-right: 1px solid var(--tbw-color-border-cell);
    }
    .tbw-aggregation-cell:last-child {
      border-right: 0;
    }
    .tbw-aggregation-cell-full {
      grid-column: 1 / -1;
      border-right: 0;
    }
  `;
}

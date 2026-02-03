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
import styles from './pinned-rows.css?inline';
import type { AggregationRowConfig, PinnedRowsConfig, PinnedRowsContext, PinnedRowsPanel } from './types';

/**
 * Pinned Rows (Status Bar) Plugin for tbw-grid
 *
 * Creates fixed status bars at the top or bottom of the grid for displaying aggregations,
 * row counts, or custom content. Think of it as the "totals row" you'd see in a spreadsheet—
 * always visible regardless of scroll position.
 *
 * ## Installation
 *
 * ```ts
 * import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `position` | `'top' \| 'bottom'` | `'bottom'` | Status bar position |
 * | `showRowCount` | `boolean` | `true` | Show total row count |
 * | `showSelectedCount` | `boolean` | `true` | Show selected row count |
 * | `showFilteredCount` | `boolean` | `true` | Show filtered row count |
 * | `aggregationRows` | `AggregationRowConfig[]` | - | Aggregation row configs |
 *
 * ## Built-in Aggregation Functions
 *
 * | Function | Description |
 * |----------|-------------|
 * | `sum` | Sum of values |
 * | `avg` | Average of values |
 * | `count` | Count of rows |
 * | `min` | Minimum value |
 * | `max` | Maximum value |
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-pinned-rows-bg` | `var(--tbw-color-panel-bg)` | Status bar background |
 * | `--tbw-pinned-rows-border` | `var(--tbw-color-border)` | Status bar border |
 *
 * @example Status Bar with Aggregation
 * ```ts
 * import '@toolbox-web/grid';
 * import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
 *
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'product', header: 'Product' },
 *     { field: 'quantity', header: 'Qty', type: 'number' },
 *     { field: 'price', header: 'Price', type: 'currency' },
 *   ],
 *   plugins: [
 *     new PinnedRowsPlugin({
 *       position: 'bottom',
 *       showRowCount: true,
 *       aggregationRows: [
 *         {
 *           id: 'totals',
 *           aggregators: { quantity: 'sum', price: 'sum' },
 *           cells: { product: 'Totals:' },
 *         },
 *       ],
 *     }),
 *   ],
 * };
 * ```
 *
 * @see {@link PinnedRowsConfig} for all configuration options
 * @see {@link AggregationRowConfig} for aggregation row structure
 *
 * @internal Extends BaseGridPlugin
 */
export class PinnedRowsPlugin extends BaseGridPlugin<PinnedRowsConfig> {
  /** @internal */
  readonly name = 'pinnedRows';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<PinnedRowsConfig> {
    return {
      position: 'bottom',
      showRowCount: true,
      showSelectedCount: true,
      showFilteredCount: true,
    };
  }

  // #region Internal State
  private infoBarElement: HTMLElement | null = null;
  private topAggregationContainer: HTMLElement | null = null;
  private bottomAggregationContainer: HTMLElement | null = null;
  private footerWrapper: HTMLElement | null = null;
  // #endregion

  // #region Lifecycle
  /** @internal */
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
  // #endregion

  // #region Hooks
  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Use .tbw-scroll-area so footer is inside the horizontal scroll area,
    // otherwise fall back to .tbw-grid-content or root container
    const container =
      gridEl.querySelector('.tbw-scroll-area') ?? gridEl.querySelector('.tbw-grid-content') ?? gridEl.children[0];
    if (!container) return;

    // Clear orphaned element references if they were removed from the DOM
    // (e.g., by buildGridDOMIntoShadow calling replaceChildren())
    // We check if the element is still inside the container rather than isConnected,
    // because in unit tests the mock grid may not be attached to document.body
    if (this.footerWrapper && !container.contains(this.footerWrapper)) {
      this.footerWrapper = null;
      this.bottomAggregationContainer = null;
      this.infoBarElement = null;
    }
    if (this.topAggregationContainer && !container.contains(this.topAggregationContainer)) {
      this.topAggregationContainer = null;
    }
    if (this.infoBarElement && !container.contains(this.infoBarElement)) {
      this.infoBarElement = null;
    }

    // Build context with plugin states
    const selectionState = this.getSelectionState();
    const filterState = this.getFilterState();

    const context = buildContext(
      this.sourceRows as unknown[],
      this.columns as unknown[],
      this.grid as unknown as HTMLElement,
      selectionState,
      filterState,
    );

    // #region Handle Aggregation Rows
    const aggregationRows = this.config.aggregationRows || [];
    const topRows = aggregationRows.filter((r) => r.position === 'top');
    const bottomRows = aggregationRows.filter((r) => r.position !== 'top');

    // Top aggregation rows
    if (topRows.length > 0) {
      if (!this.topAggregationContainer) {
        this.topAggregationContainer = createAggregationContainer('top');
        const header = gridEl.querySelector('.header');
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
        this.sourceRows as unknown[],
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
          this.sourceRows as unknown[],
        );
      }

      if (hasBottomInfoBar) {
        this.infoBarElement = createInfoBarElement(this.config, context);
        this.footerWrapper.appendChild(this.infoBarElement);
      }
    } else {
      this.cleanupFooter();
    }
    // #endregion
  }
  // #endregion

  // #region Private Methods
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
      return (this.grid?.getPluginState?.('selection') as { selected: Set<number> } | null) ?? null;
    } catch {
      return null;
    }
  }

  private getFilterState(): { cachedResult: unknown[] | null } | null {
    try {
      return (this.grid?.getPluginState?.('filtering') as { cachedResult: unknown[] | null } | null) ?? null;
    } catch {
      return null;
    }
  }
  // #endregion

  // #region Public API
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
      filterState,
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
  // #endregion
}

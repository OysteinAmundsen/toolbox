/**
 * Pinned Rows Plugin (Class-based)
 *
 * Adds info bars and aggregation rows to the grid.
 * - Info bar: Shows row counts, selection info, and custom panels
 * - Aggregation rows: Footer/header rows with computed values (sum, avg, etc.)
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import {
  buildContext,
  createAggregationContainer,
  createInfoBarElement,
  renderAggregationRows,
  renderAggregationSlot,
  renderPanelSlot,
} from './pinned-rows';
import styles from './pinned-rows.css?inline';
import type {
  AggregationRowConfig,
  PinnedRowSlot,
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowsPanel,
} from './types';

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
 * import {
 *   PinnedRowsPlugin,
 *   rowCountPanel,
 * } from '@toolbox-web/grid/plugins/pinned-rows';
 *
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'product', header: 'Product' },
 *     { field: 'quantity', header: 'Qty', type: 'number' },
 *     { field: 'price', header: 'Price', type: 'currency' },
 *   ],
 *   plugins: [
 *     new PinnedRowsPlugin({
 *       slots: [
 *         {
 *           id: 'totals',
 *           position: 'bottom',
 *           aggregators: { quantity: 'sum', price: 'sum' },
 *           cells: { product: 'Totals:' },
 *         },
 *         { id: 'count', position: 'bottom', render: rowCountPanel() },
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
 * @since 0.1.1
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
  /** Slot-mode wrapper: holds top slot rows when `config.slots` is provided. */
  private headerWrapper: HTMLElement | null = null;
  /** Tracks whether the last render used slot mode, so we can clean up the
   *  opposite mode's DOM if the user toggles between APIs at runtime. */
  private lastModeWasSlots = false;
  // #endregion

  // #region Lifecycle
  /** @internal */
  override detach(): void {
    this.cleanup();
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
      gridEl.querySelector('.tbw-scroll-area') ??
      gridEl.querySelector('.tbw-grid-content') ??
      gridEl.querySelector('.tbw-grid-root');
    if (!container) return;

    // Clear orphaned element references if they were removed from the DOM
    // (e.g., by buildGridDOMIntoShadow calling replaceChildren()).
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
    if (this.headerWrapper && !container.contains(this.headerWrapper)) {
      this.headerWrapper = null;
    }

    // Build context with plugin states
    const selectionState = this.getSelectionState();
    const filterState = this.getFilterState();

    const context = buildContext(
      this.sourceRows as unknown[],
      this.columns as unknown[],
      this.gridElement,
      selectionState,
      filterState,
    );

    // Mode dispatch: explicit `slots[]` ⇒ slot-driven layout.
    // Otherwise: legacy layout (preserves byte-identical DOM for existing consumers).
    if (this.config.slots) {
      this.renderSlotMode(container as HTMLElement, gridEl, context);
    } else {
      this.renderLegacyMode(container as HTMLElement, gridEl, context);
    }
  }
  // #endregion

  // #region Slot-mode rendering (issue #255)
  /**
   * Slot-driven render path: iterates `config.slots` in declared order and emits
   * one DOM row per slot inside `.tbw-header-pinned` (top) or `.tbw-footer` (bottom).
   * The slot order in the array is preserved as the visual top→bottom order
   * within each area.
   */
  private renderSlotMode(container: HTMLElement, gridEl: HTMLElement, context: PinnedRowsContext): void {
    // If we just switched into slot mode from legacy mode, tear down the
    // legacy DOM elements so we don't end up with both rendered side-by-side.
    if (!this.lastModeWasSlots) {
      this.detachLegacyOnly();
    }
    this.lastModeWasSlots = true;

    const slots = this.config.slots ?? [];
    const topSlots = slots.filter((s) => s.position === 'top');
    const bottomSlots = slots.filter((s) => s.position !== 'top');

    // Top wrapper sits AFTER the header (mirrors the legacy top-aggregation
    // insertion site); see the DECIDED entry in grid-plugins knowledge.
    if (topSlots.length > 0) {
      if (!this.headerWrapper) {
        this.headerWrapper = document.createElement('div');
        this.headerWrapper.className = 'tbw-header-pinned';
        // Insert at the top of the scroll area, before the rows body wrapper.
        // We cannot use `header.nextSibling` as a reference because `.header`
        // lives inside `.rows-body` (not directly in `container`), so passing
        // its sibling to `insertBefore` would throw NotFoundError. The header
        // is `position: sticky` within `.rows-body`, so it visually stays on
        // top regardless of where this wrapper sits in `container`.
        container.insertBefore(this.headerWrapper, container.firstChild);
      }
      this.populateSlotWrapper(this.headerWrapper, topSlots, 'top', context);
    } else if (this.headerWrapper) {
      this.headerWrapper.remove();
      this.headerWrapper = null;
    }

    if (bottomSlots.length > 0) {
      if (!this.footerWrapper) {
        this.footerWrapper = document.createElement('div');
        this.footerWrapper.className = 'tbw-footer';
        container.appendChild(this.footerWrapper);
      }
      this.populateSlotWrapper(this.footerWrapper, bottomSlots, 'bottom', context);
    } else if (this.footerWrapper) {
      this.footerWrapper.remove();
      this.footerWrapper = null;
    }
  }

  /**
   * Replaces the contents of a top/bottom wrapper with one DOM row per slot,
   * in array order. Drops slots that emit nothing (panel slot whose renderers
   * all returned null).
   */
  private populateSlotWrapper(
    wrapper: HTMLElement,
    slots: PinnedRowSlot[],
    position: 'top' | 'bottom',
    context: PinnedRowsContext,
  ): void {
    wrapper.innerHTML = '';
    for (const slot of slots) {
      const isPanel = 'render' in slot && (slot as { render?: unknown }).render != null;
      const rowEl = isPanel
        ? renderPanelSlot(slot as Parameters<typeof renderPanelSlot>[0], context)
        : renderAggregationSlot(
            slot as AggregationRowConfig,
            position,
            this.visibleColumns as ColumnConfig[],
            this.sourceRows as unknown[],
            this.config.fullWidth,
          );
      if (rowEl) wrapper.appendChild(rowEl);
    }
  }
  // #endregion

  // #region Legacy-mode rendering (DOM byte-identical to pre-#255 behavior)
  private renderLegacyMode(container: HTMLElement, gridEl: HTMLElement, context: PinnedRowsContext): void {
    if (this.lastModeWasSlots) {
      // Switched out of slot mode — drop the slot-mode wrappers.
      if (this.headerWrapper) {
        this.headerWrapper.remove();
        this.headerWrapper = null;
      }
      if (this.footerWrapper) {
        this.footerWrapper.remove();
        this.footerWrapper = null;
      }
      this.bottomAggregationContainer = null;
      this.infoBarElement = null;
    }
    this.lastModeWasSlots = false;

    // #region Handle Aggregation Rows
    const aggregationRows = this.config.aggregationRows || [];
    const topRows = aggregationRows.filter((r) => r.position === 'top');
    const bottomRows = aggregationRows.filter((r) => r.position !== 'top');

    // Top aggregation rows
    if (topRows.length > 0) {
      if (!this.topAggregationContainer) {
        this.topAggregationContainer = createAggregationContainer('top');
        // See note in renderSlotMode: `.header` is nested in `.rows-body`,
        // not in `container`, so its `nextSibling` is not a valid reference
        // for `container.insertBefore`. Insert at the top of `container`.
        container.insertBefore(this.topAggregationContainer, container.firstChild);
      }
      renderAggregationRows(
        this.topAggregationContainer,
        topRows,
        this.visibleColumns as ColumnConfig[],
        this.sourceRows as unknown[],
        this.config.fullWidth,
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
          this.config.fullWidth,
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
    if (this.headerWrapper) {
      this.headerWrapper.remove();
      this.headerWrapper = null;
    }
  }

  /** Detach only the legacy-mode DOM (used when switching legacy → slot mode). */
  private detachLegacyOnly(): void {
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
    if (this.infoBarElement) {
      this.infoBarElement.remove();
      this.infoBarElement = null;
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
      this.gridElement,
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

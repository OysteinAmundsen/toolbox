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
  filteredCountPanel,
  renderAggregationSlot,
  renderPanelSlot,
  rowCountPanel,
  selectedCountPanel,
} from './pinned-rows';
import styles from './pinned-rows.css?inline';
import type { AggregationRowConfig, PinnedRowSlot, PinnedRowsConfig, PinnedRowsContext } from './types';

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
      slots: [
        {
          position: 'bottom',
          render: [
            { zone: 'left', render: rowCountPanel() },
            { zone: 'left', render: filteredCountPanel() },
            { zone: 'right', render: selectedCountPanel() },
          ],
        },
      ],
    };
  }

  // #region Internal State
  private footerWrapper: HTMLElement | null = null;
  /** Slot-mode wrapper: holds top slot rows when `config.slots` is provided. */
  private headerWrapper: HTMLElement | null = null;
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

    // Slot-driven layout: one DOM row per slot in declared order.
    this.renderSlotMode(container as HTMLElement, gridEl, context);
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
   *
   * Diffs the new rows against the wrapper's current children by reference
   * and skips DOM mutation when nothing changed. Combined with the
   * memoization in {@link renderPanelSlot}, this prevents consumer-supplied
   * panels from being torn down and re-mounted on every grid render — which
   * caused tight feedback loops with Angular/React/Vue framework adapters
   * whose mount/unmount cycles bounced viewport height through
   * ResizeObserver-driven row-height autosizers.
   */
  private populateSlotWrapper(
    wrapper: HTMLElement,
    slots: PinnedRowSlot[],
    position: 'top' | 'bottom',
    context: PinnedRowsContext,
  ): void {
    // Index existing children by data-pinned-row-id so panel slots with a
    // stable id can be reused. Aggregation slots have no id and always rebuild.
    const previousById = new Map<string, HTMLElement>();
    for (let i = 0; i < wrapper.children.length; i++) {
      const child = wrapper.children[i] as HTMLElement;
      const id = child.getAttribute('data-pinned-row-id');
      if (id) previousById.set(id, child);
    }

    const newRows: HTMLElement[] = [];
    for (const slot of slots) {
      const isPanel = 'render' in slot && (slot as { render?: unknown }).render != null;
      const rowEl = isPanel
        ? renderPanelSlot(
            slot as Parameters<typeof renderPanelSlot>[0],
            context,
            slot.id ? (previousById.get(slot.id) ?? null) : null,
          )
        : renderAggregationSlot(
            slot as AggregationRowConfig,
            position,
            this.visibleColumns as ColumnConfig[],
            this.sourceRows as unknown[],
            this.config.fullWidth,
          );
      if (rowEl) newRows.push(rowEl);
    }

    // Fast path: identical refs in identical order → no DOM mutation.
    const current = wrapper.children;
    if (current.length === newRows.length) {
      let same = true;
      for (let i = 0; i < newRows.length; i++) {
        if (current[i] !== newRows[i]) {
          same = false;
          break;
        }
      }
      if (same) return;
    }

    wrapper.replaceChildren(...newRows);
  }
  // #endregion

  // #region Private Methods
  private cleanup(): void {
    if (this.footerWrapper) {
      this.footerWrapper.remove();
      this.footerWrapper = null;
    }
    if (this.headerWrapper) {
      this.headerWrapper.remove();
      this.headerWrapper = null;
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
  // #endregion
}

/**
 * Column Virtualization Plugin (Class-based)
 *
 * Provides horizontal column virtualization for grids with many columns.
 * Significantly improves rendering performance when dealing with >30 columns.
 */

import { interleaveHiddenColumns } from '../../core/internal/columns';
import { BaseGridPlugin, type PluginManifest, type PluginQuery, ScrollEvent } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import {
  computeColumnOffsets,
  computeTotalWidth,
  getColumnWidths,
  getVisibleColumnRange,
  shouldVirtualize,
} from './column-virtualization';
import type { ColumnVirtualizationConfig } from './types';

/**
 * Column Virtualization Plugin for tbw-grid
 *
 * Provides horizontal column virtualization for grids with many columns (30+).
 * Only renders visible columns plus overscan, significantly improving rendering
 * performance for wide grids.
 *
 * ## Installation
 *
 * ```ts
 * import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
 * ```
 *
 * ## Requirements
 *
 * - Grid must use `fitMode: 'fixed'`
 * - Columns must have explicit widths
 * - Grid must have fixed height
 *
 * @example Wide Grid with Column Virtualization
 * ```ts
 * import '@toolbox-web/grid';
 * import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
 *
 * grid.gridConfig = {
 *   columns: generateManyColumns(100), // 100 columns
 *   fitMode: 'fixed',                  // Required
 *   plugins: [
 *     new ColumnVirtualizationPlugin({
 *       threshold: 30,  // Enable when >30 columns
 *       overscan: 3,    // Render 3 extra columns each side
 *     }),
 *   ],
 * };
 * ```
 *
 * @see {@link ColumnVirtualizationConfig} for configuration options
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class ColumnVirtualizationPlugin extends BaseGridPlugin<ColumnVirtualizationConfig> {
  /** @internal */
  static override readonly manifest: PluginManifest = {
    hookPriority: {
      // Window AFTER every semantic column transform (pinning order, pivot, grouping…), so
      // `originalColumns`/`#sourceColumns` hold the final full set, whatever the plugin order.
      orderColumns: 1000,
      processColumns: 1000,
    },
    queries: [
      {
        type: 'getFullColumns',
        description: 'Full processed column list (hidden included), before the render-only column window',
      },
    ],
  };

  /** @internal */
  readonly name = 'columnVirtualization';

  /** @internal */
  protected override get defaultConfig(): Partial<ColumnVirtualizationConfig> {
    return {
      autoEnable: true,
      threshold: 30,
      overscan: 3,
    };
  }

  // #region Internal State
  private isVirtualized = false;
  private startCol = 0;
  private endCol = 0;
  private scrollLeft = 0;
  private totalWidth = 0;
  private columnWidths: number[] = [];
  private columnOffsets: number[] = [];
  /** Store the original full column set for virtualization calculations */
  private originalColumns: readonly ColumnConfig[] = [];
  /** Full ordered column list (hidden included) captured with `originalColumns`, for `getFullColumns`. */
  #sourceColumns: readonly ColumnConfig[] = [];
  /** This pass's `orderColumns` input; adopted as `#sourceColumns` only with a new column set. */
  #pendingSourceColumns: readonly ColumnConfig[] = [];
  /** Window emitted by the last pass (empty when not virtualized) — the only list core feeds back. */
  #lastWindow: readonly ColumnConfig[] = [];
  /** Fields hidden when the current set was adopted; showing one later is not a new set (#603). */
  #hiddenAtAdoption = new Set<string>();
  /** Row/header left padding: offset of the window start minus the always-rendered columns before it. */
  #leftPadding = 0;
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Initialize state from current columns
    const columns = this.columns;
    this.#measure(columns);
    this.endCol = columns.length - 1;
  }

  /** @internal */
  override detach(): void {
    // Clean up inline styles set by this plugin
    this.#cleanupStyles();

    this.columnWidths = [];
    this.columnOffsets = [];
    this.originalColumns = [];
    this.#sourceColumns = [];
    this.#pendingSourceColumns = [];
    this.#lastWindow = [];
    this.#hiddenAtAdoption.clear();
    this.#leftPadding = 0;
    this.isVirtualized = false;
    this.startCol = 0;
    this.endCol = 0;
    this.scrollLeft = 0;
    this.totalWidth = 0;
  }

  /**
   * Remove inline styles set by this plugin for proper cleanup.
   */
  #cleanupStyles(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const headerRow = gridEl.querySelector('.header-row') as HTMLElement | null;
    if (headerRow) {
      headerRow.style.paddingLeft = '';
      headerRow.style.minWidth = '';
    }

    const bodyRows = gridEl.querySelectorAll('.data-grid-row');
    bodyRows.forEach((row) => {
      (row as HTMLElement).style.paddingLeft = '';
    });

    const rowsContainer = gridEl.querySelector('.rows-viewport .rows') as HTMLElement | null;
    if (rowsContainer) {
      rowsContainer.style.width = '';
    }

    const rowsBody = gridEl.querySelector('.rows-body') as HTMLElement | null;
    if (rowsBody) {
      rowsBody.style.minWidth = '';
    }
  }
  // #endregion

  // #region Hooks

  /**
   * Capture the final ordered column list (hidden included; runs last via `hookPriority`) so
   * `getFullColumns` can re-insert hidden columns at their source position. Never reorders.
   * @internal
   */
  override orderColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // After a scroll pass core feeds back our own window here, so it is only
    // trusted once processColumns recognises a new full column set.
    this.#pendingSourceColumns = columns;
    return columns as ColumnConfig[];
  }

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    // `grid.columns` only holds the rendered window while virtualized; data
    // operations (export, copy) need every column (#598).
    if (query.type === 'getFullColumns' && this.isVirtualized) {
      return interleaveHiddenColumns(this.#sourceColumns, this.originalColumns);
    }
    return undefined;
  }

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Core feeds our previous window back in on later passes (scroll, render requests),
    // so only a pass that is NOT that feedback carries a new full column set.
    const isNewColumnSet = this.originalColumns.length === 0 || !this.#isWindowFeedback(columns);

    if (isNewColumnSet) {
      // Store the full column set
      this.originalColumns = columns;
      this.#sourceColumns = this.#pendingSourceColumns;
      this.#hiddenAtAdoption = new Set(this.#sourceColumns.filter((c) => c.hidden).map((c) => c.field));
      this.#measure(columns);
    } else {
      this.#adoptFeedbackColumns(columns);
    }

    // Use the original (full) column set for virtualization decisions
    const fullColumns = this.originalColumns;
    const isVirtualized = shouldVirtualize(
      fullColumns.length,
      this.config.threshold ?? 30,
      this.config.autoEnable ?? true,
    );

    this.isVirtualized = isVirtualized ?? false;

    if (!isVirtualized) {
      this.startCol = 0;
      this.endCol = fullColumns.length - 1;
      this.#lastWindow = [];
      this.#leftPadding = 0;
      return [...fullColumns];
    }

    // Get viewport width from grid element
    const viewportWidth = this.grid?.clientWidth || 800;
    const viewport = getVisibleColumnRange(
      this.scrollLeft,
      viewportWidth,
      this.columnOffsets,
      this.columnWidths,
      this.config.overscan ?? 3,
    );

    this.startCol = viewport.startCol;
    this.endCol = viewport.endCol;

    // Pinned (sticky) and utility columns (selection checkbox, expander, drag handle) are never
    // windowed out. Padding shrinks by the always-rendered columns before the window so window
    // cells keep their true x-offset. Read live per pass (runtime `setPinPosition` while virtualized: #606).
    const rendered: ColumnConfig[] = [];
    let leadingWidth = 0;
    for (let i = 0; i < fullColumns.length; i++) {
      const col = fullColumns[i];
      if (i >= viewport.startCol && i <= viewport.endCol) rendered.push(col);
      else if (col.utility || (col as ColumnConfig & { pinned?: string }).pinned) {
        rendered.push(col);
        if (i < viewport.startCol) leadingWidth += this.columnWidths[i] ?? 0;
      }
    }
    this.#leftPadding = (this.columnOffsets[viewport.startCol] ?? 0) - leadingWidth;
    this.#lastWindow = rendered;
    return [...rendered];
  }

  /**
   * A feedback pass still carries this pass's upstream property changes for the fields it
   * contains — e.g. TreePlugin wrapping a renderer once rows arrive, or a resized width. Adopt
   * those objects by field so they are not discarded in favour of the cached ones.
   */
  #adoptFeedbackColumns(columns: readonly ColumnConfig[]): void {
    const incoming = new Map(columns.map((c) => [c.field, c]));
    let changed = false;
    const next = this.originalColumns.map((col) => {
      const update = incoming.get(col.field);
      if (!update || update === col) return col;
      changed = true;
      return update;
    });
    if (!changed) return;
    this.originalColumns = next;
    this.#measure(next);
  }

  #measure(columns: readonly ColumnConfig[]): void {
    this.columnWidths = getColumnWidths(columns);
    this.columnOffsets = computeColumnOffsets(columns);
    this.totalWidth = computeTotalWidth(columns);
  }

  /**
   * Whether `columns` is our previous window fed back by core rather than a new column set.
   *
   * Feedback carries exactly the last window's fields. Allowed differences: utility columns
   * (re-injected by other plugins each pass), window columns since hidden, and columns hidden
   * at adoption since shown (#603). Anything else — e.g. an active Pivot whose regenerated
   * columns shrank — is a semantic replacement, even when it has fewer columns than before.
   */
  #isWindowFeedback(columns: readonly ColumnConfig[]): boolean {
    const last = this.#lastWindow;
    if (last.length === 0 || columns.length >= this.originalColumns.length) return false;
    const windowFields = new Set(last.map((c) => c.field));
    const incoming = new Set<string>();
    for (const col of columns) {
      if (col.utility) continue;
      if (!windowFields.has(col.field) && !this.#hiddenAtAdoption.has(col.field)) return false;
      incoming.add(col.field);
    }
    return last.every((c) => c.utility || c.hidden || incoming.has(c.field));
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isVirtualized) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Apply left padding to offset scrolled-out columns
    const leftPadding = this.#leftPadding;

    const headerRow = gridEl.querySelector('.header-row') as HTMLElement | null;
    const bodyRows = gridEl.querySelectorAll('.data-grid-row');

    if (headerRow) {
      headerRow.style.paddingLeft = `${leftPadding}px`;
      // Set min-width on header row to enable horizontal scrolling
      headerRow.style.minWidth = `${this.totalWidth}px`;
    }

    bodyRows.forEach((row) => {
      (row as HTMLElement).style.paddingLeft = `${leftPadding}px`;
    });

    // Set total width for horizontal scrolling on the rows container
    const rowsContainer = gridEl.querySelector('.rows-viewport .rows') as HTMLElement | null;
    if (rowsContainer) {
      rowsContainer.style.width = `${this.totalWidth}px`;
    }

    // Also set min-width on .rows-body to ensure the scroll container knows the total scrollable width
    const rowsBody = gridEl.querySelector('.rows-body') as HTMLElement | null;
    if (rowsBody) {
      rowsBody.style.minWidth = `${this.totalWidth}px`;
    }
  }

  /** @internal */
  override onScroll(event: ScrollEvent): void {
    if (!this.isVirtualized) return;

    // Check if horizontal scroll position changed significantly
    const scrollDelta = Math.abs(event.scrollLeft - this.scrollLeft);
    if (scrollDelta < 1) return;

    // Update scroll position
    this.scrollLeft = event.scrollLeft;

    // Recalculate visible columns and request re-render
    // Must use requestColumnsRender() to trigger COLUMNS phase (processColumns hook)
    // requestRender() only requests ROWS phase which doesn't reprocess columns
    this.requestColumnsRender();
  }
  // #endregion

  // #region Public API

  /**
   * Check if column virtualization is currently active.
   */
  getIsVirtualized(): boolean {
    return this.isVirtualized;
  }

  /**
   * Get the current visible column range.
   */
  getVisibleColumnRange(): { start: number; end: number } {
    return { start: this.startCol, end: this.endCol };
  }

  /**
   * Scroll the grid to bring a specific column into view.
   * @param columnIndex - Index of the column to scroll to
   */
  scrollToColumn(columnIndex: number): void {
    const offset = this.columnOffsets[columnIndex] ?? 0;
    const gridEl = this.gridElement;
    // Scroll the grid element itself (it's the scroll container)
    if (gridEl) gridEl.scrollLeft = offset;
  }

  /**
   * Get the left offset for a specific column.
   * @param columnIndex - Index of the column
   */
  getColumnOffset(columnIndex: number): number {
    return this.columnOffsets[columnIndex] ?? 0;
  }

  /**
   * Get the total width of all columns.
   */
  getTotalWidth(): number {
    return this.totalWidth;
  }
  // #endregion
}

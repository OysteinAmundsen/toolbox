/**
 * Column Virtualization Plugin (Class-based)
 *
 * Provides horizontal column virtualization for grids with many columns.
 * Significantly improves rendering performance when dealing with >30 columns.
 */

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

/** Host custom property carrying the window's left offset to rows rendered by other plugins. */
const WINDOW_OFFSET_PROPERTY = '--tbw-column-window-offset';

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
    queries: [
      {
        type: 'revealColumn',
        description: 'Scroll a column (context: field) into the rendered window; true when the window moved',
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
  /** Row/header left padding: offset of the window start minus the always-rendered columns before it. */
  #leftPadding = 0;
  /** Whether afterRender wrote padding/width styles that must be cleared once virtualization turns off. */
  #stylesApplied = false;
  /** Visible columns the current window was computed from: live objects, so in-place width changes show. */
  #windowSource: readonly ColumnConfig[] = [];
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
    this.#leftPadding = 0;
    this.#stylesApplied = false;
    this.#windowSource = [];
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
    gridEl.style.removeProperty(WINDOW_OFFSET_PROPERTY);

    const headerRow = gridEl.querySelector('.header-row') as HTMLElement | null;
    if (headerRow) {
      headerRow.style.paddingLeft = '';
      headerRow.style.minWidth = '';
    }

    const bodyRows = this.#ownRows(gridEl);
    bodyRows.forEach((row) => {
      row.style.paddingLeft = '';
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
   * `revealColumn`: scroll so a column that fell outside the window (e.g. moved by keyboard
   * reorder) is rendered again, and re-window synchronously so the caller can resolve its
   * rendered index right away. Offsets are measured fresh from the full visible list.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type !== 'revealColumn' || !this.isVirtualized) return undefined;
    const columns = this.columns.filter((c) => !c.hidden);
    const index = columns.findIndex((c) => c.field === query.context);
    if (index < 0) return undefined;

    const left = computeColumnOffsets(columns)[index];
    const right = left + getColumnWidths(columns)[index];
    const viewportWidth = this.grid?.clientWidth || 800;
    let target = this.scrollLeft;
    if (left < target) target = left;
    else if (right > target + viewportWidth) target = right - viewportWidth;
    if (target === this.scrollLeft) return false;

    this.scrollLeft = target;
    this.#scrollAreaTo(target);
    this.grid._invalidateVisibleColumnsCache();
    this.requestColumnWindowRender();
    return true;
  }

  /**
   * Narrow the full visible column list to the rendered scroll window. A pure function of
   * `(columns, scrollLeft)`: core passes the complete post-plugin set on every call and never
   * feeds the window back into `processColumns` (#603).
   * @internal
   */
  override windowColumns(columns: readonly ColumnConfig[]): readonly ColumnConfig[] {
    this.#windowSource = columns;
    this.#measure(columns);
    this.isVirtualized =
      shouldVirtualize(columns.length, this.config.threshold ?? 30, this.config.autoEnable ?? true) ?? false;

    if (!this.isVirtualized) {
      this.startCol = 0;
      this.endCol = columns.length - 1;
      this.#leftPadding = 0;
      return columns;
    }

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
    // cells keep their true x-offset.
    const rendered: ColumnConfig[] = [];
    let leadingWidth = 0;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i] as ColumnConfig & { pinned?: string };
      if (i >= viewport.startCol && i <= viewport.endCol) rendered.push(col);
      // Same pin resolution as PinnedColumns (`pinned ?? meta.pinned`).
      else if (col.utility || (col.pinned ?? col.meta?.pinned)) {
        rendered.push(col);
        if (i < viewport.startCol) leadingWidth += this.columnWidths[i] ?? 0;
      }
    }
    this.#leftPadding = (this.columnOffsets[viewport.startCol] ?? 0) - leadingWidth;
    return rendered;
  }

  #measure(columns: readonly ColumnConfig[]): void {
    this.columnWidths = getColumnWidths(columns);
    this.columnOffsets = computeColumnOffsets(columns);
    this.totalWidth = computeTotalWidth(columns);
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isVirtualized) {
      // Hiding columns or a smaller config can drop below the threshold: undo the padding/widths once.
      if (this.#stylesApplied) {
        this.#cleanupStyles();
        this.#stylesApplied = false;
      }
      return;
    }

    const gridEl = this.gridElement;
    if (!gridEl) return;
    this.#stylesApplied = true;

    // Apply left padding to offset scrolled-out columns
    const leftPadding = this.#leftPadding;
    // Rows other plugins rebuild in their own afterRender (GroupingColumns' group header row,
    // PinnedRows' aggregation rows) pad themselves from this property, whatever the hook order.
    gridEl.style.setProperty(WINDOW_OFFSET_PROPERTY, `${leftPadding}px`);

    const headerRow = gridEl.querySelector('.header-row') as HTMLElement | null;
    const bodyRows = this.#ownRows(gridEl);

    if (headerRow) {
      headerRow.style.paddingLeft = `${leftPadding}px`;
      // Set min-width on header row to enable horizontal scrolling
      headerRow.style.minWidth = `${this.totalWidth}px`;
    }

    bodyRows.forEach((row) => {
      row.style.paddingLeft = `${leftPadding}px`;
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
    // Track the position even while not virtualized, so a later switch back on (columns shown,
    // larger config) windows at the real scroll offset instead of a stale one.
    const scrollDelta = Math.abs(event.scrollLeft - this.scrollLeft);
    if (scrollDelta < 1) return;
    this.scrollLeft = event.scrollLeft;
    if (!this.isVirtualized || !this.#windowMoves()) return;

    // The window is a pure function of the processed columns and scrollLeft (#603): re-window
    // only (template, header, row cells), without re-running mergeConfig/processRows/processColumns.
    this.requestColumnWindowRender();
  }

  /**
   * Whether the current scroll position needs a different window. A re-window rebuilds the cells
   * of every pooled row, so scroll frames that stay inside the rendered window must not request one.
   * A width change since the last window (in-place column resize) always re-windows.
   */
  #windowMoves(): boolean {
    if (computeTotalWidth(this.#windowSource) !== this.totalWidth) return true;
    const { startCol, endCol } = getVisibleColumnRange(
      this.scrollLeft,
      this.grid?.clientWidth || 800,
      this.columnOffsets,
      this.columnWidths,
      this.config.overscan ?? 3,
    );
    return startCol !== this.startCol || endCol !== this.endCol;
  }

  /** Scroll the grid's horizontal scroll container (`.tbw-scroll-area`; the host itself never scrolls). */
  #scrollAreaTo(scrollLeft: number): void {
    const scrollArea = this.gridElement?.querySelector<HTMLElement>('.tbw-scroll-area');
    if (scrollArea) scrollArea.scrollLeft = scrollLeft;
  }

  /** This grid's own rows: a nested grid (e.g. a MasterDetail panel) keeps its own column offset. */
  #ownRows(gridEl: HTMLElement): HTMLElement[] {
    return [...gridEl.querySelectorAll<HTMLElement>('.data-grid-row')].filter((row) => this.isOwnTarget(row));
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
    this.#scrollAreaTo(this.columnOffsets[columnIndex] ?? 0);
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

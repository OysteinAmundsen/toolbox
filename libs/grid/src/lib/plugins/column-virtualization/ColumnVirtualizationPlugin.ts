/**
 * Column Virtualization Plugin (Class-based)
 *
 * Provides horizontal column virtualization for grids with many columns.
 * Significantly improves rendering performance when dealing with >30 columns.
 */

import { BaseGridPlugin, ScrollEvent } from '../../core/plugin/base-plugin';
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
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `autoEnable` | `boolean` | `true` | Auto-enable when column count exceeds threshold |
 * | `threshold` | `number` | `30` | Column count threshold for auto-enable |
 * | `overscan` | `number` | `3` | Extra columns to render beyond visible |
 *
 * ## Requirements
 *
 * - Grid must use `fitMode: 'fixed'`
 * - Columns must have explicit widths
 * - Grid must have fixed height
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `isEnabled` | `() => boolean` | Check if virtualization is active |
 * | `setEnabled` | `(enabled: boolean) => void` | Enable/disable virtualization |
 * | `getVisibleRange` | `() => { start, end }` | Get visible column range |
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
 */
export class ColumnVirtualizationPlugin extends BaseGridPlugin<ColumnVirtualizationConfig> {
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
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Initialize state from current columns
    const columns = this.columns;
    this.columnWidths = getColumnWidths(columns);
    this.columnOffsets = computeColumnOffsets(columns);
    this.totalWidth = computeTotalWidth(columns);
    this.endCol = columns.length - 1;
  }

  /** @internal */
  override detach(): void {
    this.columnWidths = [];
    this.columnOffsets = [];
    this.isVirtualized = false;
    this.startCol = 0;
    this.endCol = 0;
    this.scrollLeft = 0;
    this.totalWidth = 0;
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    const isVirtualized = shouldVirtualize(columns.length, this.config.threshold ?? 30, this.config.autoEnable ?? true);

    // Update state with current column metrics
    this.isVirtualized = isVirtualized ?? false;
    this.columnWidths = getColumnWidths(columns);
    this.columnOffsets = computeColumnOffsets(columns);
    this.totalWidth = computeTotalWidth(columns);

    if (!isVirtualized) {
      this.startCol = 0;
      this.endCol = columns.length - 1;
      return [...columns];
    }

    // Get viewport width from grid element
    const viewportWidth = (this.grid as unknown as HTMLElement).clientWidth || 800;
    const viewport = getVisibleColumnRange(
      this.scrollLeft,
      viewportWidth,
      this.columnOffsets,
      this.columnWidths,
      this.config.overscan ?? 3,
    );

    this.startCol = viewport.startCol;
    this.endCol = viewport.endCol;

    // Return only visible columns
    return viewport.visibleColumns.map((i) => columns[i]);
  }

  /** @internal */
  override afterRender(): void {
    if (!this.isVirtualized) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Apply left padding to offset scrolled-out columns
    const leftPadding = this.columnOffsets[this.startCol] ?? 0;

    const headerRow = gridEl.querySelector('.header-row');
    const bodyRows = gridEl.querySelectorAll('.data-grid-row');

    if (headerRow) {
      (headerRow as HTMLElement).style.paddingLeft = `${leftPadding}px`;
    }

    bodyRows.forEach((row) => {
      (row as HTMLElement).style.paddingLeft = `${leftPadding}px`;
    });

    // Set total width for horizontal scrolling on the rows container
    const rowsContainer = gridEl.querySelector('.rows-viewport .rows');
    if (rowsContainer) {
      (rowsContainer as HTMLElement).style.width = `${this.totalWidth}px`;
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
    this.requestRender();
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
    const gridEl = this.grid as unknown as HTMLElement;
    // Scroll the grid element itself (it's the scroll container)
    gridEl.scrollLeft = offset;
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

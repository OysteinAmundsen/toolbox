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
 * @example
 * ```ts
 * new ColumnVirtualizationPlugin({ threshold: 30, overscan: 3 })
 * ```
 */
export class ColumnVirtualizationPlugin extends BaseGridPlugin<ColumnVirtualizationConfig> {
  readonly name = 'columnVirtualization';

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

  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Initialize state from current columns
    const columns = this.columns;
    this.columnWidths = getColumnWidths(columns);
    this.columnOffsets = computeColumnOffsets(columns);
    this.totalWidth = computeTotalWidth(columns);
    this.endCol = columns.length - 1;
  }

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

  override afterRender(): void {
    if (!this.isVirtualized) return;

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Apply left padding to offset scrolled-out columns
    const leftPadding = this.columnOffsets[this.startCol] ?? 0;

    const headerRow = shadowRoot.querySelector('.header-row');
    const bodyRows = shadowRoot.querySelectorAll('.data-grid-row');

    if (headerRow) {
      (headerRow as HTMLElement).style.paddingLeft = `${leftPadding}px`;
    }

    bodyRows.forEach((row) => {
      (row as HTMLElement).style.paddingLeft = `${leftPadding}px`;
    });

    // Set total width for horizontal scrolling on the rows container
    const rowsContainer = shadowRoot.querySelector('.rows-viewport .rows');
    if (rowsContainer) {
      (rowsContainer as HTMLElement).style.width = `${this.totalWidth}px`;
    }
  }

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

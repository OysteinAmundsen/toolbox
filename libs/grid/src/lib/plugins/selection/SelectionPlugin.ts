/**
 * Selection Plugin (Class-based)
 *
 * Provides selection functionality for tbw-grid.
 * Supports three modes:
 * - 'cell': Single cell selection (default). No border, just focus highlight.
 * - 'row': Row selection. Clicking a cell selects the entire row.
 * - 'range': Range selection. Shift+click or drag to select rectangular cell ranges.
 */

import { BaseGridPlugin, CellClickEvent, CellMouseEvent, ScrollEvent } from '../../core/plugin/base-plugin';
import {
  createRangeFromAnchor,
  getAllCellsInRanges,
  isCellInAnyRange,
  normalizeRange,
  toPublicRanges,
} from './range-selection';
import type { CellRange, InternalCellRange, SelectionChangeDetail, SelectionConfig, SelectionMode } from './types';

/**
 * Build the selection change event detail for the current state.
 */
function buildSelectionEvent(
  mode: SelectionMode,
  state: {
    selectedCell: { row: number; col: number } | null;
    selected: Set<number>;
    ranges: InternalCellRange[];
  },
  colCount: number
): SelectionChangeDetail {
  if (mode === 'cell' && state.selectedCell) {
    return {
      mode,
      ranges: [
        {
          from: { row: state.selectedCell.row, col: state.selectedCell.col },
          to: { row: state.selectedCell.row, col: state.selectedCell.col },
        },
      ],
    };
  }

  if (mode === 'row' && state.selected.size > 0) {
    const ranges = [...state.selected].map((rowIndex) => ({
      from: { row: rowIndex, col: 0 },
      to: { row: rowIndex, col: colCount - 1 },
    }));
    return { mode, ranges };
  }

  if (mode === 'range' && state.ranges.length > 0) {
    return { mode, ranges: toPublicRanges(state.ranges) };
  }

  return { mode, ranges: [] };
}

/**
 * Selection Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new SelectionPlugin({ mode: 'range' })
 * ```
 */
export class SelectionPlugin extends BaseGridPlugin<SelectionConfig> {
  readonly name = 'selection';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<SelectionConfig> {
    return {
      mode: 'cell',
    };
  }

  // ===== Internal State =====
  /** Row selection state (row mode) */
  private selected = new Set<number>();
  private lastSelected: number | null = null;
  private anchor: number | null = null;

  /** Range selection state (range mode) */
  private ranges: InternalCellRange[] = [];
  private activeRange: InternalCellRange | null = null;
  private cellAnchor: { row: number; col: number } | null = null;
  private isDragging = false;

  /** Cell selection state (cell mode) */
  private selectedCell: { row: number; col: number } | null = null;

  // ===== Lifecycle =====

  override detach(): void {
    this.selected.clear();
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.isDragging = false;
    this.selectedCell = null;
  }

  // ===== Event Handlers =====

  override onCellClick(event: CellClickEvent): boolean {
    const { rowIndex, colIndex, originalEvent } = event;
    const { mode } = this.config;

    // ===== CELL MODE: Single cell selection =====
    if (mode === 'cell') {
      this.selectedCell = { row: rowIndex, col: colIndex };
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // ===== ROW MODE: Select entire row =====
    if (mode === 'row') {
      this.selected.clear();
      this.selected.add(rowIndex);
      this.lastSelected = rowIndex;

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // ===== RANGE MODE: Shift+click extends selection, click starts new =====
    if (mode === 'range') {
      const shiftKey = originalEvent.shiftKey;
      const ctrlKey = originalEvent.ctrlKey || originalEvent.metaKey;

      if (shiftKey && this.cellAnchor) {
        // Extend selection from anchor
        const newRange = createRangeFromAnchor(this.cellAnchor, { row: rowIndex, col: colIndex });

        if (ctrlKey) {
          if (this.ranges.length > 0) {
            this.ranges[this.ranges.length - 1] = newRange;
          } else {
            this.ranges.push(newRange);
          }
        } else {
          this.ranges = [newRange];
        }
        this.activeRange = newRange;
      } else if (ctrlKey) {
        const newRange: InternalCellRange = {
          startRow: rowIndex,
          startCol: colIndex,
          endRow: rowIndex,
          endCol: colIndex,
        };
        this.ranges.push(newRange);
        this.activeRange = newRange;
        this.cellAnchor = { row: rowIndex, col: colIndex };
      } else {
        const newRange: InternalCellRange = {
          startRow: rowIndex,
          startCol: colIndex,
          endRow: rowIndex,
          endCol: colIndex,
        };
        this.ranges = [newRange];
        this.activeRange = newRange;
        this.cellAnchor = { row: rowIndex, col: colIndex };
      }

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());

      this.requestAfterRender();
      return false;
    }

    return false;
  }

  override onKeyDown(event: KeyboardEvent): boolean {
    const { mode } = this.config;

    // Escape clears selection in all modes
    if (event.key === 'Escape') {
      if (mode === 'cell') {
        this.selectedCell = null;
      } else if (mode === 'row') {
        this.selected.clear();
        this.anchor = null;
      } else if (mode === 'range') {
        this.ranges = [];
        this.activeRange = null;
        this.cellAnchor = null;
      }
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return true;
    }

    // Ctrl+A selects all in range mode
    if (mode === 'range' && event.key === 'a' && (event.ctrlKey || event.metaKey)) {
      const rowCount = this.rows.length;
      const colCount = this.columns.length;
      if (rowCount > 0 && colCount > 0) {
        const allRange: InternalCellRange = {
          startRow: 0,
          startCol: 0,
          endRow: rowCount - 1,
          endCol: colCount - 1,
        };
        this.ranges = [allRange];
        this.activeRange = allRange;
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
        return true;
      }
    }

    return false;
  }

  override onCellMouseDown(event: CellMouseEvent): boolean | void {
    if (this.config.mode !== 'range') return;
    if (event.rowIndex === undefined || event.colIndex === undefined) return;
    if (event.rowIndex < 0) return; // Header

    // Let onCellClick handle shift+click for range extension
    if (event.originalEvent.shiftKey && this.cellAnchor) {
      return;
    }

    // Start drag selection
    this.isDragging = true;
    const rowIndex = event.rowIndex;
    const colIndex = event.colIndex;
    this.cellAnchor = { row: rowIndex, col: colIndex };

    const ctrlKey = event.originalEvent.ctrlKey || event.originalEvent.metaKey;
    if (!ctrlKey) {
      this.ranges = [];
    }

    const newRange: InternalCellRange = {
      startRow: rowIndex,
      startCol: colIndex,
      endRow: rowIndex,
      endCol: colIndex,
    };
    this.ranges.push(newRange);
    this.activeRange = newRange;

    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
    return true;
  }

  override onCellMouseMove(event: CellMouseEvent): boolean | void {
    if (this.config.mode !== 'range') return;
    if (!this.isDragging || !this.cellAnchor) return;
    if (event.rowIndex === undefined || event.colIndex === undefined) return;
    if (event.rowIndex < 0) return;

    const newRange = createRangeFromAnchor(this.cellAnchor, { row: event.rowIndex, col: event.colIndex });

    if (this.ranges.length > 0) {
      this.ranges[this.ranges.length - 1] = newRange;
    } else {
      this.ranges.push(newRange);
    }
    this.activeRange = newRange;

    this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    this.requestAfterRender();
    return true;
  }

  override onCellMouseUp(_event: CellMouseEvent): boolean | void {
    if (this.config.mode !== 'range') return;
    if (this.isDragging) {
      this.isDragging = false;
      return true;
    }
  }

  /**
   * Called during scroll - must update selection classes on recycled rows
   */
  override onScroll(_event: ScrollEvent): void {
    // Apply selection classes to newly rendered/recycled rows
    this.#applySelectionClasses();
  }

  override afterRender(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const container = shadowRoot.children[0];
    const { mode } = this.config;

    // Set data attribute on host for CSS variable scoping
    (this.grid as unknown as Element).setAttribute('data-selection-mode', mode);

    // Toggle .selecting class during drag to prevent text selection
    if (container) {
      container.classList.toggle('selecting', this.isDragging);
    }

    // Apply selection classes to cells/rows
    this.#applySelectionClasses();
  }

  /**
   * Apply selection-related CSS classes to currently visible cells/rows.
   * Called from both afterRender() and onScroll() to ensure selection
   * is always correct when rows are recycled during virtualization.
   */
  #applySelectionClasses(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const { mode } = this.config;

    // Clear all selection classes first
    const allCells = shadowRoot.querySelectorAll('.cell');
    allCells.forEach((cell) => {
      cell.classList.remove('selected', 'top', 'bottom', 'first', 'last');
    });

    const allRows = shadowRoot.querySelectorAll('.data-grid-row');
    allRows.forEach((row) => {
      row.classList.remove('selected');
    });

    // ===== ROW MODE: Add row-focus class to selected rows =====
    if (mode === 'row') {
      allRows.forEach((row) => row.classList.remove('row-focus'));

      allRows.forEach((row) => {
        const firstCell = row.querySelector('.cell[data-row]');
        const rowIndex = parseInt(firstCell?.getAttribute('data-row') ?? '-1', 10);
        if (rowIndex >= 0 && this.selected.has(rowIndex)) {
          row.classList.add('selected', 'row-focus');
        }
      });
    }

    // ===== RANGE MODE: Add selected and edge classes to cells =====
    if (mode === 'range' && this.ranges.length > 0) {
      const normalized = this.activeRange ? normalizeRange(this.activeRange) : null;

      const cells = shadowRoot.querySelectorAll('.cell[data-row][data-col]');
      cells.forEach((cell) => {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        if (rowIndex >= 0 && colIndex >= 0) {
          const inRange = isCellInAnyRange(rowIndex, colIndex, this.ranges);

          if (inRange) {
            cell.classList.add('selected');

            if (normalized) {
              if (rowIndex === normalized.startRow) cell.classList.add('top');
              if (rowIndex === normalized.endRow) cell.classList.add('bottom');
              if (colIndex === normalized.startCol) cell.classList.add('first');
              if (colIndex === normalized.endCol) cell.classList.add('last');
            }
          }
        }
      });
    }
  }

  // ===== Public API =====

  /**
   * Get the selected cell (cell mode only).
   */
  getSelectedCell(): { row: number; col: number } | null {
    return this.selectedCell;
  }

  /**
   * Get all selected row indices (row mode).
   */
  getSelectedRows(): number[] {
    return [...this.selected];
  }

  /**
   * Get all selected cell ranges in public format.
   */
  getRanges(): CellRange[] {
    return toPublicRanges(this.ranges);
  }

  /**
   * Get all selected cells across all ranges.
   */
  getSelectedCells(): Array<{ row: number; col: number }> {
    return getAllCellsInRanges(this.ranges);
  }

  /**
   * Check if a specific cell is in range selection.
   */
  isCellSelected(row: number, col: number): boolean {
    return isCellInAnyRange(row, col, this.ranges);
  }

  /**
   * Clear all selection.
   */
  clearSelection(): void {
    this.selectedCell = null;
    this.selected.clear();
    this.anchor = null;
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.emit<SelectionChangeDetail>('selection-change', { mode: this.config.mode, ranges: [] });
    this.requestAfterRender();
  }

  /**
   * Set selected ranges programmatically.
   */
  setRanges(ranges: CellRange[]): void {
    this.ranges = ranges.map((r) => ({
      startRow: r.from.row,
      startCol: r.from.col,
      endRow: r.to.row,
      endCol: r.to.col,
    }));
    this.activeRange = this.ranges.length > 0 ? this.ranges[this.ranges.length - 1] : null;
    this.emit<SelectionChangeDetail>('selection-change', {
      mode: this.config.mode,
      ranges: toPublicRanges(this.ranges),
    });
    this.requestAfterRender();
  }

  // ===== Private Helpers =====

  #buildEvent(): SelectionChangeDetail {
    return buildSelectionEvent(
      this.config.mode,
      {
        selectedCell: this.selectedCell,
        selected: this.selected,
        ranges: this.ranges,
      },
      this.columns.length
    );
  }

  // ===== Styles =====

  override readonly styles = `
    /* Prevent text selection during range drag */
    :host .selecting .data-grid-row > .cell {
      user-select: none;
    }

    /* Row selection - use accent color for row focus */
    :host .data-grid-row.row-focus {
      background-color: var(--tbw-focus-background, rgba(from var(--tbw-color-accent) r g b / 12%));
    }

    /* Disable cell-focus outline in row mode - row is the focus unit */
    :host([data-selection-mode="row"]) .cell-focus {
      outline: none;
    }

    /* Selection cell styles - for range mode */
    :host .data-grid-row > .cell.selected {
      background-color: var(--tbw-range-selection-bg);
    }
    :host .data-grid-row > .cell.selected.top {
      border-top: 2px solid var(--tbw-range-border-color);
    }
    :host .data-grid-row > .cell.selected.bottom {
      border-bottom: 2px solid var(--tbw-range-border-color);
    }
    :host .data-grid-row > .cell.selected.first {
      border-left: 2px solid var(--tbw-range-border-color);
    }
    :host .data-grid-row > .cell.selected.last {
      border-right: 2px solid var(--tbw-range-border-color);
    }
  `;
}

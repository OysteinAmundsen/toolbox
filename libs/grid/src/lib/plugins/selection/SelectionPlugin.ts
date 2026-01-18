/**
 * Selection Plugin (Class-based)
 *
 * Provides selection functionality for tbw-grid.
 * Supports three modes:
 * - 'cell': Single cell selection (default). No border, just focus highlight.
 * - 'row': Row selection. Clicking a cell selects the entire row.
 * - 'range': Range selection. Shift+click or drag to select rectangular cell ranges.
 */

import { clearCellFocus, getRowIndexFromCell } from '../../core/internal/utils';
import { BaseGridPlugin, CellClickEvent, CellMouseEvent } from '../../core/plugin/base-plugin';
import { isUtilityColumn } from '../../core/plugin/expander-column';
import {
  createRangeFromAnchor,
  getAllCellsInRanges,
  isCellInAnyRange,
  normalizeRange,
  toPublicRanges,
} from './range-selection';
import styles from './selection.css?inline';
import type {
  CellRange,
  InternalCellRange,
  SelectionChangeDetail,
  SelectionConfig,
  SelectionMode,
  SelectionResult,
} from './types';

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
  colCount: number,
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
  override readonly styles = styles;

  protected override get defaultConfig(): Partial<SelectionConfig> {
    return {
      mode: 'cell',
    };
  }

  // #region Internal State
  /** Row selection state (row mode) */
  private selected = new Set<number>();
  private lastSelected: number | null = null;
  private anchor: number | null = null;

  /** Range selection state (range mode) */
  private ranges: InternalCellRange[] = [];
  private activeRange: InternalCellRange | null = null;
  private cellAnchor: { row: number; col: number } | null = null;
  private isDragging = false;

  /** Pending keyboard navigation update (processed in afterRender) */
  private pendingKeyboardUpdate: { shiftKey: boolean } | null = null;

  /** Cell selection state (cell mode) */
  private selectedCell: { row: number; col: number } | null = null;

  // #endregion

  // #region Lifecycle

  override detach(): void {
    this.selected.clear();
    this.ranges = [];
    this.activeRange = null;
    this.cellAnchor = null;
    this.isDragging = false;
    this.selectedCell = null;
    this.pendingKeyboardUpdate = null;
  }

  // #endregion

  // #region Event Handlers

  override onCellClick(event: CellClickEvent): boolean {
    const { rowIndex, colIndex, originalEvent } = event;
    const { mode } = this.config;

    // Check if this is a utility column (expander columns, etc.)
    const column = this.columns[colIndex];
    const isUtility = column && isUtilityColumn(column);

    // CELL MODE: Single cell selection - skip utility columns
    if (mode === 'cell') {
      if (isUtility) {
        return false; // Allow event to propagate, but don't select utility cells
      }
      this.selectedCell = { row: rowIndex, col: colIndex };
      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // ROW MODE: Select entire row - utility column clicks still select the row
    if (mode === 'row') {
      this.selected.clear();
      this.selected.add(rowIndex);
      this.lastSelected = rowIndex;

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
      this.requestAfterRender();
      return false;
    }

    // RANGE MODE: Shift+click extends selection, click starts new
    if (mode === 'range') {
      // Skip utility columns in range mode - don't start selection from them
      if (isUtility) {
        return false;
      }

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
    const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'PageUp', 'PageDown'];
    const isNavKey = navKeys.includes(event.key);

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

    // CELL MODE: Selection follows focus
    if (mode === 'cell' && isNavKey) {
      // Use queueMicrotask so grid's handler runs first and updates focusRow/focusCol
      queueMicrotask(() => {
        this.selectedCell = { row: this.grid._focusRow, col: this.grid._focusCol };
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
      });
      return false; // Let grid handle navigation
    }

    // ROW MODE: Only Up/Down arrows move row selection
    if (mode === 'row' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      // Let grid move focus first, then sync row selection
      queueMicrotask(() => {
        this.selected.clear();
        this.selected.add(this.grid._focusRow);
        this.lastSelected = this.grid._focusRow;
        this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
        this.requestAfterRender();
      });
      return false; // Let grid handle navigation
    }

    // RANGE MODE: Shift+Arrow extends, plain Arrow resets
    // Tab key always navigates without extending (even with Shift)
    if (mode === 'range' && isNavKey) {
      // Tab should not extend selection - it just navigates to the next/previous cell
      const isTabKey = event.key === 'Tab';
      const shouldExtend = event.shiftKey && !isTabKey;

      // Capture anchor BEFORE grid moves focus (synchronous)
      // This ensures the anchor is the starting point, not the destination
      if (shouldExtend && !this.cellAnchor) {
        this.cellAnchor = { row: this.grid._focusRow, col: this.grid._focusCol };
      }

      // Mark pending update - will be processed in afterRender when grid updates focus
      this.pendingKeyboardUpdate = { shiftKey: shouldExtend };

      // Schedule afterRender to run after grid's keyboard handler completes
      // Grid's refreshVirtualWindow(false) skips afterRender for performance,
      // so we explicitly request it to process pendingKeyboardUpdate
      queueMicrotask(() => this.requestAfterRender());

      return false; // Let grid handle navigation
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

    // Skip utility columns (expander columns, etc.)
    const column = this.columns[event.colIndex];
    if (column && isUtilityColumn(column)) {
      return; // Don't start selection on utility columns
    }

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

    // When dragging, clamp to first data column (skip utility columns)
    let targetCol = event.colIndex;
    const column = this.columns[targetCol];
    if (column && isUtilityColumn(column)) {
      // Find the first non-utility column
      const firstDataCol = this.columns.findIndex((col) => !isUtilityColumn(col));
      if (firstDataCol >= 0) {
        targetCol = firstDataCol;
      }
    }

    const newRange = createRangeFromAnchor(this.cellAnchor, { row: event.rowIndex, col: targetCol });

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
   * Apply selection classes to visible cells/rows.
   * Shared by afterRender and onScrollRender.
   */
  #applySelectionClasses(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const { mode } = this.config;

    // Clear all selection classes first
    const allCells = gridEl.querySelectorAll('.cell');
    allCells.forEach((cell) => {
      cell.classList.remove('selected', 'top', 'bottom', 'first', 'last');
    });

    const allRows = gridEl.querySelectorAll('.data-grid-row');
    allRows.forEach((row) => {
      row.classList.remove('selected', 'row-focus');
    });

    // ROW MODE: Add row-focus class to selected rows, disable cell-focus
    if (mode === 'row') {
      // In row mode, disable ALL cell-focus styling - row selection takes precedence
      clearCellFocus(gridEl);

      allRows.forEach((row) => {
        const firstCell = row.querySelector('.cell[data-row]');
        const rowIndex = getRowIndexFromCell(firstCell);
        if (rowIndex >= 0 && this.selected.has(rowIndex)) {
          row.classList.add('selected', 'row-focus');
        }
      });
    }

    // RANGE MODE: Add selected and edge classes to cells
    if (mode === 'range' && this.ranges.length > 0) {
      // Clear all cell-focus first - selection plugin manages focus styling in range mode
      clearCellFocus(gridEl);

      const normalized = this.activeRange ? normalizeRange(this.activeRange) : null;

      // Find the first non-utility column index for proper .first class application
      const firstDataColIndex = this.columns.findIndex((col) => !isUtilityColumn(col));
      const lastDataColIndex = this.columns.length - 1; // Last column is always data

      const cells = gridEl.querySelectorAll('.cell[data-row][data-col]');
      cells.forEach((cell) => {
        const rowIndex = parseInt(cell.getAttribute('data-row') ?? '-1', 10);
        const colIndex = parseInt(cell.getAttribute('data-col') ?? '-1', 10);
        if (rowIndex >= 0 && colIndex >= 0) {
          // Skip utility columns entirely - don't add any selection classes
          const column = this.columns[colIndex];
          if (column && isUtilityColumn(column)) {
            return;
          }

          const inRange = isCellInAnyRange(rowIndex, colIndex, this.ranges);

          if (inRange) {
            cell.classList.add('selected');

            if (normalized) {
              if (rowIndex === normalized.startRow) cell.classList.add('top');
              if (rowIndex === normalized.endRow) cell.classList.add('bottom');
              // Apply .first to the first data column in range (skip utility columns)
              const effectiveStartCol = Math.max(normalized.startCol, firstDataColIndex);
              if (colIndex === effectiveStartCol) cell.classList.add('first');
              if (colIndex === normalized.endCol) cell.classList.add('last');
            }
          }
        }
      });
    }

    // CELL MODE: Let the grid's native .cell-focus styling handle cell highlighting
    // No additional action needed - the grid already manages focus styling
  }

  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const container = gridEl.children[0];
    const { mode } = this.config;

    // Process pending keyboard navigation update (range mode)
    // This runs AFTER the grid has updated focusRow/focusCol
    if (this.pendingKeyboardUpdate && mode === 'range') {
      const { shiftKey } = this.pendingKeyboardUpdate;
      this.pendingKeyboardUpdate = null;

      const currentRow = this.grid._focusRow;
      const currentCol = this.grid._focusCol;

      if (shiftKey && this.cellAnchor) {
        // Extend selection from anchor to current focus
        const newRange = createRangeFromAnchor(this.cellAnchor, { row: currentRow, col: currentCol });
        this.ranges = [newRange];
        this.activeRange = newRange;
      } else if (!shiftKey) {
        // Without shift, clear selection (cell-focus will show instead)
        this.ranges = [];
        this.activeRange = null;
        this.cellAnchor = { row: currentRow, col: currentCol }; // Reset anchor to current position
      }

      this.emit<SelectionChangeDetail>('selection-change', this.#buildEvent());
    }

    // Set data attribute on host for CSS variable scoping
    (this.grid as unknown as Element).setAttribute('data-selection-mode', mode);

    // Toggle .selecting class during drag to prevent text selection
    if (container) {
      container.classList.toggle('selecting', this.isDragging);
    }

    this.#applySelectionClasses();
  }

  /**
   * Called after scroll-triggered row rendering.
   * Reapplies selection classes to recycled DOM elements.
   */
  override onScrollRender(): void {
    this.#applySelectionClasses();
  }

  // #endregion

  // #region Public API

  /**
   * Get the current selection as a unified result.
   * Works for all selection modes and always returns ranges.
   *
   * @example
   * ```ts
   * const selection = plugin.getSelection();
   * if (selection.ranges.length > 0) {
   *   const { from, to } = selection.ranges[0];
   *   // For cell mode: from === to (single cell)
   *   // For row mode: from.col = 0, to.col = lastCol (full row)
   *   // For range mode: rectangular selection
   * }
   * ```
   */
  getSelection(): SelectionResult {
    return {
      mode: this.config.mode,
      ranges: this.#buildEvent().ranges,
      anchor: this.cellAnchor,
    };
  }

  /**
   * Get the selected cell (cell mode only).
   * @deprecated Use `getSelection()` instead for a unified API across all modes.
   */
  getSelectedCell(): { row: number; col: number } | null {
    const { mode, ranges } = this.getSelection();
    if (mode === 'cell' && ranges.length > 0) {
      return ranges[0].from;
    }
    return null;
  }

  /**
   * Get all selected row indices (row mode).
   * @deprecated Use `getSelection().ranges` instead - each range represents a full row.
   */
  getSelectedRows(): number[] {
    const { mode, ranges } = this.getSelection();
    if (mode === 'row') {
      return ranges.map((r) => r.from.row);
    }
    return [];
  }

  /**
   * Get all selected cell ranges in public format.
   * @deprecated Use `getSelection().ranges` instead.
   */
  getRanges(): CellRange[] {
    return this.getSelection().ranges;
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

  // #endregion

  // #region Private Helpers

  #buildEvent(): SelectionChangeDetail {
    return buildSelectionEvent(
      this.config.mode,
      {
        selectedCell: this.selectedCell,
        selected: this.selected,
        ranges: this.ranges,
      },
      this.columns.length,
    );
  }

  // #endregion
}

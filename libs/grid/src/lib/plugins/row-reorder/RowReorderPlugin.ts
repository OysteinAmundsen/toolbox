/**
 * Row Reordering Plugin
 *
 * Provides keyboard and drag-drop row reordering functionality for tbw-grid.
 * Supports Ctrl+Up/Down keyboard shortcuts and optional drag handle column.
 */

import { ensureCellVisible } from '../../core/internal/keyboard';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig, InternalGrid } from '../../core/types';
import styles from './row-reorder.css?inline';
import type { PendingMove, RowMoveDetail, RowReorderConfig } from './types';

/** Field name for the drag handle column */
export const ROW_DRAG_HANDLE_FIELD = '__tbw_row_drag';

/**
 * Row Reorder Plugin for tbw-grid
 *
 * Enables row reordering via keyboard shortcuts (Ctrl+Up/Down) and drag-drop.
 * Supports validation callbacks and debounced keyboard moves.
 *
 * ## Installation
 *
 * ```ts
 * import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `enableKeyboard` | `boolean` | `true` | Enable Ctrl+Up/Down shortcuts |
 * | `showDragHandle` | `boolean` | `true` | Show drag handle column |
 * | `dragHandlePosition` | `'left' \| 'right'` | `'left'` | Drag handle column position |
 * | `dragHandleWidth` | `number` | `40` | Drag handle column width |
 * | `canMove` | `function` | - | Validation callback |
 * | `debounceMs` | `number` | `300` | Debounce time for keyboard moves |
 * | `animation` | `false \| 'flip'` | `'flip'` | Animation for row moves |
 *
 * ## Keyboard Shortcuts
 *
 * | Key | Action |
 * |-----|--------|
 * | `Ctrl + ↑` | Move focused row up |
 * | `Ctrl + ↓` | Move focused row down |
 *
 * ## Events
 *
 * | Event | Detail | Cancelable | Description |
 * |-------|--------|------------|-------------|
 * | `row-move` | `RowMoveDetail` | Yes | Fired when a row move is attempted |
 *
 * @example Basic Row Reordering
 * ```ts
 * import '@toolbox-web/grid';
 * import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID' },
 *     { field: 'name', header: 'Name' },
 *   ],
 *   plugins: [new RowReorderPlugin()],
 * };
 *
 * grid.addEventListener('row-move', (e) => {
 *   console.log('Row moved from', e.detail.fromIndex, 'to', e.detail.toIndex);
 * });
 * ```
 *
 * @example With Validation
 * ```ts
 * new RowReorderPlugin({
 *   canMove: (row, fromIndex, toIndex, direction) => {
 *     // Prevent moving locked rows
 *     return !row.locked;
 *   },
 * })
 * ```
 *
 * @see {@link RowReorderConfig} for all configuration options
 * @see {@link RowMoveDetail} for the event detail structure
 */
export class RowReorderPlugin extends BaseGridPlugin<RowReorderConfig> {
  /** @internal */
  readonly name = 'rowReorder';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<RowReorderConfig> {
    return {
      enableKeyboard: true,
      showDragHandle: true,
      dragHandlePosition: 'left',
      dragHandleWidth: 40,
      debounceMs: 150,
      animation: 'flip',
    };
  }

  /**
   * Resolve animation type from plugin config.
   * Uses base class isAnimationEnabled to respect grid-level settings.
   */
  private get animationType(): false | 'flip' {
    // Check if animations are globally disabled
    if (!this.isAnimationEnabled) return false;

    // Plugin config (with default from defaultConfig)
    if (this.config.animation !== undefined) return this.config.animation;

    return 'flip'; // Plugin default
  }

  // #region Internal State
  private isDragging = false;
  private draggedRowIndex: number | null = null;
  private dropRowIndex: number | null = null;
  private pendingMove: PendingMove | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Column index to use when flushing pending move */
  private lastFocusCol = 0;
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.clearDebounceTimer();
    this.isDragging = false;
    this.draggedRowIndex = null;
    this.dropRowIndex = null;
    this.pendingMove = null;
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.config.showDragHandle) {
      return [...columns];
    }

    const dragHandleColumn: ColumnConfig = {
      field: ROW_DRAG_HANDLE_FIELD,
      header: '',
      width: this.config.dragHandleWidth ?? 40,
      resizable: false,
      sortable: false,
      filterable: false,
      meta: {
        lockPosition: true,
        suppressMovable: true,
        utility: true,
      },
      viewRenderer: () => {
        const container = document.createElement('div');
        container.className = 'dg-row-drag-handle';
        container.setAttribute('aria-label', 'Drag to reorder');
        container.setAttribute('role', 'button');
        container.setAttribute('tabindex', '-1');
        // Set draggable as property (not just attribute) for proper HTML5 drag-drop
        container.draggable = true;

        // Use the grid's configured dragHandle icon
        this.setIcon(container, this.resolveIcon('dragHandle'));

        return container;
      },
    };

    // Position the drag handle column
    if (this.config.dragHandlePosition === 'right') {
      return [...columns, dragHandleColumn];
    }
    return [dragHandleColumn, ...columns];
  }

  /** @internal */
  override afterRender(): void {
    if (!this.config.showDragHandle) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Set up drag start/end listeners on drag handles
    const handles = gridEl.querySelectorAll('.dg-row-drag-handle');
    handles.forEach((handle) => {
      const handleEl = handle as HTMLElement;
      if (handleEl.getAttribute('data-drag-bound')) return;
      handleEl.setAttribute('data-drag-bound', 'true');

      const rowEl = handleEl.closest('.data-grid-row') as HTMLElement;
      if (!rowEl) return;

      // Set up dragstart/dragend on the handle
      this.setupHandleDragListeners(handleEl, rowEl);
    });

    // Set up drop target listeners on ALL rows (not just the handle's row)
    const rows = gridEl.querySelectorAll('.data-grid-row');
    rows.forEach((row) => {
      const rowEl = row as HTMLElement;
      if (rowEl.getAttribute('data-drop-bound')) return;
      rowEl.setAttribute('data-drop-bound', 'true');

      this.setupRowDropListeners(rowEl);
    });
  }

  /**
   * Handle Ctrl+Arrow keyboard shortcuts for row reordering.
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    if (!this.config.enableKeyboard) return;
    if (!event.ctrlKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) {
      return;
    }

    const grid = this.grid as unknown as InternalGrid;
    const focusRow = grid._focusRow;
    // Use _rows (current visual state) for keyboard moves, not sourceRows
    // This ensures rapid moves work correctly since we update _rows directly
    // Fallback to sourceRows for compatibility with tests
    const rows = grid._rows ?? this.sourceRows;

    if (focusRow < 0 || focusRow >= rows.length) return;

    const direction = event.key === 'ArrowUp' ? 'up' : 'down';
    const toIndex = direction === 'up' ? focusRow - 1 : focusRow + 1;

    // Check bounds
    if (toIndex < 0 || toIndex >= rows.length) return;

    const row = rows[focusRow];

    // Validate move
    if (this.config.canMove && !this.config.canMove(row, focusRow, toIndex, direction)) {
      return;
    }

    // Debounce keyboard moves
    this.handleKeyboardMove(row, focusRow, toIndex, direction, grid._focusCol);

    event.preventDefault();
    event.stopPropagation();
    return true;
  }

  /**
   * Flush pending keyboard moves when user clicks a cell.
   * This commits the move immediately so focus works correctly.
   * @internal
   */
  override onCellClick(): void {
    // If there's a pending keyboard move, flush it immediately
    // so the user's click focus isn't overridden
    this.flushPendingMove();
  }
  // #endregion

  // #region Public API

  /**
   * Move a row to a new position programmatically.
   * @param fromIndex - Current index of the row
   * @param toIndex - Target index
   */
  moveRow(fromIndex: number, toIndex: number): void {
    const rows = [...this.sourceRows];
    if (fromIndex < 0 || fromIndex >= rows.length) return;
    if (toIndex < 0 || toIndex >= rows.length) return;
    if (fromIndex === toIndex) return;

    const direction = toIndex < fromIndex ? 'up' : 'down';
    const row = rows[fromIndex];

    // Validate move
    if (this.config.canMove && !this.config.canMove(row, fromIndex, toIndex, direction)) {
      return;
    }

    this.executeMove(row, fromIndex, toIndex, 'keyboard');
  }

  /**
   * Check if a row can be moved to a position.
   * @param fromIndex - Current index of the row
   * @param toIndex - Target index
   */
  canMoveRow(fromIndex: number, toIndex: number): boolean {
    const rows = this.sourceRows;
    if (fromIndex < 0 || fromIndex >= rows.length) return false;
    if (toIndex < 0 || toIndex >= rows.length) return false;
    if (fromIndex === toIndex) return false;

    if (!this.config.canMove) return true;

    const direction = toIndex < fromIndex ? 'up' : 'down';
    return this.config.canMove(rows[fromIndex], fromIndex, toIndex, direction);
  }
  // #endregion

  // #region Private Methods

  /**
   * Set up drag start/end listeners on the drag handle element.
   */
  private setupHandleDragListeners(handleEl: HTMLElement, rowEl: HTMLElement): void {
    handleEl.addEventListener('dragstart', (e: DragEvent) => {
      const rowIndex = this.getRowIndex(rowEl);
      if (rowIndex < 0) return;

      this.isDragging = true;
      this.draggedRowIndex = rowIndex;

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(rowIndex));
      }

      rowEl.classList.add('dragging');
    });

    handleEl.addEventListener('dragend', () => {
      this.isDragging = false;
      this.draggedRowIndex = null;
      this.dropRowIndex = null;
      this.clearDragClasses();
    });
  }

  /**
   * Set up drop target listeners on a row element.
   * All rows are valid drop targets during drag operations.
   */
  private setupRowDropListeners(rowEl: HTMLElement): void {
    rowEl.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      if (!this.isDragging || this.draggedRowIndex === null) return;

      const targetIndex = this.getRowIndex(rowEl);
      if (targetIndex < 0 || targetIndex === this.draggedRowIndex) return;

      const rect = rowEl.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const isBefore = e.clientY < midY;

      this.dropRowIndex = isBefore ? targetIndex : targetIndex + 1;

      rowEl.classList.add('drop-target');
      rowEl.classList.toggle('drop-before', isBefore);
      rowEl.classList.toggle('drop-after', !isBefore);
    });

    rowEl.addEventListener('dragleave', () => {
      rowEl.classList.remove('drop-target', 'drop-before', 'drop-after');
    });

    rowEl.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      const fromIndex = this.draggedRowIndex;
      let toIndex = this.dropRowIndex;

      if (!this.isDragging || fromIndex === null || toIndex === null) {
        return;
      }

      // Adjust toIndex if dropping after the dragged row
      if (toIndex > fromIndex) {
        toIndex--;
      }

      if (fromIndex !== toIndex) {
        const rows = this.sourceRows;
        const row = rows[fromIndex];
        const direction = toIndex < fromIndex ? 'up' : 'down';

        // Validate move
        if (!this.config.canMove || this.config.canMove(row, fromIndex, toIndex, direction)) {
          this.executeMove(row, fromIndex, toIndex, 'drag');
        }
      }
    });
  }

  /**
   * Handle debounced keyboard moves.
   * Rows move immediately for visual feedback, but the event emission is debounced.
   */
  private handleKeyboardMove(
    row: unknown,
    fromIndex: number,
    toIndex: number,
    direction: 'up' | 'down',
    focusCol: number,
  ): void {
    // Track move for debounced event emission
    if (!this.pendingMove) {
      this.pendingMove = {
        originalIndex: fromIndex,
        currentIndex: toIndex,
        row,
      };
    } else {
      // Update the current index for rapid moves
      this.pendingMove.currentIndex = toIndex;
    }

    // Store focus column for flush
    this.lastFocusCol = focusCol;

    // Move rows immediately for visual feedback
    // Use _rows (current visual state) for rapid moves, not sourceRows
    // Fallback to sourceRows for compatibility with tests
    const grid = this.grid as unknown as InternalGrid;
    const rows = [...(grid._rows ?? this.sourceRows)];
    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);

    // Update grid rows immediately (without triggering change events)
    grid._rows = rows;

    // Update focus to follow the row
    grid._focusRow = toIndex;
    grid._focusCol = focusCol;

    // Refresh virtual window directly - this re-renders from _rows
    // without overwriting _rows from #rows (which requestRender does)
    grid.refreshVirtualWindow(true);

    // Ensure focus styling is applied after the row rebuild
    ensureCellVisible(grid);

    // Debounce the event emission only
    this.clearDebounceTimer();
    this.debounceTimer = setTimeout(() => {
      this.flushPendingMove();
    }, this.config.debounceMs ?? 300);
  }

  /**
   * Flush the pending move by emitting the event.
   * Called when debounce timer fires or user clicks elsewhere.
   */
  private flushPendingMove(): void {
    this.clearDebounceTimer();

    if (!this.pendingMove) return;

    const { originalIndex, currentIndex, row: movedRow } = this.pendingMove;
    this.pendingMove = null;

    if (originalIndex === currentIndex) return;

    // Emit cancelable event
    const detail: RowMoveDetail = {
      row: movedRow,
      fromIndex: originalIndex,
      toIndex: currentIndex,
      rows: [...this.sourceRows],
      source: 'keyboard',
    };

    const cancelled = this.emitCancelable('row-move', detail);
    if (cancelled) {
      // Revert to original position
      const rows = [...this.sourceRows];
      const [row] = rows.splice(currentIndex, 1);
      rows.splice(originalIndex, 0, row);

      const grid = this.grid as unknown as InternalGrid;
      grid._rows = rows;
      grid._focusRow = originalIndex;
      grid._focusCol = this.lastFocusCol;
      grid.refreshVirtualWindow(true);
      ensureCellVisible(grid);
    }
  }

  /**
   * Execute a row move and emit the event.
   */
  private executeMove(row: unknown, fromIndex: number, toIndex: number, source: 'keyboard' | 'drag'): void {
    const rows = [...this.sourceRows];
    const [movedRow] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, movedRow);

    const detail: RowMoveDetail = {
      row,
      fromIndex,
      toIndex,
      rows,
      source,
    };

    // Emit cancelable event
    const cancelled = this.emitCancelable('row-move', detail);
    if (!cancelled) {
      // Apply with animation if enabled
      if (this.animationType === 'flip' && this.gridElement) {
        const oldPositions = this.captureRowPositions();
        this.grid.rows = rows;
        // Wait for the scheduler to process the virtual window update (RAF)
        // before running FLIP animation on the new rows
        requestAnimationFrame(() => {
          void this.gridElement.offsetHeight;
          this.animateFLIP(oldPositions, fromIndex, toIndex);
        });
      } else {
        // No animation, just update rows
        this.grid.rows = rows;
      }
    }
  }

  /**
   * Capture row positions before reorder.
   * Maps visual row index to its top position.
   */
  private captureRowPositions(): Map<number, number> {
    const positions = new Map<number, number>();
    this.gridElement?.querySelectorAll('.data-grid-row').forEach((row) => {
      const rowIndex = this.getRowIndex(row as HTMLElement);
      if (rowIndex >= 0) {
        positions.set(rowIndex, row.getBoundingClientRect().top);
      }
    });
    return positions;
  }

  /**
   * Apply FLIP animation for row reorder.
   * Uses CSS transitions - JS sets initial transform and toggles class.
   * @param oldPositions - Row positions captured before DOM change
   * @param fromIndex - Original index of moved row
   * @param toIndex - New index of moved row
   */
  private animateFLIP(oldPositions: Map<number, number>, fromIndex: number, toIndex: number): void {
    const gridEl = this.gridElement;
    if (!gridEl || oldPositions.size === 0) return;

    // Calculate which row indices were affected and their new positions
    const minIndex = Math.min(fromIndex, toIndex);
    const maxIndex = Math.max(fromIndex, toIndex);

    // Build a map of new row index -> delta Y
    const rowsToAnimate: { el: HTMLElement; deltaY: number }[] = [];

    gridEl.querySelectorAll('.data-grid-row').forEach((row) => {
      const rowEl = row as HTMLElement;
      const newRowIndex = this.getRowIndex(rowEl);
      if (newRowIndex < 0 || newRowIndex < minIndex || newRowIndex > maxIndex) return;

      // Figure out what this row's old index was
      let oldIndex: number;
      if (newRowIndex === toIndex) {
        // This is the moved row
        oldIndex = fromIndex;
      } else if (fromIndex < toIndex) {
        // Row moved down: rows in between shifted up by 1
        oldIndex = newRowIndex + 1;
      } else {
        // Row moved up: rows in between shifted down by 1
        oldIndex = newRowIndex - 1;
      }

      const oldTop = oldPositions.get(oldIndex);
      if (oldTop === undefined) return;

      const newTop = rowEl.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;

      if (Math.abs(deltaY) > 1) {
        rowsToAnimate.push({ el: rowEl, deltaY });
      }
    });

    if (rowsToAnimate.length === 0) return;

    // Set initial transform (First → Last position offset)
    rowsToAnimate.forEach(({ el, deltaY }) => {
      el.style.transform = `translateY(${deltaY}px)`;
    });

    // Force reflow then animate to final position via CSS transition
    void gridEl.offsetHeight;

    const duration = this.animationDuration;

    requestAnimationFrame(() => {
      rowsToAnimate.forEach(({ el }) => {
        el.classList.add('flip-animating');
        el.style.transform = '';
      });

      // Cleanup after animation
      setTimeout(() => {
        rowsToAnimate.forEach(({ el }) => {
          el.style.transform = '';
          el.classList.remove('flip-animating');
        });
      }, duration + 50);
    });
  }

  /**
   * Get the row index from a row element by checking data-row attribute on cells.
   * This is consistent with how other plugins retrieve row indices.
   */
  private getRowIndex(rowEl: HTMLElement): number {
    const cell = rowEl.querySelector('.cell[data-row]');
    return cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
  }

  /**
   * Clear all drag-related classes from rows.
   */
  private clearDragClasses(): void {
    this.gridElement?.querySelectorAll('.data-grid-row').forEach((row) => {
      row.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
    });
  }

  /**
   * Clear the debounce timer.
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
  // #endregion
}

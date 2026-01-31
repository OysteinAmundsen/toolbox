/**
 * Column Reordering Plugin (Class-based)
 *
 * Provides drag-and-drop column reordering functionality for tbw-grid.
 * Supports keyboard and mouse interactions with visual feedback.
 * Uses FLIP animation technique for smooth column transitions.
 *
 * Animation respects grid-level animation.mode setting but style is plugin-configured.
 */

import { ensureCellVisible } from '../../core/internal/keyboard';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig, InternalGrid } from '../../core/types';
import { canMoveColumn, moveColumn } from './column-drag';
import styles from './reorder.css?inline';
import type { ColumnMoveDetail, ReorderConfig } from './types';

/**
 * Column Reorder Plugin for tbw-grid
 *
 * Lets users rearrange columns by dragging and dropping column headers. Supports smooth
 * FLIP animations, fade transitions, or instant reordering. Animation respects the
 * grid-level `animation.mode` setting.
 *
 * ## Installation
 *
 * ```ts
 * import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `animation` | `false \| 'flip' \| 'fade'` | `'flip'` | Animation type for column moves |
 * | `animationDuration` | `number` | `200` | Animation duration in ms |
 *
 * ## Keyboard Shortcuts
 *
 * | Key | Action |
 * |-----|--------|
 * | `Alt + ←` | Move focused column left |
 * | `Alt + →` | Move focused column right |
 *
 * ## Events
 *
 * | Event | Detail | Cancelable | Description |
 * |-------|--------|------------|-------------|
 * | `column-move` | `{ field, fromIndex, toIndex, columnOrder }` | Yes | Fired when a column move is attempted |
 *
 * @example Basic Drag-and-Drop Reordering
 * ```ts
 * import '@toolbox-web/grid';
 * import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'id', header: 'ID' },
 *     { field: 'name', header: 'Name' },
 *     { field: 'email', header: 'Email' },
 *   ],
 *   plugins: [new ReorderPlugin({ animation: 'flip', animationDuration: 200 })],
 * };
 *
 * // Persist column order
 * grid.addEventListener('column-move', (e) => {
 *   localStorage.setItem('columnOrder', JSON.stringify(e.detail.columnOrder));
 * });
 * ```
 *
 * @example Prevent Moves That Break Group Boundaries
 * ```ts
 * grid.addEventListener('column-move', (e) => {
 *   if (!isValidMoveWithinGroup(e.detail.field, e.detail.fromIndex, e.detail.toIndex)) {
 *     e.preventDefault(); // Column snaps back to original position
 *   }
 * });
 * ```
 *
 * @see {@link ReorderConfig} for all configuration options
 * @see {@link ColumnMoveDetail} for the event detail structure
 * @see {@link GroupingColumnsPlugin} for column group integration
 *
 * @internal Extends BaseGridPlugin
 */
export class ReorderPlugin extends BaseGridPlugin<ReorderConfig> {
  /** @internal */
  readonly name = 'reorder';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<ReorderConfig> {
    return {
      animation: 'flip', // Plugin's own default
    };
  }

  /**
   * Resolve animation type from plugin config.
   * Uses base class isAnimationEnabled to respect grid-level settings.
   */
  private get animationType(): false | 'flip' | 'fade' {
    // Check if animations are globally disabled
    if (!this.isAnimationEnabled) return false;

    // Plugin config (with default from defaultConfig)
    if (this.config.animation !== undefined) return this.config.animation;

    return 'flip'; // Plugin default
  }

  /**
   * Get animation duration, allowing plugin config override.
   * Uses base class animationDuration for default.
   */
  protected override get animationDuration(): number {
    // Plugin config override
    if (this.config.animationDuration !== undefined) {
      return this.config.animationDuration;
    }
    return super.animationDuration;
  }

  // #region Internal State
  private isDragging = false;
  private draggedField: string | null = null;
  private draggedIndex: number | null = null;
  private dropIndex: number | null = null;

  /**
   * Check if a column can be moved, considering both column config and plugin queries.
   */
  private canMoveColumnWithPlugins(column: ColumnConfig | undefined): boolean {
    if (!column || !canMoveColumn(column)) return false;
    // Query plugins that respond to 'canMoveColumn' (e.g., PinnedColumnsPlugin)
    const responses = this.grid.query<boolean>('canMoveColumn', column);
    return !responses.includes(false);
  }

  /**
   * Clear all drag-related classes from header cells.
   */
  private clearDragClasses(): void {
    this.gridElement?.querySelectorAll('.header-row > .cell').forEach((h) => {
      h.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
    });
  }
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Listen for reorder requests from other plugins (e.g., VisibilityPlugin)
    // Uses disconnectSignal for automatic cleanup - no need for manual removeEventListener
    (grid as unknown as HTMLElement).addEventListener(
      'column-reorder-request',
      (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail?.field && typeof detail.toIndex === 'number') {
          this.moveColumn(detail.field, detail.toIndex);
        }
      },
      { signal: this.disconnectSignal },
    );
  }

  /** @internal */
  override detach(): void {
    this.isDragging = false;
    this.draggedField = null;
    this.draggedIndex = null;
    this.dropIndex = null;
  }
  // #endregion

  // #region Hooks

  /** @internal */
  override afterRender(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    const headers = gridEl.querySelectorAll('.header-row > .cell');

    headers.forEach((header) => {
      const headerEl = header as HTMLElement;
      const field = headerEl.getAttribute('data-field');
      if (!field) return;

      const column = this.columns.find((c) => c.field === field);
      if (!this.canMoveColumnWithPlugins(column)) {
        headerEl.draggable = false;
        return;
      }

      headerEl.draggable = true;

      // Remove existing listeners to prevent duplicates
      if (headerEl.getAttribute('data-dragstart-bound')) return;
      headerEl.setAttribute('data-dragstart-bound', 'true');

      headerEl.addEventListener('dragstart', (e: DragEvent) => {
        const currentOrder = this.getColumnOrder();
        const orderIndex = currentOrder.indexOf(field);
        this.isDragging = true;
        this.draggedField = field;
        this.draggedIndex = orderIndex;

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', field);
        }

        headerEl.classList.add('dragging');
      });

      headerEl.addEventListener('dragend', () => {
        this.isDragging = false;
        this.draggedField = null;
        this.draggedIndex = null;
        this.dropIndex = null;
        this.clearDragClasses();
      });

      headerEl.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (!this.isDragging || this.draggedField === field) return;

        const rect = headerEl.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;

        const currentOrder = this.getColumnOrder();
        const orderIndex = currentOrder.indexOf(field);
        this.dropIndex = e.clientX < midX ? orderIndex : orderIndex + 1;

        headerEl.classList.add('drop-target');
        headerEl.classList.toggle('drop-before', e.clientX < midX);
        headerEl.classList.toggle('drop-after', e.clientX >= midX);
      });

      headerEl.addEventListener('dragleave', () => {
        headerEl.classList.remove('drop-target', 'drop-before', 'drop-after');
      });

      headerEl.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        const draggedField = this.draggedField;
        const draggedIndex = this.draggedIndex;
        const dropIndex = this.dropIndex;

        if (!this.isDragging || draggedField === null || draggedIndex === null || dropIndex === null) {
          return;
        }

        const effectiveToIndex = dropIndex > draggedIndex ? dropIndex - 1 : dropIndex;
        const currentOrder = this.getColumnOrder();
        const newOrder = moveColumn(currentOrder, draggedIndex, effectiveToIndex);

        const detail: ColumnMoveDetail = {
          field: draggedField,
          fromIndex: draggedIndex,
          toIndex: effectiveToIndex,
          columnOrder: newOrder,
        };

        // Emit cancelable event first - only update if not cancelled
        const cancelled = this.emitCancelable('column-move', detail);
        if (!cancelled) {
          // Update the grid's column order (with optional view transition)
          this.updateColumnOrder(newOrder);
        }
      });
    });
  }

  /**
   * Handle Alt+Arrow keyboard shortcuts for column reordering.
   * @internal
   */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
      return;
    }

    const grid = this.grid as unknown as { _focusCol: number; _visibleColumns: ColumnConfig[] };
    const focusCol = grid._focusCol;
    const columns = grid._visibleColumns;

    if (focusCol < 0 || focusCol >= columns.length) return;

    const column = columns[focusCol];
    if (!this.canMoveColumnWithPlugins(column)) return;

    const currentOrder = this.getColumnOrder();
    const fromIndex = currentOrder.indexOf(column.field);
    if (fromIndex === -1) return;

    const toIndex = event.key === 'ArrowLeft' ? fromIndex - 1 : fromIndex + 1;

    // Check bounds
    if (toIndex < 0 || toIndex >= currentOrder.length) return;

    // Check if target position is allowed (e.g., not into pinned area)
    const targetColumn = columns.find((c) => c.field === currentOrder[toIndex]);
    if (!this.canMoveColumnWithPlugins(targetColumn)) return;

    this.moveColumn(column.field, toIndex);

    // Update focus to follow the moved column and refresh visual focus state
    grid._focusCol = toIndex;
    ensureCellVisible(this.grid as unknown as InternalGrid);

    event.preventDefault();
    event.stopPropagation();
    return true;
  }
  // #endregion

  // #region Public API

  /**
   * Get the current column order from the grid.
   * @returns Array of field names in display order
   */
  getColumnOrder(): string[] {
    return this.grid.getColumnOrder();
  }

  /**
   * Move a column to a new position.
   * @param field - The field name of the column to move
   * @param toIndex - The target index
   */
  moveColumn(field: string, toIndex: number): void {
    const currentOrder = this.getColumnOrder();
    const fromIndex = currentOrder.indexOf(field);
    if (fromIndex === -1) return;

    const newOrder = moveColumn(currentOrder, fromIndex, toIndex);

    // Emit cancelable event first - only update if not cancelled
    const cancelled = this.emitCancelable<ColumnMoveDetail>('column-move', {
      field,
      fromIndex,
      toIndex,
      columnOrder: newOrder,
    });
    if (!cancelled) {
      // Update with view transition
      this.updateColumnOrder(newOrder);
    }
  }

  /**
   * Set a specific column order.
   * @param order - Array of field names in desired order
   */
  setColumnOrder(order: string[]): void {
    this.updateColumnOrder(order);
  }

  /**
   * Reset column order to the original configuration order.
   */
  resetColumnOrder(): void {
    const originalOrder = this.columns.map((c) => c.field);
    this.updateColumnOrder(originalOrder);
  }
  // #endregion

  // #region View Transition

  /**
   * Capture header cell positions before reorder.
   */
  private captureHeaderPositions(): Map<string, number> {
    const positions = new Map<string, number>();
    this.gridElement?.querySelectorAll('.header-row > .cell[data-field]').forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (field) positions.set(field, cell.getBoundingClientRect().left);
    });
    return positions;
  }

  /**
   * Apply FLIP animation for column reorder.
   * Uses CSS transitions - JS sets initial transform and toggles class.
   * @param oldPositions - Header positions captured before DOM change
   */
  private animateFLIP(oldPositions: Map<string, number>): void {
    const gridEl = this.gridElement;
    if (!gridEl || oldPositions.size === 0) return;

    // Compute deltas from header cells (stable reference points)
    const deltas = new Map<string, number>();
    gridEl.querySelectorAll('.header-row > .cell[data-field]').forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (!field) return;
      const oldLeft = oldPositions.get(field);
      if (oldLeft === undefined) return;
      const deltaX = oldLeft - cell.getBoundingClientRect().left;
      if (Math.abs(deltaX) > 1) deltas.set(field, deltaX);
    });

    if (deltas.size === 0) return;

    // Set initial transform (First → Last position offset)
    const cells: HTMLElement[] = [];
    gridEl.querySelectorAll('.cell[data-field]').forEach((cell) => {
      const deltaX = deltas.get(cell.getAttribute('data-field') ?? '');
      if (deltaX !== undefined) {
        const el = cell as HTMLElement;
        el.style.transform = `translateX(${deltaX}px)`;
        cells.push(el);
      }
    });

    if (cells.length === 0) return;

    // Force reflow then animate to final position via CSS transition
    void this.gridElement.offsetHeight;

    const duration = this.animationDuration;

    requestAnimationFrame(() => {
      cells.forEach((el) => {
        el.classList.add('flip-animating');
        el.style.transform = '';
      });

      // Cleanup after animation
      setTimeout(() => {
        cells.forEach((el) => {
          el.style.transform = '';
          el.classList.remove('flip-animating');
        });
      }, duration + 50);
    });
  }

  /**
   * Apply crossfade animation for moved columns.
   * Uses CSS keyframes - JS just toggles classes.
   */
  private animateFade(applyChange: () => void): void {
    const gridEl = this.gridElement;
    if (!gridEl) {
      applyChange();
      return;
    }

    // Capture old positions to detect which columns moved
    const oldPositions = this.captureHeaderPositions();

    // Apply the change first
    applyChange();

    // Find which columns changed position
    const movedFields = new Set<string>();
    gridEl.querySelectorAll('.header-row > .cell[data-field]').forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (!field) return;
      const oldLeft = oldPositions.get(field);
      if (oldLeft === undefined) return;
      const newLeft = cell.getBoundingClientRect().left;
      if (Math.abs(oldLeft - newLeft) > 1) {
        movedFields.add(field);
      }
    });

    if (movedFields.size === 0) return;

    // Add animation class to moved columns (headers + body cells)
    const cells: HTMLElement[] = [];
    gridEl.querySelectorAll('.cell[data-field]').forEach((cell) => {
      const field = cell.getAttribute('data-field');
      if (field && movedFields.has(field)) {
        const el = cell as HTMLElement;
        el.classList.add('fade-animating');
        cells.push(el);
      }
    });

    if (cells.length === 0) return;

    // Remove class after animation completes
    const duration = this.animationDuration;
    setTimeout(() => {
      cells.forEach((el) => el.classList.remove('fade-animating'));
    }, duration + 50);
  }

  /**
   * Update column order with configured animation.
   */
  private updateColumnOrder(newOrder: string[]): void {
    const animation = this.animationType;

    if (animation === 'flip' && this.gridElement) {
      const oldPositions = this.captureHeaderPositions();
      this.grid.setColumnOrder(newOrder);
      // Wait for the scheduler to process the virtual window update (RAF)
      // before running FLIP animation on the new cells
      requestAnimationFrame(() => {
        void this.gridElement.offsetHeight;
        this.animateFLIP(oldPositions);
      });
    } else if (animation === 'fade') {
      this.animateFade(() => this.grid.setColumnOrder(newOrder));
    } else {
      this.grid.setColumnOrder(newOrder);
    }

    this.grid.requestStateChange?.();
  }
  // #endregion
}

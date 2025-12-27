/**
 * Column Reordering Plugin (Class-based)
 *
 * Provides drag-and-drop column reordering functionality for tbw-grid.
 * Supports keyboard and mouse interactions with visual feedback.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import { canMoveColumn, moveColumn } from './column-drag';
import type { ColumnMoveDetail, ReorderConfig } from './types';

/** Extended grid interface with column order methods */
interface GridWithColumnOrder {
  setColumnOrder(order: string[]): void;
  getColumnOrder(): string[];
  requestStateChange?: () => void;
}

/**
 * Column Reordering Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new ReorderPlugin({
 *   enabled: true,
 *   animation: true,
 *   animationDuration: 200,
 * })
 * ```
 */
export class ReorderPlugin extends BaseGridPlugin<ReorderConfig> {
  readonly name = 'reorder';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ReorderConfig> {
    return {
      enabled: true,
      animation: true,
      animationDuration: 200,
    };
  }

  // ===== Internal State =====
  private isDragging = false;
  private draggedField: string | null = null;
  private draggedIndex: number | null = null;
  private dropIndex: number | null = null;

  // ===== Lifecycle =====

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
      { signal: this.disconnectSignal }
    );
  }

  override detach(): void {
    // Event listeners using eventSignal are automatically cleaned up
    // Just reset internal state
    this.isDragging = false;
    this.draggedField = null;
    this.draggedIndex = null;
    this.dropIndex = null;
  }

  // ===== Hooks =====
  // Note: No processColumns hook needed - we directly update the grid's column order

  override afterRender(): void {
    if (!this.config.enabled) return;

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const headers = shadowRoot.querySelectorAll('.header-row > .cell');

    headers.forEach((header) => {
      const headerEl = header as HTMLElement;
      const field = headerEl.getAttribute('data-field');
      if (!field) return;

      const column = this.columns.find((c) => c.field === field);
      if (!column || !canMoveColumn(column)) {
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

        shadowRoot.querySelectorAll('.header-row > .cell').forEach((h) => {
          h.classList.remove('dragging', 'drop-target', 'drop-before', 'drop-after');
        });
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

        // Directly update the grid's column order
        (this.grid as unknown as GridWithColumnOrder).setColumnOrder(newOrder);

        this.emit('column-move', detail);
        // Trigger state change after reorder
        (this.grid as unknown as GridWithColumnOrder).requestStateChange?.();
      });
    });
  }

  // ===== Public API =====

  /**
   * Get the current column order from the grid.
   * @returns Array of field names in display order
   */
  getColumnOrder(): string[] {
    return (this.grid as unknown as GridWithColumnOrder).getColumnOrder();
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

    // Directly update the grid's column order
    (this.grid as unknown as GridWithColumnOrder).setColumnOrder(newOrder);

    this.emit<ColumnMoveDetail>('column-move', {
      field,
      fromIndex,
      toIndex,
      columnOrder: newOrder,
    });

    // Trigger state change after reorder
    (this.grid as unknown as GridWithColumnOrder).requestStateChange?.();
  }

  /**
   * Set a specific column order.
   * @param order - Array of field names in desired order
   */
  setColumnOrder(order: string[]): void {
    (this.grid as unknown as GridWithColumnOrder).setColumnOrder(order);
    // Trigger state change after reorder
    (this.grid as unknown as GridWithColumnOrder).requestStateChange?.();
  }

  /**
   * Reset column order to the original configuration order.
   */
  resetColumnOrder(): void {
    const originalOrder = this.columns.map((c) => c.field);
    (this.grid as unknown as GridWithColumnOrder).setColumnOrder(originalOrder);
    // Trigger state change after reset
    (this.grid as unknown as GridWithColumnOrder).requestStateChange?.();
  }

  // ===== Styles =====

  override readonly styles = `
    .header-row > .cell[draggable="true"] {
      cursor: grab;
      position: relative;
    }
    .header-row > .cell.dragging {
      opacity: 0.5;
      cursor: grabbing;
    }
    .header-row > .cell.drop-before::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--tbw-reorder-indicator, var(--tbw-color-accent));
      z-index: 1;
    }
    .header-row > .cell.drop-after::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--tbw-reorder-indicator, var(--tbw-color-accent));
      z-index: 1;
    }
  `;
}

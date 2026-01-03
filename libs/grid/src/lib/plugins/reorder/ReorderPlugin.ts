/**
 * Column Reordering Plugin (Class-based)
 *
 * Provides drag-and-drop column reordering functionality for tbw-grid.
 * Supports keyboard and mouse interactions with visual feedback.
 */

import { BaseGridPlugin, PLUGIN_QUERIES } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { canMoveColumn, moveColumn } from './column-drag';
import styles from './reorder.css?inline';
import type { ColumnMoveDetail, ReorderConfig } from './types';

/** Extended grid interface with column order methods */
interface GridWithColumnOrder {
  setColumnOrder(order: string[]): void;
  getColumnOrder(): string[];
  requestStateChange?: () => void;
  /** Query plugins for inter-plugin communication */
  queryPlugins<T>(query: { type: string; context: unknown }): T[];
}

/**
 * Column Reordering Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new ReorderPlugin()
 * ```
 */
export class ReorderPlugin extends BaseGridPlugin<ReorderConfig> {
  readonly name = 'reorder';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ReorderConfig> {
    return {
      viewTransition: true,
    };
  }

  // #region Internal State
  private isDragging = false;
  private draggedField: string | null = null;
  private draggedIndex: number | null = null;
  private dropIndex: number | null = null;
  // #endregion

  // #region Lifecycle

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

  override detach(): void {
    this.isDragging = false;
    this.draggedField = null;
    this.draggedIndex = null;
    this.dropIndex = null;
  }
  // #endregion

  // #region Hooks

  override afterRender(): void {
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    const headers = shadowRoot.querySelectorAll('.header-row > .cell');

    headers.forEach((header) => {
      const headerEl = header as HTMLElement;
      const field = headerEl.getAttribute('data-field');
      if (!field) return;

      const column = this.columns.find((c) => c.field === field);
      // Check both local metadata and plugin queries (e.g., PinnedColumnsPlugin)
      const gridEl = this.grid as unknown as GridWithColumnOrder;
      const pluginResponses = gridEl.queryPlugins<boolean>({
        type: PLUGIN_QUERIES.CAN_MOVE_COLUMN,
        context: column as ColumnConfig,
      });
      const pluginAllows = !pluginResponses.includes(false);
      if (!column || !canMoveColumn(column) || !pluginAllows) {
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

        // Update the grid's column order (with optional view transition)
        this.updateColumnOrder(newOrder);

        this.emit('column-move', detail);
      });
    });
  }
  // #endregion

  // #region Public API

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

    // Update with view transition
    this.updateColumnOrder(newOrder);

    this.emit<ColumnMoveDetail>('column-move', {
      field,
      fromIndex,
      toIndex,
      columnOrder: newOrder,
    });
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
   * Update column order with optional view transition animation.
   * Falls back to instant update if View Transitions API is not supported.
   */
  private updateColumnOrder(newOrder: string[]): void {
    const gridEl = this.grid as unknown as GridWithColumnOrder;
    const shadowRoot = this.shadowRoot;

    if (this.config.viewTransition && 'startViewTransition' in document && shadowRoot) {
      // Unique view-transition-name per field enables position tracking
      const allCells = shadowRoot.querySelectorAll('.cell[data-field]');
      allCells.forEach((cell) => {
        const field = cell.getAttribute('data-field');
        if (field) (cell as HTMLElement).style.viewTransitionName = `col-${field}`;
      });

      const transition = (
        document as Document & { startViewTransition: (cb: () => void) => { finished: Promise<void> } }
      ).startViewTransition(() => gridEl.setColumnOrder(newOrder));

      // Clean up after transition
      transition.finished.finally(() => {
        allCells.forEach((cell) => {
          (cell as HTMLElement).style.viewTransitionName = '';
        });
      });
    } else {
      gridEl.setColumnOrder(newOrder);
    }

    gridEl.requestStateChange?.();
  }
  // #endregion

  // #region Styles

  override readonly styles = styles;
  // #endregion
}

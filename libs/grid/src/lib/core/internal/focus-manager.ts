/**
 * FocusManager — encapsulates focus/navigation state and external focus
 * container tracking that were previously inline in the DataGridElement class.
 *
 * Owns:
 * - External focus container registry (register/unregister/containsFocus)
 * - Focus cell navigation (focusCell, focusedCell getter)
 * - Scroll-to-row logic (scrollToRow, scrollToRowById)
 *
 * Takes the grid reference directly (tightly coupled — this manager
 * can never live outside the grid).
 */
import type { GridHost, ScrollToRowOptions } from '../types';
import { ensureCellVisible } from './keyboard';

// #region FocusManager

export class FocusManager<T = any> {
  readonly #grid: GridHost<T>;

  // External focus containers — overlay panels (datepickers, dropdowns)
  // that render at <body> level but should be treated as "inside" the grid.
  #externalFocusContainers = new Set<Element>();
  #externalFocusCleanups = new Map<Element, () => void>();

  constructor(grid: GridHost<T>) {
    this.#grid = grid;
  }

  // #region Focus & Navigation

  /**
   * Move focus to a specific cell.
   * Accepts a column index or field name.
   */
  focusCell(rowIndex: number, column: number | string): void {
    const grid = this.#grid;
    const maxRow = grid._rows.length - 1;
    if (maxRow < 0) return;

    let colIdx: number;
    if (typeof column === 'string') {
      colIdx = grid._visibleColumns.findIndex((c) => c.field === column);
      if (colIdx < 0) return;
    } else {
      colIdx = column;
    }

    const maxCol = grid._visibleColumns.length - 1;
    if (maxCol < 0) return;

    grid._focusRow = Math.max(0, Math.min(rowIndex, maxRow));
    grid._focusCol = Math.max(0, Math.min(colIdx, maxCol));
    ensureCellVisible(grid);
  }

  /**
   * The currently focused cell position, or `null` if no rows are loaded.
   */
  get focusedCell(): { rowIndex: number; colIndex: number; field: string } | null {
    const grid = this.#grid;
    if (grid._rows.length === 0 || grid._visibleColumns.length === 0) return null;
    const col = grid._visibleColumns[grid._focusCol];
    return {
      rowIndex: grid._focusRow,
      colIndex: grid._focusCol,
      field: col?.field ?? '',
    };
  }

  /**
   * Scroll the viewport so a row is visible.
   */
  scrollToRow(rowIndex: number, options?: ScrollToRowOptions): void {
    const virt = this.#grid._virtualization;
    if (!virt.enabled) return;

    const scrollEl = virt.container as HTMLElement | undefined;
    if (!scrollEl) return;

    const totalRows = this.#grid._rows.length;
    if (totalRows === 0) return;

    const idx = Math.max(0, Math.min(rowIndex, totalRows - 1));
    const align = options?.align ?? 'nearest';
    const behavior = options?.behavior ?? 'instant';

    // Calculate row offset and height, accounting for variable row heights
    let rowTop: number;
    let rowH: number;
    const pc = virt.positionCache;
    if (virt.variableHeights && pc && pc.length > idx) {
      rowTop = pc[idx].offset;
      rowH = pc[idx].height;
    } else {
      rowTop = idx * virt.rowHeight;
      rowH = virt.rowHeight;
    }

    const viewportH = virt.viewportEl?.clientHeight ?? scrollEl.clientHeight ?? 0;
    if (viewportH <= 0) return;

    const currentTop = scrollEl.scrollTop;
    const rowBottom = rowTop + rowH;
    const viewBottom = currentTop + viewportH;

    let target: number;
    switch (align) {
      case 'start':
        target = rowTop;
        break;
      case 'center':
        target = rowTop - viewportH / 2 + rowH / 2;
        break;
      case 'end':
        target = rowBottom - viewportH;
        break;
      case 'nearest':
      default:
        // Already fully visible — no scroll needed
        if (rowTop >= currentTop && rowBottom <= viewBottom) return;
        // Scroll up or down to bring row into view (minimum movement)
        target = rowTop < currentTop ? rowTop : rowBottom - viewportH;
        break;
    }

    target = Math.max(0, target);

    if (behavior === 'smooth') {
      scrollEl.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      scrollEl.scrollTop = target;
    }
  }

  /**
   * Scroll the viewport so a row is visible, identified by its unique ID.
   */
  scrollToRowById(rowId: string, options?: ScrollToRowOptions): void {
    const entry = this.#grid._getRowEntry(rowId);
    if (!entry) return;
    this.scrollToRow(entry.index, options);
  }

  // #endregion

  // #region External Focus Containers

  /**
   * Register an external DOM element as a logical focus container of this grid.
   * Focus moving into a registered container is treated as if it stayed inside the grid.
   */
  registerExternalFocusContainer(el: Element): void {
    if (this.#externalFocusContainers.has(el)) return;
    this.#externalFocusContainers.add(el);

    const ac = new AbortController();
    const signal = ac.signal;
    const gridEl = this.#grid;

    el.addEventListener(
      'focusin',
      () => {
        gridEl.dataset.hasFocus = '';
      },
      { signal },
    );

    el.addEventListener(
      'focusout',
      (e) => {
        const newFocus = (e as FocusEvent).relatedTarget as Node | null;
        if (!newFocus || !this.containsFocus(newFocus)) {
          delete gridEl.dataset.hasFocus;
        }
      },
      { signal },
    );

    this.#externalFocusCleanups.set(el, () => ac.abort());
  }

  /**
   * Unregister a previously registered external focus container.
   */
  unregisterExternalFocusContainer(el: Element): void {
    this.#externalFocusContainers.delete(el);
    const cleanup = this.#externalFocusCleanups.get(el);
    if (cleanup) {
      cleanup();
      this.#externalFocusCleanups.delete(el);
    }
  }

  /**
   * Check whether focus is logically inside this grid.
   * Returns `true` when the node is inside the grid's DOM or any external container.
   */
  containsFocus(node?: Node | null): boolean {
    const target = node ?? document.activeElement;
    if (!target) return false;
    if (this.#grid.contains(target)) return true;
    return this.isInExternalFocusContainer(target);
  }

  /**
   * Check whether a node is inside any registered external focus container.
   */
  isInExternalFocusContainer(node: Node): boolean {
    for (const container of this.#externalFocusContainers) {
      if (container.contains(node)) return true;
    }
    return false;
  }

  // #endregion

  // #region Cleanup

  /**
   * Clean up all external focus container listeners.
   * Called when the grid disconnects.
   */
  destroy(): void {
    for (const cleanup of this.#externalFocusCleanups.values()) {
      cleanup();
    }
    this.#externalFocusCleanups.clear();
    this.#externalFocusContainers.clear();
  }

  // #endregion
}

// #endregion

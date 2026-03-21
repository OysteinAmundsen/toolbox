import type { GridHost, ResizeController } from '../types';

export function createResizeController(grid: GridHost): ResizeController {
  let resizeState: { startX: number; colIndex: number; startWidth: number } | null = null;
  let pendingRaf: number | null = null;
  let prevCursor: string | null = null;
  let prevUserSelect: string | null = null;
  const onMove = (e: MouseEvent) => {
    if (!resizeState) return;
    const delta = e.clientX - resizeState.startX;
    const width = Math.max(40, resizeState.startWidth + delta);
    const col = grid._visibleColumns[resizeState.colIndex];
    col.width = width;
    col.__userResized = true;
    col.__renderedWidth = width;
    if (pendingRaf == null) {
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;
        grid.updateTemplate?.();
      });
    }
    grid.dispatchEvent(new CustomEvent('column-resize', { detail: { field: col.field, width } }));
  };
  let justFinishedResize = false;
  const onUp = () => {
    const hadResize = resizeState !== null;
    // Set flag to suppress click events that fire immediately after mouseup
    if (hadResize) {
      justFinishedResize = true;
      requestAnimationFrame(() => {
        justFinishedResize = false;
      });
    }
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (prevCursor !== null) {
      document.documentElement.style.cursor = prevCursor;
      prevCursor = null;
    }
    if (prevUserSelect !== null) {
      document.body.style.userSelect = prevUserSelect;
      prevUserSelect = null;
    }
    resizeState = null;
    // Trigger state change after resize completes
    if (hadResize && grid.requestStateChange) {
      grid.requestStateChange();
    }
  };

  /**
   * Freeze all flexible (non-explicitly-sized) columns to their current rendered
   * pixel widths. This prevents CSS Grid `fr` redistribution from shifting
   * neighboring columns while the user drags a resize handle.
   */
  function freezeFlexibleColumns(colIndex: number, headerRow: HTMLElement): void {
    const cells = headerRow.querySelectorAll<HTMLElement>('.cell');
    for (let i = 0; i < grid._visibleColumns.length; i++) {
      if (i === colIndex) continue;
      const col = grid._visibleColumns[i];
      // Only freeze columns that are currently flexible (no explicit width)
      if (col.width == null && !col.__userResized) {
        const cellEl = cells[i];
        const rendered = cellEl?.getBoundingClientRect().width;
        if (rendered) {
          col.width = Math.round(rendered);
          col.__userResized = true;
          col.__renderedWidth = col.width;
        }
      }
    }
  }

  return {
    get isResizing() {
      return resizeState !== null || justFinishedResize;
    },
    start(e, colIndex, cell) {
      e.preventDefault();

      // Freeze flexible columns before resizing so they hold their current width
      const headerRow = grid._headerRowEl ?? grid.findHeaderRow?.();
      if (headerRow) freezeFlexibleColumns(colIndex, headerRow);

      // Use the column's configured/rendered width, not the cell's bounding rect.
      // The bounding rect can be incorrect if CSS grid-column spanning is in effect
      // (e.g., when previous columns are display:none and this cell spans multiple tracks).
      const col = grid._visibleColumns[colIndex];
      // Only use numeric widths; string widths (e.g., "100px", "20%") fall back to bounding rect
      const colWidth = typeof col?.width === 'number' ? col.width : undefined;
      const startWidth = col?.__renderedWidth ?? colWidth ?? cell.getBoundingClientRect().width;
      resizeState = { startX: e.clientX, colIndex, startWidth };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      if (prevCursor === null) prevCursor = document.documentElement.style.cursor;
      document.documentElement.style.cursor = 'e-resize';
      if (prevUserSelect === null) prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
    },
    resetColumn(colIndex) {
      const col = grid._visibleColumns[colIndex];
      if (!col) return;

      // Reset to original configured width (or undefined for auto-sizing)
      col.__userResized = false;
      col.__renderedWidth = undefined;
      col.width = col.__originalWidth;

      grid.updateTemplate?.();
      grid.requestStateChange?.();
      grid.dispatchEvent(new CustomEvent('column-resize-reset', { detail: { field: col.field, width: col.width } }));
    },
    dispose() {
      onUp();
    },
  };
}

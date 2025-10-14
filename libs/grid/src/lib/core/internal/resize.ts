/** Controller interface for column resize interactions (local minimal typing). */
import type { InternalGrid } from '../types';

interface ResizeController {
  start: (e: MouseEvent, colIndex: number, cell: HTMLElement) => void;
  dispose: () => void;
  /** True while a resize drag is in progress (used to suppress header click/sort). */
  isResizing: boolean;
}

export function createResizeController(grid: InternalGrid): ResizeController {
  let resizeState: { startX: number; colIndex: number; startWidth: number } | null = null;
  let pendingRaf: number | null = null;
  let prevCursor: string | null = null;
  let prevUserSelect: string | null = null;
  const onMove = (e: MouseEvent) => {
    if (!resizeState) return;
    const delta = e.clientX - resizeState.startX;
    const width = Math.max(40, resizeState.startWidth + delta);
    const col = grid.visibleColumns[resizeState.colIndex];
    col.width = width;
    col.__userResized = true;
    col.__renderedWidth = width;
    if (pendingRaf == null) {
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null;
        grid.updateTemplate?.();
      });
    }
    (grid as unknown as HTMLElement).dispatchEvent(
      new CustomEvent('column-resize', { detail: { field: col.field, width } })
    );
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
  return {
    get isResizing() {
      return resizeState !== null || justFinishedResize;
    },
    start(e, colIndex, cell) {
      e.preventDefault();
      const rect = cell.getBoundingClientRect();
      resizeState = { startX: e.clientX, colIndex, startWidth: rect.width };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      if (prevCursor === null) prevCursor = document.documentElement.style.cursor;
      document.documentElement.style.cursor = 'e-resize';
      if (prevUserSelect === null) prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
    },
    dispose() {
      onUp();
    },
  };
}

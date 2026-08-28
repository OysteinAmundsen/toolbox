import type { ColumnInternal, GridHost, ResizeController } from '../types';
import { startPointerDrag } from './pointer-drag';
import { createSizePopover, type SizePopover } from './size-popover';

/** Floor applied to every width commit when the column declares no `minWidth`. */
const FALLBACK_MIN_WIDTH = 40;

/** Smallest width a column may be resized to, drag or click alike. */
function minWidthFor(col: ColumnInternal | undefined): number {
  return typeof col?.minWidth === 'number' && Number.isFinite(col.minWidth) && col.minWidth > 0
    ? col.minWidth
    : FALLBACK_MIN_WIDTH;
}

/**
 * Normalise the event that started a resize.
 *
 * `ResizeController.start` still accepts a plain `MouseEvent` for callers
 * written before v3.5.0. Every `mousedown` in a modern browser is preceded by a
 * `pointerdown` for the same physical pointer, and the primary mouse is always
 * `pointerId: 1` — so re-describing the event that way keeps pointer capture
 * working for legacy callers instead of silently dropping the drag.
 */
function toPointerEvent(e: MouseEvent | PointerEvent): PointerEvent {
  if ('pointerId' in e) return e;
  return new PointerEvent('pointerdown', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    clientX: e.clientX,
    clientY: e.clientY,
    button: e.button,
    buttons: e.buttons,
  });
}

export function createResizeController(grid: GridHost): ResizeController {
  /**
   * In-flight gesture state. The `start*` fields capture enough of the column to
   * put it back exactly as it was if the drag is aborted (Escape / pointercancel).
   */
  let resizeState: {
    startX: number;
    colIndex: number;
    startWidth: number;
    startConfiguredWidth: number | string | undefined;
    startRenderedWidth: number | undefined;
    startUserResized: boolean;
  } | null = null;
  /** Teardown for the active `startPointerDrag`, so `dispose()` can abort mid-gesture. */
  let cancelDrag: (() => void) | null = null;
  /**
   * Whether the current gesture ever moved the pointer. `startPointerDrag`
   * promotes immediately when it has neither a threshold nor a long-press, so
   * promotion cannot distinguish a tap from a drag — actual movement can.
   */
  let moved = false;
  let pendingRaf: number | null = null;
  let prevCursor: string | null = null;
  let prevUserSelect: string | null = null;
  /** Lazily created on the first handle tap — most sessions never build it. */
  let widthPopover: SizePopover<number> | null = null;

  /** Header cell for a visible column index, used to read a rendered width. */
  const headerCellAt = (colIndex: number): HTMLElement | undefined => {
    const headerRow = grid._headerRowEl ?? grid.findHeaderRow?.();
    return headerRow?.querySelectorAll<HTMLElement>('.cell')[colIndex];
  };

  const widthOf = (colIndex: number): number => {
    const col = grid._visibleColumns[colIndex];
    if (col?.__renderedWidth != null) return col.__renderedWidth;
    if (typeof col?.width === 'number') return col.width;
    return headerCellAt(colIndex)?.getBoundingClientRect().width ?? 0;
  };

  /**
   * Single commit path shared by the drag, the step buttons and the numeric
   * input, so all three clamp identically and emit the same `column-resize`.
   */
  const commitWidth = (colIndex: number, requested: number): number | null => {
    const col = grid._visibleColumns[colIndex];
    if (!col) return null;
    const width = Math.max(minWidthFor(col), requested);
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
    return width;
  };

  const onMove = (e: PointerEvent) => {
    if (!resizeState) return;
    const delta = e.clientX - resizeState.startX;
    if (delta !== 0) moved = true;
    commitWidth(resizeState.colIndex, resizeState.startWidth + delta);
  };
  let justFinishedResize = false;
  /**
   * Swallow the `click` that follows a pointer gesture on the handle, so
   * resizing (or opening the width popover) never also sorts the column.
   */
  const suppressNextClick = (): void => {
    justFinishedResize = true;
    requestAnimationFrame(() => {
      justFinishedResize = false;
    });
  };
  const onUp = (hadResize: boolean) => {
    // Set flag to suppress click events that fire immediately after pointerup
    if (hadResize) suppressNextClick();
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
   * Abort an in-flight resize: put the column back exactly as it was at
   * pointerdown and commit nothing.
   *
   * `onUp(true)` would persist the half-dragged width and fire
   * `requestStateChange()`, which is the opposite of what Escape and
   * `pointercancel` mean.
   */
  const onAbort = (): void => {
    const state = resizeState;
    if (state) {
      const col = grid._visibleColumns[state.colIndex];
      if (col) {
        col.width = state.startConfiguredWidth;
        col.__renderedWidth = state.startRenderedWidth;
        col.__userResized = state.startUserResized;
        grid.updateTemplate?.();
        grid.dispatchEvent(new CustomEvent('column-resize', { detail: { field: col.field, width: state.startWidth } }));
      }
      // The user was dragging, not clicking — still swallow the trailing click
      // so aborting on a header does not also trigger a sort.
      suppressNextClick();
    }
    // `false` — restore cursor/user-select and clear state without committing.
    onUp(false);
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

  function resetColumn(colIndex: number): void {
    const col = grid._visibleColumns[colIndex];
    if (!col) return;

    // Reset to original configured width (or undefined for auto-sizing)
    col.__userResized = false;
    col.__renderedWidth = undefined;
    col.width = col.__originalWidth;

    grid.updateTemplate?.();
    grid.requestStateChange?.();
    grid.dispatchEvent(new CustomEvent('column-resize-reset', { detail: { field: col.field, width: col.width } }));
  }

  /**
   * Open the non-drag width control (WCAG 2.2 SC 2.5.7). Reached by *tapping*
   * the resize handle instead of dragging it, so a single-pointer user gets the
   * same capability without a press-hold-move-release gesture.
   */
  function openWidthPopover(colIndex: number, anchor: HTMLElement): void {
    widthPopover ??= createSizePopover<number>({
      id: 'tbw-column-size-popover',
      getSize: widthOf,
      setSize: (index, width) => {
        commitWidth(index, width);
        grid.requestStateChange?.();
      },
      reset: resetColumn,
      getLabel: (index) => {
        const col = grid._visibleColumns[index];
        return `Width of column ${String(col?.header ?? col?.field ?? index + 1)}`;
      },
      getHost: () => grid,
    });
    widthPopover.open(colIndex, anchor);
  }

  return {
    get isResizing() {
      return resizeState !== null || justFinishedResize;
    },
    start(rawEvent, colIndex, cell, captureTarget) {
      const e = toPointerEvent(rawEvent);
      rawEvent.preventDefault();

      // A second start() while a drag is in flight would orphan the first
      // gesture's listeners and pointer capture.
      cancelDrag?.();
      cancelDrag = null;
      moved = false;

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
      resizeState = {
        startX: e.clientX,
        colIndex,
        startWidth,
        startConfiguredWidth: col?.width,
        startRenderedWidth: col?.__renderedWidth,
        startUserResized: col?.__userResized ?? false,
      };
      if (prevCursor === null) prevCursor = document.documentElement.style.cursor;
      document.documentElement.style.cursor = 'e-resize';
      if (prevUserSelect === null) prevUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const target = captureTarget ?? cell;
      cancelDrag = startPointerDrag(e, target, {
        onMove,
        onEnd: () => {
          cancelDrag = null;
          if (moved) {
            onUp(true);
            return;
          }
          // Pressed and released without moving — a tap, not a drag. Nothing
          // changed, so commit nothing and offer the click-only width control
          // instead (WCAG 2.2 SC 2.5.7).
          suppressNextClick();
          onUp(false);
          openWidthPopover(colIndex, target as HTMLElement);
        },
        onCancel: () => {
          cancelDrag = null;
          onAbort();
        },
      });
    },
    resetColumn,
    setColumnWidth(colIndex, width) {
      if (commitWidth(colIndex, width) == null) return;
      grid.requestStateChange?.();
    },
    getColumnWidth: widthOf,
    dispose() {
      // Tear down an in-flight drag first, or its pointer capture and listeners
      // outlive the grid. The returned canceller is idempotent.
      cancelDrag?.();
      cancelDrag = null;
      onUp(resizeState !== null);
      widthPopover?.dispose();
      widthPopover = null;
      // Drop any in-flight template update — the grid (or its DOM) is going
      // away, so the queued `updateTemplate()` would run against stale refs.
      if (pendingRaf != null) {
        cancelAnimationFrame(pendingRaf);
        pendingRaf = null;
      }
    },
  };
}

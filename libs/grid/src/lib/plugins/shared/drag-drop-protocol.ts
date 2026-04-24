/**
 * Drag-Drop Protocol — shared utilities for cross-grid row drag-and-drop.
 *
 * Used by `RowDragDropPlugin` (and any future plugin that participates in the
 * tbw row-drag protocol). Centralises:
 *
 *   - MIME type constants and zone tagging (visible in `dataTransfer.types`)
 *   - Payload codec for cross-window / cross-iframe transfers
 *   - Drop-position math (midpoint algorithm)
 *   - Auto-scroll engine (rAF loop, edge detection, boundary clamp)
 *   - Plain-text TSV fallback for drags out to Notepad / Excel / Slack
 *
 * @internal Plugin shared utility (not part of the public API).
 */

import type { ColumnConfig } from '../../core/types';

// ---------------------------------------------------------------------------
// Same-window current-session tracker
// ---------------------------------------------------------------------------

/**
 * Module-level "active drag session" — set on dragstart by the source grid,
 * cleared on dragend. Lets target grids read the full payload synchronously
 * during `dragover` (browsers hide `dataTransfer.getData()` during dragover
 * for security). Cross-window drags don't have access to this module and
 * fall back to a generic accept-check followed by a drop-time canDrop call.
 *
 * @internal
 */
let currentSession: { sessionId: string; payload: RowDragPayload<unknown> } | null = null;

/** @internal */
export function setCurrentDragSession<T>(sessionId: string, payload: RowDragPayload<T>): void {
  currentSession = { sessionId, payload: payload as RowDragPayload<unknown> };
}

/** @internal */
export function getCurrentDragSession<T = unknown>(): { sessionId: string; payload: RowDragPayload<T> } | null {
  return currentSession as { sessionId: string; payload: RowDragPayload<T> } | null;
}

/** @internal */
export function clearCurrentDragSession(): void {
  currentSession = null;
}

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

/** Base MIME type carried on `dataTransfer` for tbw row drags. */
export const TBW_ROW_DRAG_MIME = 'application/x-tbw-grid-rows+json';

/** Build a zone-tagged MIME type, visible in `dataTransfer.types` during dragover. */
export function mimeForZone(zone: string): string {
  return `${TBW_ROW_DRAG_MIME};zone=${encodeURIComponent(zone)}`;
}

/** Extract the zone from a tagged MIME, or `null` if untagged. */
export function parseZoneFromMime(mime: string): string | null {
  const match = mime.match(/^application\/x-tbw-grid-rows\+json;zone=(.*)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Find the first MIME entry in `types` whose zone matches `zone`.
 * Used during `dragover` for the accept-check (browsers hide `getData()`
 * during dragover, but `types` is always visible).
 */
export function findMatchingZoneMime(types: readonly string[], zone: string): string | null {
  for (const t of types) {
    if (parseZoneFromMime(t) === zone) return t;
  }
  return null;
}

/** Returns true if any tbw row-drag MIME is present in `types`. */
export function hasAnyRowDragMime(types: readonly string[]): boolean {
  for (const t of types) {
    if (t === TBW_ROW_DRAG_MIME || t.startsWith(`${TBW_ROW_DRAG_MIME};`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------

/**
 * Cross-grid drag payload, carried on `dataTransfer` and (for same-window
 * recovery) keyed in the WeakRef registry by `sessionId`.
 */
export interface RowDragPayload<T = unknown> {
  /** Drag session id (matches the WeakRef registry key). */
  sessionId: string;
  /** Source grid id (`grid.id` or auto-generated UUID). */
  sourceGridId: string;
  /** Drop zone the source grid is participating in. */
  dropZone: string;
  /** Serialized row payload (JSON-safe). For same-window drops, recovered live via the registry. */
  rows: T[];
  /** Original indices in the source grid's `_rows` array. */
  rowIndices: number[];
  /** Move (default) removes from source; copy leaves source intact. */
  operation: 'move' | 'copy';
}

/** Encode a payload to the JSON string written to `dataTransfer`. */
export function encodePayload<T>(payload: RowDragPayload<T>): string {
  return JSON.stringify(payload);
}

/** Decode a payload from the JSON string read off `dataTransfer`. */
export function decodePayload<T = unknown>(raw: string): RowDragPayload<T> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RowDragPayload<T>;
    if (
      typeof parsed?.sessionId !== 'string' ||
      typeof parsed?.sourceGridId !== 'string' ||
      typeof parsed?.dropZone !== 'string' ||
      !Array.isArray(parsed?.rows) ||
      !Array.isArray(parsed?.rowIndices) ||
      (parsed.operation !== 'move' && parsed.operation !== 'copy')
    ) {
      return null;
    }
    // `rowIndices` is later used for sorting and splicing — reject anything
    // that isn't a finite, non-negative integer to avoid JS coercion bugs
    // (NaN ordering, float splice indices, string concatenation, etc.).
    for (const idx of parsed.rowIndices) {
      if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Drop position math
// ---------------------------------------------------------------------------

export interface DropPosition {
  /** Target visual row index that the cursor is over, or `null` for empty area. */
  overIndex: number | null;
  /** Final insertion index in the target grid's `_rows`. */
  insertIndex: number;
  /** True when the cursor is above the row midpoint. */
  isBefore: boolean;
}

/**
 * Compute the insertion index for a drop, given the row element under the
 * cursor (if any), the cursor's clientY, and the total row count when the
 * cursor is in empty space below the last row.
 *
 * - Cursor above row midpoint → insert at `targetIndex`
 * - Cursor below row midpoint → insert at `targetIndex + 1`
 * - Cursor over empty area below the last row → append (`insertIndex = totalRows`)
 */
export function computeDropPosition(
  rowEl: HTMLElement | null,
  clientY: number,
  rowIndexResolver: (el: HTMLElement) => number,
  totalRows: number,
): DropPosition {
  if (!rowEl) {
    return { overIndex: null, insertIndex: totalRows, isBefore: false };
  }
  const targetIndex = rowIndexResolver(rowEl);
  if (targetIndex < 0) {
    return { overIndex: null, insertIndex: totalRows, isBefore: false };
  }
  const rect = rowEl.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const isBefore = clientY < midY;
  return {
    overIndex: targetIndex,
    insertIndex: isBefore ? targetIndex : targetIndex + 1,
    isBefore,
  };
}

// ---------------------------------------------------------------------------
// Auto-scroll engine
// ---------------------------------------------------------------------------

export interface AutoScrollOptions {
  /** Pixels from the top/bottom edge that activate auto-scroll. */
  edgeSize?: number;
  /** Base scroll speed in pixels-per-frame near the edge. */
  speed?: number;
  /** Max speed at the very edge (linear ramp from `speed` → `maxSpeed`). */
  maxSpeed?: number;
}

export interface AutoScroller {
  /** Update pointer position; starts the rAF loop if needed. */
  onPointerMove(clientY: number): void;
  /** Stop the rAF loop and reset state. */
  stop(): void;
  /** True when actively auto-scrolling. */
  readonly isScrolling: boolean;
}

/**
 * Create an auto-scroller for a viewport element.
 *
 * The scroller runs a `requestAnimationFrame` loop only while the pointer is
 * within `edgeSize` of the viewport's top or bottom and there is room to
 * scroll. Speed ramps linearly from `speed` (at the edge boundary) to
 * `maxSpeed` (at the very edge).
 */
export function createAutoScroller(
  viewport: HTMLElement,
  options: AutoScrollOptions = {},
  onScrollChange?: (active: boolean) => void,
): AutoScroller {
  const edgeSize = options.edgeSize ?? 60;
  const baseSpeed = options.speed ?? 8;
  const maxSpeed = options.maxSpeed ?? 24;

  let rafId: number | null = null;
  let pointerY: number | null = null;
  let active = false;

  const setActive = (next: boolean): void => {
    if (next === active) return;
    active = next;
    onScrollChange?.(next);
  };

  const tick = (): void => {
    rafId = null;
    if (pointerY === null) {
      setActive(false);
      return;
    }
    const rect = viewport.getBoundingClientRect();
    let delta = 0;

    if (pointerY < rect.top + edgeSize) {
      const distance = Math.max(0, pointerY - rect.top);
      const ratio = 1 - distance / edgeSize;
      delta = -Math.round(baseSpeed + (maxSpeed - baseSpeed) * ratio);
    } else if (pointerY > rect.bottom - edgeSize) {
      const distance = Math.max(0, rect.bottom - pointerY);
      const ratio = 1 - distance / edgeSize;
      delta = Math.round(baseSpeed + (maxSpeed - baseSpeed) * ratio);
    }

    if (delta === 0) {
      setActive(false);
      return;
    }

    const before = viewport.scrollTop;
    viewport.scrollTop = before + delta;

    // Stop if we hit a boundary (no movement happened)
    if (viewport.scrollTop === before) {
      setActive(false);
      return;
    }

    setActive(true);
    rafId = requestAnimationFrame(tick);
  };

  return {
    onPointerMove(clientY: number): void {
      pointerY = clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(tick);
      }
    },
    stop(): void {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pointerY = null;
      setActive(false);
    },
    get isScrolling(): boolean {
      return active;
    },
  };
}

// ---------------------------------------------------------------------------
// TSV fallback
// ---------------------------------------------------------------------------

/**
 * Format rows as a TSV string for the `text/plain` drag fallback.
 * Used when the drop target is an external app (Excel, Notepad, Slack).
 *
 * - One row per line, fields separated by `\t`.
 * - Tabs and newlines in cell values are replaced with spaces.
 * - Skips columns flagged as `utility` (drag handle, checkbox, etc.).
 */
export function formatRowsAsTSV<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly ColumnConfig[],
): string {
  const dataColumns = columns.filter(
    (c) => !(c as { utility?: boolean }).utility && typeof c.field === 'string' && c.field !== '',
  );
  const lines: string[] = [];
  for (const row of rows) {
    const cells = dataColumns.map((col) => {
      const value = row[col.field];
      if (value === null || value === undefined) return '';
      const str = String(value);
      return str.replace(/[\t\r\n]+/g, ' ');
    });
    lines.push(cells.join('\t'));
  }
  return lines.join('\n');
}

/**
 * Row Drag-Drop Plugin Types
 *
 * Public types for {@link RowDragDropPlugin} — drag rows within a single grid
 * (parity with the deprecated `RowReorderPlugin`) **and** between grids that
 * share a `dropZone` identifier.
 */

/**
 * Configuration for {@link RowDragDropPlugin}.
 *
 * All keys not annotated as "cross-grid" are identical in name and default to
 * `RowReorderConfig`, so migration is `new RowReorderPlugin(cfg)` →
 * `new RowDragDropPlugin(cfg)` with zero changes.
 */
export interface RowDragDropConfig<T = unknown> {
  // === Parity with RowReorderConfig ===

  /**
   * Enable keyboard shortcuts (`Ctrl + ↑` / `Ctrl + ↓`) for moving rows.
   * Keyboard moves are intra-grid only.
   * @default true
   */
  enableKeyboard?: boolean;

  /**
   * Show a drag handle column.
   *
   * Defaults to `true` when {@link RowDragDropConfig.dragFrom dragFrom} is
   * `'handle'` (the default) or `'both'`, and to `false` when `dragFrom` is
   * `'row'` — when the entire row is the drag handle, the dedicated grip
   * column adds no value. Set explicitly to override.
   * @default true (or false when `dragFrom: 'row'`)
   */
  showDragHandle?: boolean;

  /**
   * Where on a row a drag can be initiated.
   *
   * - `'handle'` (default): only the grip column starts a drag. Backwards
   *   compatible with `RowReorderPlugin`.
   * - `'row'`: any cell starts a drag, and the grip column is hidden by
   *   default. Recommended for transfer-list / kanban-style UIs where a
   *   dedicated handle adds visual noise.
   * - `'both'`: either the grip OR any cell starts a drag.
   *
   * Drags initiated on interactive descendants (inputs, buttons, anchors,
   * contenteditable, open cell editors, selection checkboxes) are always
   * suppressed regardless of this setting so native interactions keep working.
   * @default 'handle'
   */
  dragFrom?: 'handle' | 'row' | 'both';

  /**
   * Position of the drag handle column.
   * @default 'left'
   */
  dragHandlePosition?: 'left' | 'right';

  /**
   * Width of the drag handle column in pixels.
   * @default 40
   */
  dragHandleWidth?: number;

  /**
   * Debounce time in milliseconds for rapid keyboard moves.
   * Events are batched and emitted after this delay.
   * @default 150
   */
  debounceMs?: number;

  /**
   * Animation type for row movement.
   * - `false`: instant reorder
   * - `'flip'`: FLIP animation (slides rows smoothly)
   * @default 'flip'
   */
  animation?: false | 'flip';

  /**
   * Validation callback invoked once at `dragstart` (and on intra-grid
   * keyboard moves) to decide whether a row can be picked up.
   * Replaces `RowReorderConfig.canMove` for the dragstart side.
   *
   * @param row   The row about to be dragged.
   * @param index The row's current index in the source grid's `_rows`.
   * @returns `false` to block the drag.
   */
  canDrag?: (row: T, index: number) => boolean;

  /**
   * @deprecated Use {@link RowDragDropConfig.canDrag canDrag} for the
   * dragstart-side veto and {@link RowDragDropConfig.canDrop canDrop} for
   * the drop-side veto. `canMove` is accepted as a back-compat alias and
   * mapped internally — it is invoked for intra-grid moves with the same
   * `(row, fromIndex, toIndex, direction)` signature as `RowReorderConfig`.
   */
  canMove?: (row: T, fromIndex: number, toIndex: number, direction: 'up' | 'down') => boolean;

  // === Cross-grid ===

  /**
   * Shared zone identifier. Two grids that opt into the same zone may
   * exchange rows. Omit to behave exactly like the legacy `RowReorderPlugin`
   * — intra-grid only, no cross-grid affordances.
   */
  dropZone?: string;

  /**
   * Cross-grid drop semantics.
   * - `'move'` (default): the row is removed from the source grid's `_rows`
   *   and inserted into the target.
   * - `'copy'`: the source `_rows` is unchanged; the target inserts a copy.
   *
   * The user's input `sourceRows` array is never mutated on either side —
   * persistence is consumer-driven via the `row-transfer` event.
   *
   * @default 'move'
   */
  operation?: 'copy' | 'move';

  /**
   * Validation callback invoked during `dragover` (same-window) and at drop
   * time to decide whether a drop should be accepted at `targetIndex`.
   *
   * For intra-grid drops, `payload.sourceGridId` equals this grid's id.
   *
   * @returns `false` to reject the drop.
   */
  canDrop?: (payload: RowDragPayload<T>, targetIndex: number) => boolean;

  /**
   * Optional row transformer applied when a row leaves this grid in a
   * cross-window / cross-iframe drag (i.e. when the WeakRef live-reference
   * path cannot be used). Use to strip internal IDs or rename fields before
   * the row crosses a security boundary.
   *
   * Same-window drops use live references and bypass this hook entirely.
   */
  serializeRow?: (row: T) => unknown;

  /**
   * Optional row transformer applied when a row lands in this grid via a
   * cross-window / cross-iframe drag. Use to assign new IDs or remap fields.
   *
   * Same-window drops use live references and bypass this hook entirely.
   */
  deserializeRow?: (raw: unknown) => T;

  /**
   * Auto-scroll the target grid when the cursor approaches its viewport top
   * or bottom edge during drag.
   *
   * - `true` (default): enable with the default tuning
   *   (`edgeSize: 60`, `speed: 8`, `maxSpeed: 24`).
   * - `false`: disabled.
   * - object: overrides any of the tuning fields.
   *
   * @default true
   */
  autoScroll?: boolean | { edgeSize?: number; speed?: number; maxSpeed?: number };
}

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

/**
 * Event detail emitted when a row is moved within a single grid.
 *
 * For backward compatibility this type matches `RowReorderPlugin`'s
 * `RowMoveDetail` exactly; the `row-move` event continues to fire only for
 * intra-grid moves. Cross-grid moves emit `row-transfer` instead.
 */
export interface RowMoveDetail<T = unknown> {
  /** The row that was moved. */
  row: T;
  /** The original index of the row. */
  fromIndex: number;
  /** The new index of the row. */
  toIndex: number;
  /** The full rows array in new order. */
  rows: T[];
  /** How the move was initiated. */
  source: 'keyboard' | 'drag';
}

/** Detail for the `row-drag-start` event (source grid). */
export interface RowDragStartDetail<T = unknown> {
  /** Rows being dragged (single row, or whole selection if dragged row is selected). */
  rows: T[];
  /** Indices of those rows in the source grid's `_rows`. */
  indices: number[];
  /** Operation requested by the source grid's config. */
  operation: 'move' | 'copy';
  /** Drop zone (empty string when the source grid is intra-grid only). */
  dropZone: string;
}

/** Detail for the `row-drag-end` event (source grid). */
export interface RowDragEndDetail<T = unknown> {
  /** Rows that were being dragged. */
  rows: T[];
  /** Their indices at dragstart. */
  indices: number[];
  /** True when a target grid accepted the drop (cross-grid drops only). */
  accepted: boolean;
}

/** Detail for the `row-drop` event (target grid, cancelable). */
export interface RowDropDetail<T = unknown> {
  /** Decoded payload from the source grid. */
  payload: RowDragPayload<T>;
  /** Convenience accessor — same as `payload.sourceGridId`. */
  sourceGridId: string;
  /** Final insertion index in the target grid's `_rows`. */
  targetIndex: number;
  /** Operation requested by the source grid (`'move'` | `'copy'`). */
  operation: 'move' | 'copy';
}

/** Detail for the `row-transfer` event (fired on BOTH grids after success). */
export interface RowTransferDetail<T = unknown> {
  /** Rows that were transferred. */
  rows: T[];
  /** Source grid id. */
  fromGridId: string;
  /** Target grid id. */
  toGridId: string;
  /** Indices the rows occupied in the source grid's `_rows`. */
  fromIndices: number[];
  /** Insertion index in the target grid's `_rows`. */
  toIndex: number;
  /** Operation that was applied. */
  operation: 'move' | 'copy';
}

/**
 * Internal state for pending keyboard moves (debouncing).
 * @internal
 */
export interface PendingMove {
  /** Original index when debounce started. */
  originalIndex: number;
  /** Current pending index. */
  currentIndex: number;
  /** The row being moved. */
  row: unknown;
}

// Module Augmentation — register events and plugin name for type-safe lookups.
declare module '../../core/types' {
  interface DataGridEventMap<TRow = unknown> {
    /**
     * Fired on the **source** grid when a row drag begins.
     * Cancelable — call `preventDefault()` to abort the drag.
     * @group Row Drag-Drop Events
     */
    'row-drag-start': RowDragStartDetail<TRow>;

    /**
     * Fired on the **source** grid when a row drag ends, regardless of outcome.
     * `detail.accepted` is `true` only for cross-grid drops that landed.
     * @group Row Drag-Drop Events
     */
    'row-drag-end': RowDragEndDetail<TRow>;

    /**
     * Fired on the **target** grid when a cross-grid drop is about to be
     * applied. Cancelable — call `preventDefault()` to reject the drop.
     * Not fired for intra-grid moves (those still emit `row-move`).
     * @group Row Drag-Drop Events
     */
    'row-drop': RowDropDetail<TRow>;

    /**
     * Fired on **both** the source and target grid after a successful
     * cross-grid drop. Use this to persist changes in your data store.
     * @group Row Drag-Drop Events
     */
    'row-transfer': RowTransferDetail<TRow>;
  }

  interface PluginNameMap {
    /** Primary name for the row drag-drop plugin. */
    rowDragDrop: import('./RowDragDropPlugin').RowDragDropPlugin;
  }
}

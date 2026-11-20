/**
 * `rows:resolve-move` query contract.
 *
 * Asked by {@link https://toolboxjs.com/grid/plugins/row-drag-drop/ | RowDragDropPlugin}
 * whenever it moves, removes or inserts rows, or picks the rows a multi-row
 * drag carries, and answered by plugins that
 * reshape the row model (Tree, GroupingRows). Lets the drag plugin stay
 * unaware of any particular row structure: it only speaks in display rows
 * (`grid.rows`) and lets the structure owner translate that into new source
 * rows. Types only — nothing here ships at runtime.
 *
 * Responses:
 * - a {@link RowMoveResolution} — the responder applied the operation;
 * - `false` — veto, the operation is not allowed;
 * - `undefined` — not handled; RowDragDrop falls back to an identity-based
 *   splice of `grid.sourceRows`.
 */

/** Query type for {@link RowMoveQuery}. @since 3.12.3 */
export type RowMoveQueryType = 'rows:resolve-move';

/** Insert before or after the target row. @since 3.12.3 */
export type RowMovePosition = 'before' | 'after';

/**
 * Relative move requested by the keyboard shortcut or the click-only move menu.
 * Structural responders interpret it among the row's siblings (`-1`/`1` =
 * previous/next sibling, `'first'`/`'last'` = start/end of the sibling list).
 * @since 3.12.3
 */
export type RowMoveStep = -1 | 1 | 'first' | 'last';

/**
 * Context of a `rows:resolve-move` query. Indices are positions in the
 * displayed rows (`grid.rows`).
 * @since 3.12.3
 */
export type RowMoveQuery =
  | {
      /** Reorder a row within the grid. */
      op: 'move';
      /** The row being moved. */
      row: unknown;
      /** Display index of {@link row}. */
      fromIndex: number;
      /**
       * The displayed row the move is positioned against, or `null` for "after
       * everything" (dropped below the last row) — the end of the top level.
       */
      target: unknown;
      /** Display index of {@link target}; the last displayed row when `target` is `null`. */
      toIndex: number;
      /** Insert {@link row} before or after {@link target}. */
      position: RowMovePosition;
      /** Set for keyboard / move-menu moves; `target` is then the display neighbour. */
      step?: RowMoveStep;
    }
  | {
      /** Remove rows that were moved out to another grid. */
      op: 'remove';
      rows: unknown[];
    }
  | {
      /** Insert rows dropped in from another grid. */
      op: 'insert';
      rows: unknown[];
      /** Displayed row to insert against, or `null` to append. */
      target: unknown;
      position: RowMovePosition;
    }
  | {
      /**
       * Rows about to leave as one drag or transfer (a multi-row selection).
       * Answer `{ rows }` with the ones that travel on their own — Tree drops a
       * row that is inside another listed row's subtree, since that row carries it.
       */
      op: 'pick';
      rows: unknown[];
    };

/**
 * A responder's answer to a {@link RowMoveQuery}.
 * @since 3.12.3
 */
export interface RowMoveResolution {
  /**
   * The new source rows (assigned to `grid.rows`). Never the consumer's array.
   * For `pick`, the subset of the listed rows that travel instead.
   */
  rows: unknown[];
  /** Parent of the moved row before the move (`null` = top level). `move` only. */
  fromParent?: unknown;
  /** Parent of the moved row after the move (`null` = top level). `move` only. */
  toParent?: unknown;
  /** Index of the moved row in its old parent's children. `move` only. */
  fromIndex?: number;
  /** Index of the moved row in its new parent's children. `move` only. */
  toIndex?: number;
}

/**
 * Identity-based row ordering for RowDragDropPlugin (#663).
 *
 * Display indices (`grid.rows`) only line up with source indices when no
 * plugin reshapes the rows (filtering, grouping, tree), so every move is
 * applied to the source rows by row identity instead. One row object (or
 * primitive value) can appear more than once — a same-window `copy` inserts the
 * live object — so each operation works on the OCCURRENCE that is shown: the
 * k-th display occurrence of a row maps to its k-th source occurrence.
 */
import type { RowMovePosition, RowMoveQuery, RowMoveResolution } from '../shared/row-move';

/** Answers a `rows:resolve-move` query: `false` = veto, a resolution = handled, `undefined` = identity splice. */
export type ResolveMove = (query: RowMoveQuery) => RowMoveResolution | false | undefined;

/**
 * A move ready to apply; `structural` = resolved by a row-model plugin (Tree),
 * not the identity splice. `display` = the displayed order after a flat move.
 */
export type PlannedMove = RowMoveResolution & { structural: boolean; display?: unknown[] };

/** `planMove` target index for "after every row" — a drop below the last row. */
export const END_OF_ROWS = -1;

/** Index in `after` of the same occurrence as `before[index]` (k-th equal row ↔ k-th equal row); -1 if gone. */
export function relocate(before: readonly unknown[], index: number, after: readonly unknown[]): number {
  const row = before[index];
  let rank = 0;
  for (let i = 0; i < index; i++) if (before[i] === row) rank++;
  for (let i = 0; i < after.length; i++) if (after[i] === row && rank-- === 0) return i;
  return -1;
}

/** Source index of the row shown at `displayIndex` (same occurrence); -1 when it is not a source row (group header). */
export function sourceIndexOf(source: readonly unknown[], display: readonly unknown[], displayIndex: number): number {
  const at = relocate(display, displayIndex, source);
  return at >= 0 ? at : source.indexOf(display[displayIndex]);
}

/** `rows` with the element at `from` moved before/after the element at `to`. */
export function moveAt<R>(rows: readonly R[], from: number, to: number, position: RowMovePosition): R[] {
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice((to > from ? to - 1 : to) + (position === 'after' ? 1 : 0), 0, row);
  return next;
}

/**
 * `to`, or the nearest display index from `to` towards `from` that shows a
 * source row — "move to top/bottom" must land next to a row, not on a group
 * header (which has no source occurrence). `to` when there is none.
 */
export function towardSourceRow(
  source: readonly unknown[],
  display: readonly unknown[],
  to: number,
  from: number,
): number {
  const inSource = new Set(source);
  for (let i = to; i !== from && i >= 0 && i < display.length; i += from > to ? 1 : -1) {
    if (inSource.has(display[i])) return i;
  }
  return to;
}

/** Index of slot `index` once the element at `from` was spliced out and re-inserted at `to` (exact, even for repeated rows). */
export function shiftedIndex(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}

/**
 * Re-point `indices` (in place) at the same OCCURRENCES of `rows` once `before`
 * re-rendered as `after` — a drag in progress outlives renders (lazy children
 * arriving shift every row below; a repeated row object keeps its rank).
 * Empties `indices` when a row is no longer shown, so the drag can't drop it.
 * Returns a snapshot of `after` for the next render.
 */
export function trackRows(
  before: readonly unknown[],
  after: readonly unknown[],
  rows: readonly unknown[],
  indices: number[],
): unknown[] {
  // One pass per display (a selection can be large): rank each dragged slot in `before`,
  // then find the slot holding the same row at the same rank in `after`.
  const slotOf = new Map<number, number>(indices.map((i, k) => [i, k]));
  const wanted = new Map<unknown, Map<number, number>>(); // row → rank → k
  const rankAll = (display: readonly unknown[], visit: (row: unknown, rank: number, i: number) => void) => {
    const seen = new Map<unknown, number>();
    display.forEach((row, i) => {
      const rank = seen.get(row) ?? 0;
      seen.set(row, rank + 1);
      visit(row, rank, i);
    });
  };
  rankAll(before, (row, rank, i) => {
    const k = slotOf.get(i);
    if (k !== undefined && row === rows[k]) wanted.set(row, (wanted.get(row) ?? new Map()).set(rank, k));
  });
  const next = indices.map(() => -1);
  rankAll(after, (row, rank, i) => {
    const k = wanted.get(row)?.get(rank);
    if (k !== undefined) next[k] = i;
  });
  if (next.includes(-1)) indices.length = 0;
  else next.forEach((i, k) => (indices[k] = i));
  return [...after];
}

/**
 * Source order after a debounced keyboard move took the source occurrence at
 * `from` to display index `index`: placed after its new display predecessor,
 * else before its successor (a group header is not a source row). Neighbours
 * are ranked WITHOUT the moved occurrence on both sides, so passing another
 * copy of the same row object maps correctly. `null` when the move no longer
 * applies: the display was rebuilt under it (new data, a filter hiding the
 * rows), so the row left that slot or has no source neighbour.
 */
export function sourceOrderAfterMove<R>(
  source: readonly R[],
  display: readonly R[],
  from: number,
  index: number,
): R[] | null {
  const row = source[from];
  if (row === undefined || display[index] !== row) return null;
  const rest = source.filter((_, i) => i !== from);
  const shown = display.filter((_, i) => i !== index);
  const prev = index > 0 ? sourceIndexOf(rest, shown, index - 1) : -1;
  const at = prev >= 0 ? prev + 1 : index < shown.length ? sourceIndexOf(rest, shown, index) : -1;
  if (at < 0) return null;
  rest.splice(at, 0, row);
  return rest;
}

/** Occurrence ranks (per row) of the display rows at `at` — one pass. */
function ranksAt(display: readonly unknown[], at: readonly number[]): Map<unknown, Set<number>> {
  const targets = new Set(at);
  const seen = new Map<unknown, number>();
  const ranks = new Map<unknown, Set<number>>();
  display.forEach((row, i) => {
    const rank = seen.get(row) ?? 0;
    seen.set(row, rank + 1);
    if (targets.has(i)) ranks.set(row, (ranks.get(row) ?? new Set<number>()).add(rank));
  });
  return ranks;
}

/**
 * New source rows without the transferred rows (cross-grid `move`, source side),
 * shown at display `indices`; `null` = a row-model plugin vetoed it. Only those
 * occurrences go — other copies of the same row object stay.
 */
export function sourceWithout(
  source: readonly unknown[],
  display: readonly unknown[],
  rows: readonly unknown[],
  indices: readonly number[],
  resolve: ResolveMove,
): unknown[] | null {
  // The drag was invalidated (`trackRows`: a dragged row left the display) — remove nothing.
  if (rows.length > 0 && indices.length === 0) return null;
  const answer = resolve({ op: 'remove', rows: [...rows] });
  if (answer !== undefined) return answer ? answer.rows : null;
  // The display changed since the rows were picked up: fall back to their first occurrences.
  const shown = rows.length === indices.length && indices.every((i, k) => display[i] === rows[k]);
  const ranks = shown
    ? ranksAt(display, indices)
    : ranksAt(
        rows,
        rows.map((_, k) => k),
      );
  const seen = new Map<unknown, number>();
  return source.filter((row) => {
    const rank = seen.get(row) ?? 0;
    seen.set(row, rank + 1);
    return !ranks.get(row)?.has(rank);
  });
}

/** New source rows with `rows` inserted at display index `index` (cross-grid, target side); `null` = vetoed. */
export function sourceWith(
  source: readonly unknown[],
  display: readonly unknown[],
  rows: readonly unknown[],
  index: number,
  resolve: ResolveMove,
): unknown[] | null {
  const target = display[index] ?? null;
  const answer = resolve({ op: 'insert', rows: [...rows], target, position: 'before' });
  if (answer !== undefined) return answer ? answer.rows : null;
  // Insert only — a same-window `copy` may bring a row object this grid already holds.
  // A target that is not a source row (a group header) places it before the next one that is.
  const next = [...source];
  let at = -1;
  for (let i = index; target !== null && at < 0 && i < display.length; i++) at = sourceIndexOf(source, display, i);
  next.splice(at < 0 ? next.length : at, 0, ...rows);
  return next;
}

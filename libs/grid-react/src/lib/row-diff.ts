export interface RowUpdate {
  id: string;
  changes: Record<string, unknown>;
}

/**
 * Computes the minimal set of row updates needed when only values have changed
 * (same row count, same row IDs in the same order).
 *
 * Returns an array of updates (possibly empty) when the diff is value-only, or
 * `null` when a structural change is detected (different count, different IDs
 * in sequence, or initial load from an empty snapshot).
 *
 * Used by the DataGrid component to decide whether to call `grid.updateRows()`
 * (value-only, fast path) or `grid.rows =` (full replace). Kept as a pure
 * helper so it can be unit-tested without React.
 *
 * @since 3.5.0
 */
export function computeRowDiff<T>(next: T[], prev: T[], getId: (row: T) => string): RowUpdate[] | null {
  if (prev.length === 0 || next.length !== prev.length) return null;

  const updates: RowUpdate[] = [];
  for (let i = 0; i < next.length; i++) {
    const nextRow = next[i];
    const prevRow = prev[i];
    const nextId = getId(nextRow);
    const prevId = getId(prevRow);
    if (nextId !== prevId) return null;
    if (prevRow !== nextRow) {
      updates.push({ id: nextId, changes: nextRow as Record<string, unknown> });
    }
  }
  return updates;
}

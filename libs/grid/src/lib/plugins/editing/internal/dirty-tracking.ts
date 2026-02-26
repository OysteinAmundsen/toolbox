/**
 * Pure functions for dirty tracking baseline management.
 *
 * Extracted from EditingPlugin to keep the plugin under the 2,000 line target.
 * All functions are stateless — the caller owns the baseline `Map`.
 *
 * @internal
 */

// #region Types

/**
 * Detail for `dirty-change` custom events.
 */
export interface DirtyChangeDetail<T = unknown> {
  /** Row ID (from getRowId) */
  rowId: string;
  /** Current row data */
  row: T;
  /** Baseline (original) row data, or undefined for newly inserted rows */
  original: T | undefined;
  /**
   * Transition type:
   * - `'modified'` — row differs from baseline
   * - `'new'` — row was inserted via `insertRow()` and has no baseline
   * - `'reverted'` — row was reverted to baseline via `revertRow()`
   * - `'pristine'` — row was explicitly marked pristine via `markAsPristine()`
   */
  type: 'modified' | 'new' | 'reverted' | 'pristine';
}

/**
 * Result of getDirtyRows(): each entry has the row ID, original (baseline),
 * and current data.
 */
export interface DirtyRowEntry<T = unknown> {
  id: string;
  original: T;
  current: T;
}

// #endregion

// #region Baseline Capture

/**
 * Capture baselines for rows not already tracked (first-write-wins).
 *
 * Uses `structuredClone` for deep copy so nested objects cannot be mutated
 * through shared references.
 *
 * @param baselines - Map of rowId → deep-cloned baseline row data
 * @param rows - Rows to snapshot
 * @param getRowId - Function to resolve row ID (may throw; exceptions are swallowed)
 */
export function captureBaselines<T>(
  baselines: Map<string, T>,
  rows: readonly T[],
  getRowId: (row: T) => string | undefined,
): void {
  for (const row of rows) {
    try {
      const id = getRowId(row);
      if (id != null && !baselines.has(id)) {
        baselines.set(id, structuredClone(row));
      }
    } catch {
      // Row has no resolvable ID — skip
    }
  }
}

// #endregion

// #region Dirty Detection

/**
 * Check whether a row's current data differs from its baseline.
 *
 * Uses shallow property comparison (`!==`) on all enumerable keys — the same
 * strategy as EditingPlugin's `#hasRowChanged`.
 */
export function isRowDirty<T>(baselines: Map<string, T>, rowId: string, currentRow: T): boolean {
  const baseline = baselines.get(rowId);
  if (!baseline) return false; // No baseline → row is "new" or untracked
  return !shallowEqual(baseline, currentRow);
}

/**
 * Shallow comparison of two objects' enumerable properties.
 */
function shallowEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (aObj[key] !== bObj[key]) return false;
  }
  return true;
}

// #endregion

// #region State Transitions

/**
 * Mark a row as pristine: re-snapshot baseline from current data.
 *
 * After calling this, `isRowDirty` returns `false` for the row (until it
 * is edited again).
 */
export function markPristine<T>(baselines: Map<string, T>, rowId: string, currentRow: T): void {
  baselines.set(rowId, structuredClone(currentRow));
}

/**
 * Get the original (baseline) row data as a deep clone.
 *
 * Returns `undefined` if no baseline exists (e.g. newly inserted row).
 */
export function getOriginalRow<T>(baselines: Map<string, T>, rowId: string): T | undefined {
  const baseline = baselines.get(rowId);
  return baseline ? structuredClone(baseline) : undefined;
}

/**
 * Revert a row to its baseline values by mutating the current row in-place.
 *
 * Returns `true` if a baseline existed and the row was reverted, `false` otherwise.
 */
export function revertToBaseline<T>(baselines: Map<string, T>, rowId: string, currentRow: T): boolean {
  const baseline = baselines.get(rowId);
  if (!baseline) return false;
  const baselineObj = baseline as Record<string, unknown>;
  const currentObj = currentRow as Record<string, unknown>;
  for (const key of Object.keys(baselineObj)) {
    currentObj[key] = baselineObj[key];
  }
  return true;
}

// #endregion

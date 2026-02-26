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
 * Uses deep property comparison so that `structuredClone`'d baselines
 * with nested objects/arrays/Dates compare correctly.
 */
export function isRowDirty<T>(baselines: Map<string, T>, rowId: string, currentRow: T): boolean {
  const baseline = baselines.get(rowId);
  if (!baseline) return false; // No baseline → row is "new" or untracked
  return !deepEqual(baseline, currentRow);
}

/**
 * Check whether a single cell (field) differs from its baseline value.
 *
 * Returns `false` when no baseline exists for the row.
 */
export function isCellDirty<T>(baselines: Map<string, T>, rowId: string, currentRow: T, field: string): boolean {
  const baseline = baselines.get(rowId);
  if (!baseline) return false;
  const baselineValue = (baseline as Record<string, unknown>)[field];
  const currentValue = (currentRow as Record<string, unknown>)[field];
  return !deepEqual(baselineValue, currentValue);
}

/**
 * Deep comparison of two values. Handles primitives, plain objects, arrays,
 * and Dates — the value types produced by `structuredClone` on row data.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  // Date comparison
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();

  // Array comparison
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Object comparison
  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keysA = Object.keys(aObj);
    const keysB = Object.keys(bObj);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(aObj[key], bObj[key])) return false;
    }
    return true;
  }

  return false;
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

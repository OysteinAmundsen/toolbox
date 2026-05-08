/**
 * Value Accessor Module
 *
 * Single source of truth for resolving a column's value from a row.
 *
 * Resolution precedence:
 *   1. `column.valueAccessor({ row, column, rowIndex })` — when defined
 *   2. `row[column.field]` — direct field read (default)
 *
 * Per-column escape hatches (`sortComparator`, `filterValue`) still take
 * precedence over the accessor — the accessor is the *default* value source,
 * never an override. See {@link BaseColumnConfig.valueAccessor}.
 *
 * Performance: results are memoized per (row identity, column field) using a
 * `WeakMap`. Row identity changes (immutable updates) invalidate naturally;
 * in-place mutations must call {@link invalidateAccessorCache} on the row.
 */

import type { ColumnConfig } from '../types';

// Box-wrapped values let the cache-hit path do a SINGLE `Map.get` instead of
// `has()` + `get()`. A truthy box means cache hit (even when the cached value
// itself is `undefined` / `null` / `0` / `''`).
interface CacheBox {
  v: unknown;
}
const accessorCache = new WeakMap<object, Map<string, CacheBox>>();

/**
 * Resolve the cell value for a column, honoring `valueAccessor` if defined,
 * otherwise reading `row[column.field]`.
 *
 * @param row - The row object
 * @param column - The column definition
 * @param rowIndex - The visible row index (passed to accessor; defaults to -1)
 * @returns The resolved cell value
 *
 * @example
 * ```typescript
 * const value = resolveCellValue(row, column);
 * ```
 * @since 2.2.0
 */
export function resolveCellValue<TRow>(row: TRow, column: ColumnConfig<TRow>, rowIndex = -1): unknown {
  if (!column.valueAccessor) {
    return (row as Record<string, unknown> | null | undefined)?.[column.field];
  }
  // Non-object rows (primitives, null) bypass the cache.
  if (typeof row !== 'object' || row === null) {
    return column.valueAccessor({ row, column, rowIndex });
  }
  // After the guard above, `row` is provably a non-null object. Single
  // assertion (no `as unknown as`) bridges the generic `TRow` to the WeakMap
  // key type; see `.github/instructions/typescript-conventions.instructions.md`.
  const rowKey = row as object;
  const key = column.field;
  let cellMap = accessorCache.get(rowKey);
  if (cellMap) {
    const box = cellMap.get(key);
    if (box !== undefined) return box.v;
  } else {
    cellMap = new Map();
    accessorCache.set(rowKey, cellMap);
  }
  const value = column.valueAccessor({ row, column, rowIndex });
  cellMap.set(key, { v: value });
  return value;
}

/**
 * Invalidate cached accessor values for a row (after in-place mutation),
 * a single (row, field) pair, or — when called with no argument — clear
 * the entire cache. Immutable updates auto-invalidate via row identity.
 *
 * Edit/transaction paths that mutate row objects in-place must call this.
 * @since 2.2.0
 */
export function invalidateAccessorCache(row?: object, field?: string): void {
  if (!row) {
    // WeakMap can't be cleared in O(1); the GC handles unreferenced rows.
    // For an explicit full reset, callers should mutate row identities instead.
    return;
  }
  if (!field) {
    accessorCache.delete(row);
    return;
  }
  accessorCache.get(row)?.delete(field);
}

/**
 * Build a `(value, row) => unknown` extractor compatible with
 * `filterValue`-style APIs from a column's `valueAccessor`. Returns `undefined`
 * when the column has no accessor.
 *
 * Used by FilteringPlugin to bridge the two API shapes without duplicating
 * cache lookups.
 */
export function accessorAsFilterValue<TRow>(
  column: ColumnConfig<TRow>,
): ((value: unknown, row: TRow) => unknown) | undefined {
  if (!column.valueAccessor) return undefined;
  return (_value, row) => resolveCellValue(row, column);
}

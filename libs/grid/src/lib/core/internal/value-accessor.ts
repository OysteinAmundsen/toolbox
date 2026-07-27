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

// #region Nested dotted-path field access (issue #438)

// Prototype-pollution guard applied to every path segment on read AND write.
// Uses explicit `===` comparisons (not a Set lookup) so static analyzers
// recognize the barrier guarding the assignments in `setByPath`/`writeCellField`.
function isUnsafeKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

// Parsed dotted-path cache: field string → segments. Only **dotted** fields are
// cached; a plain key is recognised by a single `indexOf` scan, which is cheaper
// than hashing the string for a Map probe and — critically — keeps the cache
// from growing without bound when a plugin mints synthetic field names at
// runtime (PivotPlugin derives one column per distinct pivot value).
const fieldPathCache = new Map<string, readonly string[]>();

/**
 * Parse a column `field` into path segments, or `null` when it is a plain
 * top-level key (contains no `.`). Dotted results are memoized.
 *
 * @param field - The column field key (may be a dotted path like `a.b.c`).
 * @returns Frozen segment array for dotted paths, else `null`.
 * @since 3.3.0
 */
export function parseFieldPath(field: string): readonly string[] | null {
  if (field.indexOf('.') === -1) return null;
  let segments = fieldPathCache.get(field);
  if (segments === undefined) {
    segments = Object.freeze(field.split('.'));
    fieldPathCache.set(field, segments);
  }
  return segments;
}

/**
 * Read a nested value from `row` by pre-parsed path segments. Returns
 * `undefined` on any nullish/non-object hop. Prototype-pollution safe.
 *
 * @since 3.3.0
 */
export function getByPath(row: unknown, path: readonly string[]): unknown {
  let cur = row as Record<string, unknown> | null | undefined;
  for (let i = 0; i < path.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const seg = path[i];
    if (isUnsafeKey(seg)) return undefined;
    cur = cur[seg] as Record<string, unknown>;
  }
  return cur;
}

/**
 * Write `value` into `row` at the location described by pre-parsed path
 * segments. Walks **existing** objects only — it does NOT fabricate missing
 * intermediates — and returns `true` only when the write happened.
 * Prototype-pollution safe (every segment is guarded).
 *
 * @since 3.3.0
 */
export function setByPath(row: unknown, path: readonly string[], value: unknown): boolean {
  if (row == null || typeof row !== 'object') return false;
  let cur = row as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (isUnsafeKey(seg)) return false;
    const next = cur[seg];
    if (next == null || typeof next !== 'object') return false;
    cur = next as Record<string, unknown>;
  }
  const last = path[path.length - 1];
  if (isUnsafeKey(last)) return false;
  cur[last] = value;
  return true;
}

/**
 * Read the raw stored value for `field` from `row`, honoring nested dotted
 * paths — the non-accessor counterpart to {@link resolveCellValue}.
 *
 * Resolution rules (back-compat critical, see `grid-core.md` DECIDED #438):
 * 1. Plain field (no `.`) → direct `row[field]` (identical to legacy path),
 *    except prototype-polluting keys (`__proto__`/`constructor`/`prototype`)
 *    which return `undefined` — symmetric with {@link writeCellField}.
 * 2. Dotted field whose literal key is an **own property** of `row` → that
 *    flat value wins (preserves synthetic-key rows that really store `'a.b'`).
 * 3. Otherwise → nested traversal via {@link getByPath}.
 *
 * @since 3.3.0
 */
export function readCellField(row: unknown, field: string): unknown {
  if (row == null) return undefined;
  const path = parseFieldPath(field);
  const r = row as Record<string, unknown>;
  if (path === null) return isUnsafeKey(field) ? undefined : r[field];
  if (Object.prototype.hasOwnProperty.call(r, field)) return r[field];
  return getByPath(r, path);
}

/**
 * A precompiled reader that extracts one column's raw value from a row.
 *
 * @since 3.4.0
 */
export type FieldReader = (row: unknown) => unknown;

/**
 * Build a {@link FieldReader} for `field`, resolving the plain / unsafe /
 * dotted decision **once** instead of on every cell read.
 *
 * Hoist the reader out of any per-row loop (sort comparators, compiled filter
 * predicates, aggregators, export writers). Semantics are identical to
 * {@link readCellField}; only the dispatch is paid up front.
 *
 * @param field - The column field key (may be a dotted path like `a.b.c`).
 * @returns A single-argument reader closure.
 *
 * @example
 * ```typescript
 * const read = createFieldReader(column.field);
 * rows.sort((a, b) => compare(read(a), read(b)));
 * ```
 * @since 3.4.0
 */
export function createFieldReader(field: string): FieldReader {
  const path = parseFieldPath(field);
  if (path === null) {
    if (isUnsafeKey(field)) return () => undefined;
    return (row) => (row == null ? undefined : (row as Record<string, unknown>)[field]);
  }
  return (row) => {
    if (row == null) return undefined;
    const r = row as Record<string, unknown>;
    // A literal own key containing a dot wins over traversal (see readCellField).
    if (Object.prototype.hasOwnProperty.call(r, field)) return r[field];
    return getByPath(r, path);
  };
}

/**
 * Whether `field` is a plain, safe top-level key — i.e. `row[field]` is exactly
 * equivalent to {@link readCellField} and callers may inline the property read.
 *
 * Used by benchmarked hot loops (compiled filter predicates) that keep a
 * hand-inlined fast path and only fall back to a {@link FieldReader} for the
 * dotted/unsafe minority.
 *
 * @since 3.4.0
 */
export function isPlainField(field: string): boolean {
  return field.indexOf('.') === -1 && !isUnsafeKey(field);
}

/**
 * Write `value` into `row` for `field`, honoring nested dotted paths and the
 * same back-compat precedence as {@link readCellField}. Returns `true` when a
 * write occurred. Prototype-pollution safe.
 *
 * @since 3.3.0
 */
export function writeCellField(row: unknown, field: string, value: unknown): boolean {
  if (row == null || typeof row !== 'object') return false;
  const path = parseFieldPath(field);
  const r = row as Record<string, unknown>;
  if (path === null) {
    if (isUnsafeKey(field)) return false;
    r[field] = value;
    return true;
  }
  // A literal own key containing a dot wins over traversal (symmetric with
  // readCellField). Such a key always contains `.`, so it can never be an
  // unsafe prototype key.
  if (Object.prototype.hasOwnProperty.call(r, field)) {
    r[field] = value;
    return true;
  }
  return setByPath(r, path, value);
}

// #endregion

/**
 * Resolve the cell value for a column, honoring `valueAccessor` if defined,
 * otherwise reading `row[column.field]` (with nested dotted-path support).
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
    return readCellField(row, column.field);
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

import type { ColumnConfigMap, ColumnInternal, ColumnType, InferredColumnResult, PrimitiveColumnType } from '../types';
/**
 * Best-effort primitive type inference for a cell value used during automatic column generation.
 */
function inferType(value: any): PrimitiveColumnType {
  if (value == null) return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value) && !isNaN(Date.parse(value))) return 'date';
  return 'string';
}
/**
 * Derive column definitions from provided configuration or by inspecting the first row of data.
 * Returns both the resolved column array and a field->type map.
 */
export function inferColumns<TRow extends Record<string, unknown>>(
  rows: TRow[],
  provided?: ColumnConfigMap<TRow>,
): InferredColumnResult<TRow> {
  if (provided && provided.length) {
    const typeMap: Record<string, ColumnType> = {};
    provided.forEach((col) => {
      if (col.type) typeMap[col.field] = col.type;
    });
    return { columns: provided, typeMap };
  }
  const sample = rows[0] || ({} as TRow);
  const columns: ColumnConfigMap<TRow> = Object.keys(sample).map((k) => {
    const v = (sample as Record<string, unknown>)[k];
    const type = inferType(v);
    return { field: k as keyof TRow & string, header: k.charAt(0).toUpperCase() + k.slice(1), type };
  });
  const typeMap: Record<string, ColumnType> = {};
  columns.forEach((c) => {
    typeMap[c.field] = c.type || 'string';
  });
  return { columns, typeMap };
}
export { inferType };

/**
 * Overlay explicitly provided columns onto the full inferred column set (used by
 * `columnInference: 'merge'`).
 *
 * Semantics (opposite of {@link mergeColumns}, which only *supplements*):
 * - Canonical order is the inferred data-key order.
 * - A provided column whose `field` matches an inferred column overrides it
 *   in place (provided wins for every defined property; inferred fills gaps
 *   such as `header`/`type`), keeping its data position.
 * - Provided columns whose `field` is not present in the data are appended at
 *   the end as computed columns, preserving their provided order.
 */
export function overlayInferred<T = unknown>(
  inferred: ColumnInternal<T>[],
  provided: ColumnInternal<T>[],
): ColumnInternal<T>[] {
  if (!provided.length) return inferred;
  const byField = new Map<string, ColumnInternal<T>>();
  for (const c of provided) byField.set(c.field as string, c);
  const inferredFields = new Set(inferred.map((c) => c.field as string));

  const result: ColumnInternal<T>[] = inferred.map((inf) => {
    const prov = byField.get(inf.field as string);
    if (!prov) return inf;
    // Provided wins for every defined key; inferred fills the gaps (header, type, ...).
    const merged = { ...inf };
    for (const [key, value] of Object.entries(prov)) {
      if (value !== undefined) Object.assign(merged, { [key]: value });
    }
    return merged;
  });

  // Append provided columns for fields absent from the data (computed columns).
  for (const c of provided) {
    if (!inferredFields.has(c.field as string)) result.push(c);
  }
  return result;
}

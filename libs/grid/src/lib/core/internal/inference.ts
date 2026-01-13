import type { ColumnConfigMap, InferredColumnResult, PrimitiveColumnType } from '../types';
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
    const typeMap: Record<string, PrimitiveColumnType> = {};
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
  const typeMap: Record<string, PrimitiveColumnType> = {};
  columns.forEach((c) => {
    typeMap[c.field] = c.type || 'string';
  });
  return { columns, typeMap };
}
export { inferType };

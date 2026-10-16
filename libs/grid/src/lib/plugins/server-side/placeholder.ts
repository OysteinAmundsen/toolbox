/**
 * ServerSide loading placeholders — the synthetic rows that stand in for nodes
 * whose block has not arrived yet.
 */
import type { LoadingPlaceholderRow } from './types';

/**
 * Create the placeholder for node `index`. `__rowCacheKey` keys the variable-height
 * cache so a consumer `getRowId` is never consulted for a placeholder.
 */
export function createLoadingPlaceholder(index: number): LoadingPlaceholderRow {
  return { __loading: true, __index: index, __rowCacheKey: `__loading:${index}` } as LoadingPlaceholderRow;
}

/**
 * Type guard for ServerSide loading placeholders.
 *
 * With the default `placeholderRendering: 'loading-row'` the grid renders placeholders
 * itself, so column renderers, value accessors, `format` and `rowClass` never see
 * them. Use this guard where placeholders still reach your code: with
 * `placeholderRendering: 'columns'`, in a `sortComparator` under `sortMode: 'local'`,
 * or when reading `grid.rows` directly.
 *
 * @example
 * ```ts
 * import { isLoadingPlaceholder } from '@toolbox-web/grid/plugins/server-side';
 *
 * const loaded = grid.rows.filter((row) => !isLoadingPlaceholder(row));
 * ```
 * @since 3.9.1
 */
export function isLoadingPlaceholder(row: unknown): row is LoadingPlaceholderRow {
  return (
    row != null &&
    typeof row === 'object' &&
    (row as { __loading?: unknown }).__loading === true &&
    typeof (row as { __index?: unknown }).__index === 'number'
  );
}

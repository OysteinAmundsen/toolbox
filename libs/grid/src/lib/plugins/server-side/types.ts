import type { ServerSideDataSource } from './datasource-types';

// Re-export unified types for convenience
export type {
  DataRequestModel,
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  DataSourceLoadingDetail,
  FetchChildrenQuery,
  GetChildRowsParams,
  GetChildRowsResult,
  GetRowsParams,
  GetRowsResult,
  ServerSideDataSource,
  Subscribable,
  ViewportMappingQuery,
  ViewportMappingResponse,
} from './datasource-types';

/**
 * Configuration for the server-side data plugin.
 *
 * Controls how the grid fetches, caches, and paginates data from a remote source.
 * The grid requests data in **blocks** (contiguous node ranges) as the user scrolls,
 * caching them locally to avoid redundant network requests.
 *
 * @example
 * ```typescript
 * new ServerSidePlugin({
 *   pageSize: 100,
 *   maxConcurrentRequests: 2,
 * })
 * ```
 * @since 0.1.1
 */
export interface ServerSideConfig {
  /**
   * Number of nodes requested per `getRows()` call. The same value is surfaced
   * on `params.pageSize` inside the callback, so backends that expect an
   * explicit page-size query parameter can forward it directly. Larger values
   * reduce request count at the cost of longer per-request latency.
   * @default 100
   */
  pageSize?: number;
  /**
   * Maximum number of concurrent `getRows()` requests.
   * Limits how many blocks can be fetched simultaneously during fast scrolling.
   * Set to 1 for strict sequential loading; higher values improve perceived performance.
   * @default 2
   */
  maxConcurrentRequests?: number;
  /**
   * Prefetch slack in **node count** (rows). When `> 0`, blocks are loaded as
   * soon as the user is within `loadThreshold` rows of an unloaded block,
   * rather than only when the visible window enters it. This reduces the
   * number of placeholder rows the user sees during gentle scrolling at the
   * cost of slightly more eager fetching.
   *
   * The threshold is applied symmetrically: the viewport is expanded by
   * `loadThreshold` rows in both directions before block coverage is
   * computed. The `maxConcurrentRequests` cap and per-block dedup still
   * apply, so a large threshold during fast scrolling will not flood the
   * server with requests.
   *
   * A reasonable starting point is `pageSize / 2`. Values larger than
   * `pageSize` will eagerly request 2+ blocks ahead, which can hurt
   * perceived performance with slow backends.
   *
   * @default 0 (fetch only when the visible window enters an unloaded block)
   */
  loadThreshold?: number;
  /**
   * Data source for server-side loading.
   * When provided, the plugin auto-initializes on attach — no need to call `setDataSource()`.
   *
   * @example
   * ```typescript
   * features: {
   *   serverSide: {
   *     pageSize: 50,
   *     dataSource: {
   *       async getRows(params) {
   *         const res = await fetch(`/api/data?start=${params.startNode}&end=${params.endNode}`);
   *         return res.json();
   *       },
   *     },
   *   },
   * }
   * ```
   */
  dataSource?: ServerSideDataSource;
  /**
   * How sort changes affect the cache.
   * - `'server'` (default): purge cache and refetch via `getRows({ sortModel })`.
   *   Use when the backend supports the requested sort shape natively.
   *   MultiSortPlugin does not re-sort the returned rows locally — the data
   *   source's order (and its loading placeholders' block positions) is shown as-is.
   * - `'local'`: keep the loaded blocks; sort the loaded rows in-place via
   *   the active sort plugin (MultiSort or core sort). `sortModel` is **not**
   *   sent on subsequent block fetches. Loading placeholder rows
   *   (see `isLoadingPlaceholder()`) are pinned to the end regardless of direction.
   *
   * Use `'local'` when the server cannot sort by every column the user can sort
   * (e.g. APIs that only support a single sort field, or no sort at all).
   * Ignored for the `data-src` URL source, which always sorts locally.
   *
   * @default 'server'
   */
  sortMode?: 'server' | 'local';
  /**
   * How filter changes affect the cache.
   * - `'server'` (default): purge cache and refetch via `getRows({ filterModel })`.
   *   FilteringPlugin does not re-filter the returned rows locally — the data
   *   source's result (and its loading placeholders) is shown as-is.
   * - `'local'`: keep the loaded blocks; filter only the rows currently in cache
   *   via FilteringPlugin's normal pipeline. `filterModel` is **not** sent on
   *   subsequent block fetches. Loading placeholders (see `isLoadingPlaceholder()`)
   *   always pass the filter until their block loads.
   *
   * Ignored for the `data-src` URL source, which always filters locally.
   *
   * In `'local'` mode the user only filters the currently loaded subset —
   * scrolling further loads more blocks which then re-enter the local filter.
   *
   * @default 'server'
   */
  filterMode?: 'server' | 'local';
  /**
   * How rows whose block is still loading are rendered.
   * - `'loading-row'` (default): the grid renders each placeholder itself, as a
   *   full-width row in the core row-loading state (`.tbw-row-loading`,
   *   `aria-busy="true"`, the `.tbw-row-loading-overlay` spinner). Column
   *   renderers, `format`, `cellClass`, `rowClass` and a Responsive
   *   `cardRenderer` are not called for it, and context menus (mouse or
   *   keyboard) do not open on it.
   * - `'columns'`: placeholders take the normal cell render path, so your column
   *   renderers and callbacks receive them and can draw a custom loading look.
   *   Detect them with `isLoadingPlaceholder()`.
   *
   * In both modes a placeholder gets an internal row id (`__loading:<index>`),
   * so `gridConfig.getRowId` and a `rowHeight` function are never called with one, and `valueAccessor` /
   * `filterValue` are never called with one (the value is `undefined`).
   *
   * @default 'loading-row'
   * @since 3.9.1
   */
  placeholderRendering?: 'loading-row' | 'columns';
}

/**
 * Synthetic row that stands in for a node whose block has not loaded yet.
 * `__index` is the node index. The object is replaced by the real row when the
 * block arrives. Detect it with `isLoadingPlaceholder()`.
 * @since 3.9.1
 */
export interface LoadingPlaceholderRow {
  readonly __loading: true;
  /** Node index (position in the server-side row model). */
  readonly __index: number;
}

export interface ServerSideState {
  dataSource: ServerSideDataSource | null;
  totalNodeCount: number;
  loadedBlocks: Map<number, unknown[]>;
  loadingBlocks: Set<number>;
  lastRequestId: number;
  /** Scroll debounce timer for scroll-end detection */
  scrollDebounceTimer?: ReturnType<typeof setTimeout>;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    serverSide: import('./server-side-plugin').ServerSidePlugin;
  }
}

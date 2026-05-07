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
    ViewportMappingResponse
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
 *   cacheBlockSize: 200,
 *   maxConcurrentRequests: 2,
 * })
 * ```
 * @since 0.1.1
 */
export interface ServerSideConfig {
  /**
   * Number of nodes to request per fetch.
   * This determines the `endNode - startNode` range passed to `getRows()`.
   * Smaller values mean faster initial loads but more frequent requests while scrolling.
   * @default 100
   */
  pageSize?: number;
  /**
   * Number of nodes kept in each cache block.
   * When a block is evicted (e.g. scrolled far away), re-scrolling back triggers a new fetch.
   * Should be ≥ `pageSize`; larger values reduce re-fetches at the cost of memory.
   * @default 200
   */
  cacheBlockSize?: number;
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
   * `cacheBlockSize` will eagerly request 2+ blocks ahead, which can hurt
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
   * - `'local'`: keep the loaded blocks; sort the loaded rows in-place via
   *   the active sort plugin (MultiSort or core sort). `sortModel` is **not**
   *   sent on subsequent block fetches. Placeholder rows (`__loading: true`)
   *   are pinned to the end regardless of direction.
   *
   * Use `'local'` when the server cannot sort by every column the user can sort
   * (e.g. APIs that only support a single sort field, or no sort at all).
   *
   * @default 'server'
   */
  sortMode?: 'server' | 'local';
  /**
   * How filter changes affect the cache.
   * - `'server'` (default): purge cache and refetch via `getRows({ filterModel })`.
   * - `'local'`: keep the loaded blocks; filter only the rows currently in cache
   *   via FilteringPlugin's normal pipeline. `filterModel` is **not** sent on
   *   subsequent block fetches.
   *
   * In `'local'` mode the user only filters the currently loaded subset —
   * scrolling further loads more blocks which then re-enter the local filter.
   *
   * @default 'server'
   */
  filterMode?: 'server' | 'local';
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
    serverSide: import('./ServerSidePlugin').ServerSidePlugin;
  }
}

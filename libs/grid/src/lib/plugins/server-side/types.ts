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
 *   cacheBlockSize: 200,
 *   maxConcurrentRequests: 2,
 * })
 * ```
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

/**
 * Position Cache for Variable Row Height Virtualization
 *
 * This module implements the position cache system for variable row heights.
 * It maintains two separate caches:
 *
 * 1. **Position Cache** (index-based): Maps row index → {offset, height, measured}
 *    - Rebuilt when row count changes (expand/collapse, filter)
 *    - Used for scroll position → row index lookups (binary search)
 *
 * 2. **Height Cache** (identity-based): Maps row identity → height
 *    - Persists across expand/collapse
 *    - Uses rowId string keys when available, WeakMap otherwise
 *    - Synthetic rows use __rowCacheKey for stable identity
 */

// #region Types

/**
 * Position entry for a single row in the position cache.
 * @category Plugin Development
 */
export interface RowPosition {
  /** Cumulative offset from top in pixels */
  offset: number;
  /** Row height in pixels */
  height: number;
  /** Whether this is a measured value (true) or estimate (false) */
  measured: boolean;
}

/**
 * Height cache that persists row heights across position cache rebuilds.
 * Uses dual storage: Map for string keys (rowId, __rowCacheKey) and WeakMap for object refs.
 * @category Plugin Development
 */
export interface HeightCache {
  /** Heights keyed by string (for synthetic rows with __rowCacheKey or rowId-keyed rows) */
  byKey: Map<string, number>;
  /** Heights keyed by object reference (for data rows without rowId) */
  byRef: WeakMap<object, number>;
}

/**
 * Configuration for the position cache.
 */
export interface PositionCacheConfig<T = unknown> {
  /** Function to get row ID (if configured) */
  rowId?: (row: T) => string | number;
}

// #endregion

// #region Height Cache Operations

/**
 * Create a new empty height cache.
 */
export function createHeightCache(): HeightCache {
  return {
    byKey: new Map(),
    byRef: new WeakMap(),
  };
}

/**
 * Get the cache key for a row.
 * Returns string for synthetic rows (__rowCacheKey) or rowId-keyed rows,
 * or the row object itself for WeakMap lookup.
 */
export function getRowCacheKey<T>(row: T, rowId?: (row: T) => string | number): string | T {
  if (!row || typeof row !== 'object') return row;

  // 1. Synthetic rows: plugins MUST add __rowCacheKey
  if ('__rowCacheKey' in row) {
    return (row as { __rowCacheKey: string }).__rowCacheKey;
  }

  // 2. rowId property directly on the row (common pattern)
  if ('rowId' in row && (row as { rowId: string | number }).rowId != null) {
    return `id:${(row as { rowId: string | number }).rowId}`;
  }

  // 3. User-provided rowId function (if configured)
  if (rowId) {
    return `id:${rowId(row)}`;
  }

  // 4. Object identity (for WeakMap)
  return row;
}

/**
 * Get cached height for a row.
 * @returns Cached height or undefined if not cached
 */
export function getCachedHeight<T>(
  cache: HeightCache,
  row: T,
  rowId?: (row: T) => string | number,
): number | undefined {
  const key = getRowCacheKey(row, rowId);

  if (typeof key === 'string') {
    return cache.byKey.get(key);
  }

  // Object key - use WeakMap
  if (key && typeof key === 'object') {
    return cache.byRef.get(key);
  }

  return undefined;
}

/**
 * Set cached height for a row.
 */
export function setCachedHeight<T>(
  cache: HeightCache,
  row: T,
  height: number,
  rowId?: (row: T) => string | number,
): void {
  const key = getRowCacheKey(row, rowId);

  if (typeof key === 'string') {
    cache.byKey.set(key, height);
  } else if (key && typeof key === 'object') {
    cache.byRef.set(key, height);
  }
}

/**
 * Clear the height cache.
 */
export function clearHeightCache(cache: HeightCache): void {
  cache.byKey.clear();
  // WeakMap entries are automatically garbage collected
  // Create a new WeakMap to clear it
  cache.byRef = new WeakMap();
}

// #endregion

// #region Position Cache Operations

/**
 * Initialize position cache with estimated heights.
 * All rows start with the default/estimated height.
 *
 * @param rowCount - Total number of rows
 * @param estimatedHeight - Estimated height for all rows
 * @returns Array of RowPosition entries
 */
export function initPositionCache(rowCount: number, estimatedHeight: number): RowPosition[] {
  const cache: RowPosition[] = new Array(rowCount);
  let offset = 0;

  for (let i = 0; i < rowCount; i++) {
    cache[i] = {
      offset,
      height: estimatedHeight,
      measured: false,
    };
    offset += estimatedHeight;
  }

  return cache;
}

/**
 * Rebuild position cache preserving known heights from height cache.
 * Called when row count changes (expand/collapse, filter, data change).
 *
 * @param rows - Array of row data
 * @param heightCache - Height cache with persisted measurements
 * @param estimatedHeight - Estimated height for unmeasured rows
 * @param config - Position cache configuration
 * @param getPluginHeight - Optional function to get height from plugins
 * @returns New position cache
 */
export function rebuildPositionCache<T>(
  rows: T[],
  heightCache: HeightCache,
  estimatedHeight: number,
  config: PositionCacheConfig<T>,
  getPluginHeight?: (row: T, index: number) => number | undefined,
): RowPosition[] {
  const cache: RowPosition[] = new Array(rows.length);
  let offset = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Height resolution order:
    // 1. Plugin's getRowHeight() (for synthetic rows with known heights)
    let height = getPluginHeight?.(row, i);
    let measured = height !== undefined;

    // 2. Cached height from previous measurements
    if (height === undefined) {
      height = getCachedHeight(heightCache, row, config.rowId);
      measured = height !== undefined;
    }

    // 3. Fall back to estimate
    if (height === undefined) {
      height = estimatedHeight;
      measured = false;
    }

    cache[i] = { offset, height, measured };
    offset += height;
  }

  return cache;
}

/**
 * Update a single row's height in the position cache.
 * Recalculates offsets for all subsequent rows.
 *
 * @param cache - Position cache to update
 * @param index - Row index to update
 * @param newHeight - New measured height
 */
export function updateRowHeight(cache: RowPosition[], index: number, newHeight: number): void {
  if (index < 0 || index >= cache.length) return;

  const entry = cache[index];
  const heightDiff = newHeight - entry.height;

  if (heightDiff === 0) return;

  // Update this row
  entry.height = newHeight;
  entry.measured = true;

  // Recalculate offsets for all subsequent rows
  for (let i = index + 1; i < cache.length; i++) {
    cache[i].offset += heightDiff;
  }
}

/**
 * Get total content height from position cache.
 *
 * @param cache - Position cache
 * @returns Total height in pixels
 */
export function getTotalHeight(cache: RowPosition[]): number {
  if (cache.length === 0) return 0;
  const last = cache[cache.length - 1];
  return last.offset + last.height;
}

// #endregion

// #region Binary Search

/**
 * Find the row index at a given scroll offset using binary search.
 * Returns the index of the row that contains the given pixel offset.
 *
 * @param cache - Position cache
 * @param targetOffset - Scroll offset in pixels
 * @returns Row index at that offset, or -1 if cache is empty
 */
export function getRowIndexAtOffset(cache: RowPosition[], targetOffset: number): number {
  if (cache.length === 0) return -1;
  if (targetOffset <= 0) return 0;

  let low = 0;
  let high = cache.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const entry = cache[mid];
    const entryEnd = entry.offset + entry.height;

    if (targetOffset < entry.offset) {
      high = mid - 1;
    } else if (targetOffset >= entryEnd) {
      low = mid + 1;
    } else {
      // targetOffset is within this row
      return mid;
    }
  }

  // Return the closest row (low will be just past the target)
  return Math.max(0, Math.min(low, cache.length - 1));
}

/**
 * Get the offset for a given row index.
 *
 * @param cache - Position cache
 * @param index - Row index
 * @returns Offset in pixels, or 0 if out of bounds
 */
export function getRowOffset(cache: RowPosition[], index: number): number {
  if (index < 0 || index >= cache.length) return 0;
  return cache[index].offset;
}

/**
 * Get the height for a given row index.
 *
 * @param cache - Position cache
 * @param index - Row index
 * @param defaultHeight - Default height if out of bounds
 * @returns Height in pixels
 */
export function getRowHeight(cache: RowPosition[], index: number, defaultHeight: number): number {
  if (index < 0 || index >= cache.length) return defaultHeight;
  return cache[index].height;
}

// #endregion

// #region Statistics

/**
 * Calculate the average measured height.
 * Used for estimating unmeasured rows.
 *
 * @param cache - Position cache
 * @param defaultHeight - Default height to use if no measurements
 * @returns Average measured height
 */
export function calculateAverageHeight(cache: RowPosition[], defaultHeight: number): number {
  let totalHeight = 0;
  let measuredCount = 0;

  for (const entry of cache) {
    if (entry.measured) {
      totalHeight += entry.height;
      measuredCount++;
    }
  }

  return measuredCount > 0 ? totalHeight / measuredCount : defaultHeight;
}

/**
 * Count how many rows have been measured.
 *
 * @param cache - Position cache
 * @returns Number of measured rows
 */
export function countMeasuredRows(cache: RowPosition[]): number {
  let count = 0;
  for (const entry of cache) {
    if (entry.measured) count++;
  }
  return count;
}

/**
 * Update estimates for unmeasured rows based on current average.
 * This should be called after measuring new rows to improve estimates.
 *
 * @param cache - Position cache to update
 * @param newAverage - New average height to apply to unmeasured rows
 */
export function updateEstimates(cache: RowPosition[], newAverage: number): void {
  let offset = 0;

  for (let i = 0; i < cache.length; i++) {
    const entry = cache[i];
    entry.offset = offset;

    if (!entry.measured) {
      entry.height = newAverage;
    }

    offset += entry.height;
  }
}

// #endregion
// #region Row Measurement

/**
 * Result of measuring rendered row heights.
 */
export interface RowMeasurementResult {
  /** Whether any heights changed */
  hasChanges: boolean;
  /** Updated measured row count */
  measuredCount: number;
  /** Updated average height */
  averageHeight: number;
}

/**
 * Context for measuring rendered rows.
 */
export interface RowMeasurementContext<T> {
  /** Position cache to update */
  positionCache: RowPosition[];
  /** Height cache for persistence */
  heightCache: HeightCache;
  /** Row data array */
  rows: T[];
  /** Default row height */
  defaultHeight: number;
  /** Start index of rendered window */
  start: number;
  /** End index of rendered window (exclusive) */
  end: number;
  /** Function to get plugin height for a row */
  getPluginHeight?: (row: T, index: number) => number | undefined;
  /** Function to get row ID for height cache keying */
  getRowId?: (row: T) => string | number;
}

/**
 * Measure rendered row heights from DOM elements and update caches.
 * Returns measurement statistics for updating virtualization state.
 *
 * @param context - Measurement context with all dependencies
 * @param rowElements - NodeList of rendered row elements
 * @returns Measurement result with flags and statistics
 */
export function measureRenderedRowHeights<T>(
  context: RowMeasurementContext<T>,
  rowElements: NodeListOf<Element>,
): RowMeasurementResult {
  const { positionCache, heightCache, rows, start, end, getPluginHeight, getRowId } = context;

  let hasChanges = false;

  rowElements.forEach((rowEl) => {
    const rowIndexStr = (rowEl as HTMLElement).dataset.rowIndex;
    if (!rowIndexStr) return;

    const rowIndex = parseInt(rowIndexStr, 10);
    if (rowIndex < start || rowIndex >= end || rowIndex >= rows.length) return;

    const row = rows[rowIndex];

    // Check if a plugin provides the height for this row
    const pluginHeight = getPluginHeight?.(row, rowIndex);

    if (pluginHeight !== undefined) {
      // Plugin provides height - use it for position cache
      const currentEntry = positionCache[rowIndex];
      if (!currentEntry.measured || Math.abs(currentEntry.height - pluginHeight) > 1) {
        updateRowHeight(positionCache, rowIndex, pluginHeight);
        hasChanges = true;
      }
      return; // Don't measure DOM for plugin-managed rows
    }

    // No plugin height - use DOM measurement
    const measuredHeight = (rowEl as HTMLElement).offsetHeight;

    if (measuredHeight > 0) {
      const currentEntry = positionCache[rowIndex];

      // Only update if height differs significantly (> 1px to avoid oscillation)
      if (!currentEntry.measured || Math.abs(currentEntry.height - measuredHeight) > 1) {
        updateRowHeight(positionCache, rowIndex, measuredHeight);
        setCachedHeight(heightCache, row, measuredHeight, getRowId);
        hasChanges = true;
      }
    }
  });

  // Recompute stats
  const measuredCount = hasChanges ? countMeasuredRows(positionCache) : 0;
  const averageHeight = hasChanges ? calculateAverageHeight(positionCache, context.defaultHeight) : 0;

  return { hasChanges, measuredCount, averageHeight };
}

/**
 * Compute measurement statistics for a position cache, excluding plugin-managed rows.
 * Used after rebuilding position cache to get accurate averages for non-plugin rows.
 *
 * @param cache - Position cache
 * @param rows - Row data array
 * @param defaultHeight - Default height if no measurements
 * @param getPluginHeight - Function to check if plugin manages row height
 * @returns Object with measured count and average height
 */
export function computeAverageExcludingPluginRows<T>(
  cache: RowPosition[],
  rows: T[],
  defaultHeight: number,
  getPluginHeight?: (row: T, index: number) => number | undefined,
): { measuredCount: number; averageHeight: number } {
  let measuredCount = 0;
  let totalMeasured = 0;

  for (let i = 0; i < cache.length; i++) {
    const entry = cache[i];
    if (entry.measured) {
      // Only include in average if plugin doesn't provide height for this row
      const pluginHeight = getPluginHeight?.(rows[i], i);
      if (pluginHeight === undefined) {
        totalMeasured += entry.height;
        measuredCount++;
      }
    }
  }

  return {
    measuredCount,
    averageHeight: measuredCount > 0 ? totalMeasured / measuredCount : defaultHeight,
  };
}

// #endregion

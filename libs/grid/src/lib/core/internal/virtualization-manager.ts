/**
 * VirtualizationManager — encapsulates all virtualization state and logic
 * that was previously inline in the DataGridElement class.
 *
 * Owns the VirtualState, position/height caches, and the core
 * refreshVirtualWindow algorithm. Takes the grid reference directly
 * (tightly coupled — this manager can never live outside the grid).
 */
import type { InternalGrid, VirtualState } from '../types';
import { RenderPhase } from './render-scheduler';
import {
  computeAverageExcludingPluginRows,
  computeScrollMapping,
  createIdentityScrollMapping,
  getRowIndexAtOffset,
  getTotalHeight,
  MAX_ELEMENT_HEIGHT_PX,
  measureRenderedRowHeights,
  rebuildPositionCache,
  toVirtualScrollTop,
  updateRowHeight,
} from './virtualization';

// #region VirtualizationManager

export class VirtualizationManager<T = any> {
  readonly #grid: InternalGrid<T>;

  // The full virtualization state — still a plain object so plugins can read
  // fields directly via `grid._virtualization` (they access the same reference).
  readonly state: VirtualState;

  constructor(grid: InternalGrid<T>, initialState?: Partial<VirtualState>) {
    this.#grid = grid;
    this.state = {
      enabled: true,
      rowHeight: 28,
      bypassThreshold: 24,
      start: 0,
      end: 0,
      container: null,
      viewportEl: null,
      totalHeightEl: null,
      positionCache: null,
      heightCache: {
        byKey: new Map<string, number>(),
        byRef: new WeakMap<object, number>(),
      },
      averageHeight: 28,
      measuredCount: 0,
      variableHeights: false,
      cachedViewportHeight: 0,
      cachedFauxHeight: 0,
      cachedScrollAreaHeight: 0,
      scrollAreaEl: null,
      scrollMapping: createIdentityScrollMapping(),
      ...initialState,
    };
  }

  // #region Cached Geometry

  /**
   * Update cached viewport and faux scrollbar geometry.
   * Called by ResizeObserver and on force-refresh to avoid forced layout reads during scroll.
   */
  updateCachedGeometry(): void {
    const s = this.state;
    const fauxScrollbar = s.container;
    const viewportEl = s.viewportEl ?? fauxScrollbar;
    if (viewportEl) {
      s.cachedViewportHeight = viewportEl.clientHeight;
    }
    if (fauxScrollbar) {
      s.cachedFauxHeight = fauxScrollbar.clientHeight;
    }
    const scrollAreaEl = s.scrollAreaEl;
    if (scrollAreaEl) {
      s.cachedScrollAreaHeight = scrollAreaEl.clientHeight;
    }
  }

  // #endregion

  // #region Spacer Height

  /**
   * Calculate total height for the faux scrollbar spacer element.
   * Used by both bypass and virtualized rendering paths to ensure consistent scroll behavior.
   *
   * @param totalRows - Total number of rows to calculate height for
   * @param forceRead - When true, reads fresh geometry from DOM (used after structural changes).
   *   When false, uses cached values from ResizeObserver to avoid forced synchronous layout.
   */
  calculateTotalSpacerHeight(totalRows: number, forceRead = false): number {
    const s = this.state;

    let fauxScrollHeight: number;
    let viewportHeight: number;
    let scrollAreaHeight: number;

    if (forceRead) {
      const fauxScrollbar = s.container ?? this.#grid._hostElement;
      const viewportEl = s.viewportEl ?? fauxScrollbar;
      const scrollAreaEl = s.scrollAreaEl;

      fauxScrollHeight = fauxScrollbar?.clientHeight ?? 0;
      viewportHeight = viewportEl?.clientHeight ?? 0;
      scrollAreaHeight = scrollAreaEl ? scrollAreaEl.clientHeight : fauxScrollHeight;

      s.cachedFauxHeight = fauxScrollHeight;
      s.cachedViewportHeight = viewportHeight;
      s.cachedScrollAreaHeight = scrollAreaHeight;
    } else {
      fauxScrollHeight = s.cachedFauxHeight;
      viewportHeight = s.cachedViewportHeight;
      scrollAreaHeight = s.cachedScrollAreaHeight || fauxScrollHeight;
    }

    const viewportHeightDiff = scrollAreaHeight - viewportHeight;
    const hScrollbarPadding = Math.max(0, fauxScrollHeight - scrollAreaHeight);

    let rowContentHeight: number;

    if (s.variableHeights && s.positionCache) {
      rowContentHeight = getTotalHeight(s.positionCache);
    } else {
      rowContentHeight = totalRows * s.rowHeight;
    }

    // Clamp the row-content portion to the browser's max element height. Above
    // this cap (Chromium ~33.5M px), a single element's rendered height is silently
    // truncated, so the tail of huge datasets becomes unreachable via the native
    // scrollbar / Ctrl+End. Storing the mapping here lets refreshVirtualWindow
    // (and the scroll listener / scrollToRow) translate between spacer-space
    // scrollTop and virtual row-content space.
    const cappedRowContentHeight = Math.min(rowContentHeight, MAX_ELEMENT_HEIGHT_PX);
    s.scrollMapping = computeScrollMapping(rowContentHeight, viewportHeight);

    return cappedRowContentHeight + viewportHeightDiff + hScrollbarPadding;
  }

  // #endregion

  // #region Position Cache

  /**
   * Initialize or rebuild the position cache for variable row heights.
   * Called when rows change or variable heights mode is enabled.
   */
  initializePositionCache(): void {
    const s = this.state;
    if (!s.variableHeights) return;

    const grid = this.#grid;
    const rows = grid._rows;
    const estimatedHeight = s.rowHeight || 28;
    const rowHeightFn = grid.effectiveConfig?.rowHeight as ((row: T, index: number) => number | undefined) | undefined;
    const getRowId = grid.effectiveConfig?.getRowId;
    const rowIdFn = getRowId ? (row: T) => getRowId(row) : undefined;

    s.positionCache = rebuildPositionCache(rows, s.heightCache, estimatedHeight, { rowId: rowIdFn }, (row, index) => {
      const pluginHeight = grid._getPluginRowHeight(row, index);
      if (pluginHeight !== undefined) return pluginHeight;
      if (rowHeightFn) {
        const height = rowHeightFn(row, index);
        if (height !== undefined && height > 0) return height;
      }
      return undefined;
    });

    const stats = computeAverageExcludingPluginRows(s.positionCache, rows, estimatedHeight, (row, index) =>
      grid._getPluginRowHeight(row, index),
    );
    s.measuredCount = stats.measuredCount;
    if (stats.measuredCount > 0) {
      s.averageHeight = stats.averageHeight;
    }
  }

  /**
   * Invalidate a row's height in the position cache.
   * Call this when a plugin changes a row's height (e.g., expanding/collapsing a detail panel).
   * Updates the position cache incrementally O(1) + offset recalc O(k) without a full rebuild.
   *
   * @param rowIndex - Index of the row whose height changed
   * @param newHeight - Optional new height. If not provided, queries plugins for height.
   */
  invalidateRowHeight(rowIndex: number, newHeight?: number): void {
    const s = this.state;
    if (!s.variableHeights) return;
    if (!s.positionCache) return;

    const rows = this.#grid._rows;
    if (rowIndex < 0 || rowIndex >= rows.length) return;

    const row = rows[rowIndex];

    let height = newHeight;
    if (height === undefined) {
      height = this.#grid._getPluginRowHeight(row, rowIndex);
    }
    if (height === undefined) {
      height = s.rowHeight;
    }

    const currentEntry = s.positionCache[rowIndex];
    if (!currentEntry || Math.abs(currentEntry.height - height) < 1) {
      return;
    }

    updateRowHeight(s.positionCache, rowIndex, height);

    if (s.totalHeightEl) {
      const newTotalHeight = this.calculateTotalSpacerHeight(rows.length);
      s.totalHeightEl.style.height = `${newTotalHeight}px`;
    }
  }

  // #endregion

  // #region Row Measurement

  /**
   * Measure rendered row heights and update position cache.
   * Called after rows are rendered to capture actual DOM heights.
   * Only runs when variable heights mode is enabled.
   */
  measureRenderedRowHeights(start: number, end: number): void {
    const s = this.state;
    if (!s.variableHeights) return;
    if (!s.positionCache) return;

    const grid = this.#grid;
    const bodyEl = grid._bodyEl;
    if (!bodyEl) return;

    const rowElements = bodyEl.querySelectorAll('.data-grid-row');
    const getRowId = grid.effectiveConfig?.getRowId;
    const rows = grid._rows;

    const result = measureRenderedRowHeights(
      {
        positionCache: s.positionCache,
        heightCache: s.heightCache,
        rows,
        defaultHeight: s.rowHeight,
        start,
        end,
        getPluginHeight: (row, index) => grid._getPluginRowHeight(row, index),
        getRowId: getRowId ? (row: T) => getRowId(row) : undefined,
      },
      rowElements,
    );

    if (result.hasChanges) {
      s.measuredCount = result.measuredCount;
      s.averageHeight = result.averageHeight;

      if (s.totalHeightEl) {
        const newTotalHeight = this.calculateTotalSpacerHeight(rows.length);
        s.totalHeightEl.style.height = `${newTotalHeight}px`;
      }
    }
  }

  // #endregion

  // #region Core Virtual Window

  /**
   * Core virtualization routine. Chooses between bypass (small datasets), grouped window rendering,
   * or standard row window rendering.
   * @param force - Whether to force a full refresh (not just scroll update)
   * @param skipAfterRender - When true, skip calling afterRender (used by scheduler which calls it separately)
   * @returns Whether the visible row window changed (start/end differ from previous)
   */
  refreshVirtualWindow(force = false, skipAfterRender = false): boolean {
    const s = this.state;
    const grid = this.#grid;
    const bodyEl = grid._bodyEl;
    if (!bodyEl) return false;

    const totalRows = grid._rows.length;

    if (!s.enabled) {
      grid._renderVisibleRows(0, totalRows);
      if (!skipAfterRender) {
        grid._afterPluginRender();
      }
      return true;
    }

    if (totalRows <= s.bypassThreshold) {
      s.start = 0;
      s.end = totalRows;
      if (force) {
        bodyEl.style.transform = 'translateY(0px)';
      }
      grid._renderVisibleRows(0, totalRows, grid.__rowRenderEpoch);
      if (force && s.variableHeights) {
        this.initializePositionCache();
      }
      if (force && s.totalHeightEl) {
        s.totalHeightEl.style.height = `${this.calculateTotalSpacerHeight(totalRows, true)}px`;
      }
      grid._updateAriaCounts(totalRows, grid._visibleColumns.length);
      if (!skipAfterRender) {
        grid._afterPluginRender();
      }
      return true;
    }

    // --- Normal virtualization path with faux scrollbar pattern ---
    const fauxScrollbar = s.container!;
    const viewportEl = s.viewportEl ?? fauxScrollbar;

    const viewportHeight = force
      ? (s.cachedViewportHeight = viewportEl.clientHeight)
      : s.cachedViewportHeight || (s.cachedViewportHeight = viewportEl.clientHeight);
    const rowHeight = s.rowHeight;
    const rawScrollTop = fauxScrollbar.scrollTop;
    // Translate native scrollTop (clamped spacer space) into virtual row-content
    // space. Identity for datasets within MAX_ELEMENT_HEIGHT_PX. See computeScrollMapping.
    const scrollTop = toVirtualScrollTop(rawScrollTop, s.scrollMapping);

    // On force refresh with variable heights, rebuild the position cache
    // to pick up any height changes from plugins (e.g., ResponsivePlugin
    // measuring actual card heights from DOM after first render).
    if (force && s.variableHeights) {
      this.initializePositionCache();
    }

    let start: number;
    const positionCache = s.positionCache;

    // Variable row heights: use binary search on position cache
    if (s.variableHeights && positionCache && positionCache.length > 0) {
      start = getRowIndexAtOffset(positionCache, scrollTop);
      if (start === -1) start = 0;
    } else {
      start = Math.floor(scrollTop / rowHeight);
    }

    // Round down to even number for zebra stripe parity
    start = start - (start % 2);
    if (start < 0) start = 0;

    // Allow plugins to extend the start index backwards
    const pluginAdjustedStart = grid._adjustPluginVirtualStart(start, scrollTop, rowHeight);
    if (pluginAdjustedStart !== undefined && pluginAdjustedStart < start) {
      start = pluginAdjustedStart;
      start = start - (start % 2);
      if (start < 0) start = 0;
    }

    // Calculate end of visible window
    let end: number;

    if (s.variableHeights && positionCache && positionCache.length > 0) {
      const targetHeight = viewportHeight + rowHeight * 3; // 3 rows overscan
      let accumulatedHeight = 0;
      end = start;

      while (end < totalRows && accumulatedHeight < targetHeight) {
        accumulatedHeight += positionCache[end].height;
        end++;
      }

      const minRows = Math.ceil(viewportHeight / rowHeight) + 3;
      if (end - start < minRows) {
        end = Math.min(start + minRows, totalRows);
      }
    } else {
      const visibleCount = Math.ceil(viewportHeight / rowHeight) + 3;
      end = start + visibleCount;
    }

    if (end > totalRows) end = totalRows;

    // Early-exit: visible window unchanged and not force
    const prevStart = s.start;
    const prevEnd = s.end;
    if (!force && start === prevStart && end === prevEnd) {
      return false;
    }

    s.start = start;
    s.end = end;

    // Read faux scrollbar height (cached on scroll path, fresh on force)
    const fauxScrollHeight = force
      ? (s.cachedFauxHeight = fauxScrollbar.clientHeight)
      : s.cachedFauxHeight || (s.cachedFauxHeight = fauxScrollbar.clientHeight);

    if (force) {
      const scrollAreaEl = s.scrollAreaEl;
      if (scrollAreaEl) {
        s.cachedScrollAreaHeight = scrollAreaEl.clientHeight;
      }
    }

    // Guard: stale DOM references
    if (fauxScrollHeight === 0 && viewportHeight > 0) {
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'stale-refs-retry');
      return false;
    }

    // Recalculate spacer height on force refresh
    if (force && s.totalHeightEl) {
      const totalHeight = this.calculateTotalSpacerHeight(totalRows);
      s.totalHeightEl.style.height = `${totalHeight}px`;
    }

    // Calculate sub-pixel transform offset
    let startRowOffset: number;
    if (s.variableHeights && positionCache && positionCache[start]) {
      startRowOffset = positionCache[start].offset;
    } else {
      startRowOffset = start * rowHeight;
    }

    const subPixelOffset = -(scrollTop - startRowOffset);
    bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    grid._renderVisibleRows(start, end, grid.__rowRenderEpoch);

    // Measure rendered row heights on force refresh
    if (force && s.variableHeights) {
      this.measureRenderedRowHeights(start, end);
    }

    grid._updateAriaCounts(totalRows, grid._visibleColumns.length);

    // Run plugin afterRender hooks on force refresh
    if (force && !skipAfterRender) {
      grid._afterPluginRender();

      // Recalculate spacer height in microtask to catch plugin DOM changes
      queueMicrotask(() => {
        if (!s.totalHeightEl) return;
        const newTotalHeight = this.calculateTotalSpacerHeight(totalRows);
        if (s.cachedFauxHeight === 0 && s.cachedViewportHeight > 0) return;
        s.totalHeightEl.style.height = `${newTotalHeight}px`;
      });
    }

    return true;
  }

  // #endregion
}

// #endregion

/**
 * VirtualizationManager — encapsulates all virtualization state and logic
 * that was previously inline in the DataGridElement class.
 *
 * Owns the VirtualState, position/height caches, and the core
 * refreshVirtualWindow algorithm. Communicates with the grid through a
 * narrow VirtualizationHost interface to keep coupling minimal.
 */
import type { VirtualState } from '../types';
import { RenderPhase } from './render-scheduler';
import {
  computeAverageExcludingPluginRows,
  getRowIndexAtOffset,
  getTotalHeight,
  measureRenderedRowHeights,
  rebuildPositionCache,
  updateRowHeight,
} from './virtualization';

// #region Host Interface

/**
 * Narrow contract a grid must satisfy so the VirtualizationManager can
 * read data, render rows, and query plugins without knowing the full grid API.
 */
export interface VirtualizationHost<T = any> {
  // --- Data (getters, no copying) ---
  readonly rows: T[];
  readonly visibleColumnCount: number;
  readonly rowRenderEpoch: number;

  // --- Config ---
  readonly rowHeightFn: ((row: T, index: number) => number | undefined) | undefined;
  readonly getRowId: ((row: T) => string | number) | undefined;

  // --- DOM ---
  readonly bodyEl: HTMLElement | null;

  // --- Render callbacks ---
  renderVisibleRows(start: number, end: number, epoch?: number): void;
  updateAriaCounts(totalRows: number, totalCols: number): void;
  requestSchedulerPhase(phase: number, source: string): void;

  // --- Plugin manager proxy ---
  getPluginExtraHeight(): number;
  getPluginRowHeight(row: T, index: number): number | undefined;
  getPluginExtraHeightBefore(start: number): number;
  adjustPluginVirtualStart(start: number, scrollTop: number, rowHeight: number): number | undefined;
  afterPluginRender(): void;
}

// #endregion

// #region VirtualizationManager

export class VirtualizationManager<T = any> {
  readonly #host: VirtualizationHost<T>;

  // The full virtualization state — still a plain object so plugins can read
  // fields directly via `grid._virtualization` (they access the same reference).
  readonly state: VirtualState;

  constructor(host: VirtualizationHost<T>, initialState?: Partial<VirtualState>) {
    this.#host = host;
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
      const fauxScrollbar = s.container ?? (this.#host.bodyEl?.closest('tbw-grid') as HTMLElement) ?? null;
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
    let pluginExtraHeight = 0;

    if (s.variableHeights && s.positionCache) {
      rowContentHeight = getTotalHeight(s.positionCache);
    } else {
      rowContentHeight = totalRows * s.rowHeight;
      pluginExtraHeight = this.#host.getPluginExtraHeight();
    }

    return rowContentHeight + viewportHeightDiff + pluginExtraHeight + hScrollbarPadding;
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

    const rows = this.#host.rows;
    const estimatedHeight = s.rowHeight || 28;
    const rowHeightFn = this.#host.rowHeightFn;
    const getRowId = this.#host.getRowId;
    const rowIdFn = getRowId ? (row: T) => getRowId(row) : undefined;

    s.positionCache = rebuildPositionCache(rows, s.heightCache, estimatedHeight, { rowId: rowIdFn }, (row, index) => {
      const pluginHeight = this.#host.getPluginRowHeight(row, index);
      if (pluginHeight !== undefined) return pluginHeight;
      if (rowHeightFn) {
        const height = rowHeightFn(row, index);
        if (height !== undefined && height > 0) return height;
      }
      return undefined;
    });

    const stats = computeAverageExcludingPluginRows(s.positionCache, rows, estimatedHeight, (row, index) =>
      this.#host.getPluginRowHeight(row, index),
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

    const rows = this.#host.rows;
    if (rowIndex < 0 || rowIndex >= rows.length) return;

    const row = rows[rowIndex];

    let height = newHeight;
    if (height === undefined) {
      height = this.#host.getPluginRowHeight(row, rowIndex);
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

    const bodyEl = this.#host.bodyEl;
    if (!bodyEl) return;

    const rowElements = bodyEl.querySelectorAll('.data-grid-row');
    const getRowId = this.#host.getRowId;
    const rows = this.#host.rows;

    const result = measureRenderedRowHeights(
      {
        positionCache: s.positionCache,
        heightCache: s.heightCache,
        rows,
        defaultHeight: s.rowHeight,
        start,
        end,
        getPluginHeight: (row, index) => this.#host.getPluginRowHeight(row, index),
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
    const host = this.#host;
    const bodyEl = host.bodyEl;
    if (!bodyEl) return false;

    const totalRows = host.rows.length;

    if (!s.enabled) {
      host.renderVisibleRows(0, totalRows);
      if (!skipAfterRender) {
        host.afterPluginRender();
      }
      return true;
    }

    if (totalRows <= s.bypassThreshold) {
      s.start = 0;
      s.end = totalRows;
      if (force) {
        bodyEl.style.transform = 'translateY(0px)';
      }
      host.renderVisibleRows(0, totalRows, host.rowRenderEpoch);
      if (force && s.totalHeightEl) {
        s.totalHeightEl.style.height = `${this.calculateTotalSpacerHeight(totalRows, true)}px`;
      }
      host.updateAriaCounts(totalRows, host.visibleColumnCount);
      if (!skipAfterRender) {
        host.afterPluginRender();
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
    const scrollTop = fauxScrollbar.scrollTop;

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

      let iterations = 0;
      const maxIterations = 10;
      while (iterations < maxIterations) {
        const extraHeightBefore = host.getPluginExtraHeightBefore(start);
        const adjustedStart = Math.floor((scrollTop - extraHeightBefore) / rowHeight);
        if (adjustedStart >= start || adjustedStart < 0) break;
        start = adjustedStart;
        iterations++;
      }
    }

    // Round down to even number for zebra stripe parity
    start = start - (start % 2);
    if (start < 0) start = 0;

    // Allow plugins to extend the start index backwards
    const pluginAdjustedStart = host.adjustPluginVirtualStart(start, scrollTop, rowHeight);
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
      host.requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'stale-refs-retry');
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
      const extraHeightBeforeStart = host.getPluginExtraHeightBefore(start);
      startRowOffset = start * rowHeight + extraHeightBeforeStart;
    }

    const subPixelOffset = -(scrollTop - startRowOffset);
    bodyEl.style.transform = `translateY(${subPixelOffset}px)`;

    host.renderVisibleRows(start, end, host.rowRenderEpoch);

    // Measure rendered row heights on force refresh
    if (force && s.variableHeights) {
      this.measureRenderedRowHeights(start, end);
    }

    host.updateAriaCounts(totalRows, host.visibleColumnCount);

    // Run plugin afterRender hooks on force refresh
    if (force && !skipAfterRender) {
      host.afterPluginRender();

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

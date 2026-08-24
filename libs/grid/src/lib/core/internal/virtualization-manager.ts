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
  measureRenderedRowHeights,
  rebuildPositionCache,
  toVirtualScrollTop,
  updateRowHeight,
} from './virtualization';

/** Safety valve for `#scheduleGeometryVerification` against a layout that never settles. */
const MAX_GEOMETRY_VERIFY_PASSES = 3;

// #region VirtualizationManager

export class VirtualizationManager<T = any> {
  readonly #grid: InternalGrid<T>;

  // The full virtualization state — still a plain object so plugins can read
  // fields directly via `grid._virtualization` (they access the same reference).
  readonly state: VirtualState;

  #geometryVerifyHandle = 0;
  #geometryVerifyPasses = 0;

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
   * Live geometry read shared by the force-path spacer calculation and the post-render
   * verification, so a cache write and the check of that cache resolve element fallbacks
   * identically. `updateCachedGeometry()` deliberately does not use it — it must keep the
   * last known values rather than cache zeros when the elements are detached.
   */
  #readGeometry(): { fauxHeight: number; viewportHeight: number; scrollAreaHeight: number } {
    const s = this.state;
    const fauxScrollbar = s.container ?? this.#grid._hostElement;
    const viewportEl = s.viewportEl ?? fauxScrollbar;
    const fauxHeight = fauxScrollbar?.clientHeight ?? 0;
    return {
      fauxHeight,
      viewportHeight: viewportEl?.clientHeight ?? 0,
      scrollAreaHeight: s.scrollAreaEl ? s.scrollAreaEl.clientHeight : fauxHeight,
    };
  }

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
      ({ fauxHeight: fauxScrollHeight, viewportHeight, scrollAreaHeight } = this.#readGeometry());

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
    s.scrollMapping = computeScrollMapping(rowContentHeight, viewportHeight);

    return s.scrollMapping.spacerHeight + viewportHeightDiff + hScrollbarPadding;
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
   * Render every row without a virtual window (virtualization disabled).
   */
  #renderUnvirtualized(totalRows: number, skipAfterRender: boolean): boolean {
    const grid = this.#grid;
    grid._renderVisibleRows(0, totalRows);
    if (!skipAfterRender) grid._afterPluginRender();
    return true;
  }

  /**
   * Small-dataset bypass — render every row but keep the spacer, position cache
   * and ARIA counts in sync so a later growth past the threshold is seamless.
   */
  #renderBypassWindow(bodyEl: HTMLElement, totalRows: number, force: boolean, skipAfterRender: boolean): boolean {
    const s = this.state;
    const grid = this.#grid;
    // Bypass renders every row, so the window only ever changes on a force
    // refresh or a row-count change — claiming a change on every scroll frame
    // made callers re-run plugin onScrollRender() for nothing.
    const windowChanged = force || s.start !== 0 || s.end !== totalRows;
    s.start = 0;
    s.end = totalRows;
    grid._renderVisibleRows(0, totalRows, grid.__rowRenderEpoch);
    if (force) {
      if (s.variableHeights) this.initializePositionCache();
      // Both layout reads happen before either write, so the whole force path
      // costs a single reflow.
      let offset = s.container?.scrollTop ?? 0;
      if (s.totalHeightEl) {
        const spacerHeight = this.calculateTotalSpacerHeight(totalRows, true);
        s.totalHeightEl.style.height = `${spacerHeight}px`;
        // The browser clamps scrollTop to the resized spacer, but not until the
        // next layout — mirror that here rather than paying a second read.
        const maxScroll = spacerHeight - s.cachedFauxHeight;
        if (offset > maxScroll) offset = maxScroll > 0 ? maxScroll : 0;
      }
      // Re-apply the live scroll offset. Hard-coding translateY(0) desynced the
      // rows from the faux scrollbar, which keeps its scrollTop across a force
      // refresh — the tail rows became unreachable. Raw (un-mapped) scrollTop is
      // correct here and matches grid.ts's bypass scroll listener: a dataset small
      // enough to bypass is always far below MAX_ELEMENT_HEIGHT_PX, so the scroll
      // mapping is identity.
      bodyEl.style.transform = `translateY(${-offset}px)`;
    }
    grid._updateAriaCounts(totalRows, grid._visibleColumns.length);
    if (!skipAfterRender) grid._afterPluginRender();
    return windowChanged;
  }

  /**
   * Resolve the first row index of the visible window, applying zebra-stripe
   * parity, defensive clamping and any plugin-requested backwards extension.
   */
  #computeWindowStart(scrollTop: number, totalRows: number): number {
    const s = this.state;
    const positionCache = s.positionCache;

    let start: number;
    // Variable row heights: use binary search on position cache
    if (s.variableHeights && positionCache && positionCache.length > 0) {
      start = getRowIndexAtOffset(positionCache, scrollTop);
      if (start === -1) start = 0;
    } else {
      start = Math.floor(scrollTop / s.rowHeight);
    }

    // Round down to even number for zebra stripe parity
    start = start - (start % 2);
    if (start < 0) start = 0;
    // Defensive upper-clamp: with a capped scrollMapping the spacer's actual
    // scrollable extent can slightly exceed `spacerHeight - viewportHeight`
    // (e.g. horizontal-scrollbar padding, sub-pixel rounding), so a maxed-out
    // raw scrollTop could otherwise translate to a `start` past the end of the
    // dataset. Cap to the last possible row so `end` clamping (further below)
    // doesn't leave the renderer with `start > end`.
    if (totalRows > 0 && start > totalRows - 1) start = totalRows - 1;

    // Allow plugins to extend the start index backwards
    const pluginAdjustedStart = this.#grid._adjustPluginVirtualStart(start, scrollTop, s.rowHeight);
    if (pluginAdjustedStart !== undefined && pluginAdjustedStart < start) {
      start = pluginAdjustedStart - (pluginAdjustedStart % 2);
      if (start < 0) start = 0;
    }
    return start;
  }

  /**
   * Resolve the exclusive end index of the visible window (viewport + 3 rows overscan).
   */
  #computeWindowEnd(start: number, viewportHeight: number, totalRows: number): number {
    const s = this.state;
    const rowHeight = s.rowHeight;
    const positionCache = s.positionCache;

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
      end = start + Math.ceil(viewportHeight / rowHeight) + 3;
    }

    return end > totalRows ? totalRows : end;
  }

  /**
   * Recalculate the spacer height in a microtask so DOM changes made by plugin
   * `afterRender` hooks (expanded detail rows, cards) are reflected.
   */
  #scheduleSpacerRecalc(totalRows: number): void {
    const s = this.state;
    queueMicrotask(() => {
      if (!s.totalHeightEl) return;
      const newTotalHeight = this.calculateTotalSpacerHeight(totalRows);
      if (s.cachedFauxHeight === 0 && s.cachedViewportHeight > 0) return;
      s.totalHeightEl.style.height = `${newTotalHeight}px`;
    });
  }

  /**
   * Re-read viewport geometry on the next frame and re-run virtualization if it
   * moved.
   *
   * A force refresh reads `viewportEl`/`scrollAreaEl` heights synchronously,
   * immediately after the scheduler re-rendered the header. Framework adapters
   * commit header renderers asynchronously (React portals, Angular embedded
   * views), so at that instant the header can be momentarily collapsed to its
   * CSS minimum — the spacer then gets `scrollAreaHeight - viewportHeight`
   * short and the tail rows become unreachable. The viewport ResizeObserver
   * cannot recover from this: the collapse and the restore happen within a
   * single frame, so the observed size never nets a change and the callback
   * never fires. A microtask (`#scheduleSpacerRecalc`) is also too early — it
   * still runs before the adapter's commit.
   */
  #scheduleGeometryVerification(): void {
    const s = this.state;
    if (this.#geometryVerifyHandle) return;
    this.#geometryVerifyHandle = requestAnimationFrame(() => {
      this.#geometryVerifyHandle = 0;
      const grid = this.#grid;
      // Teardown ends the burst: a reconnect must start from a full budget.
      if (!grid._schedulerIsConnected || !s.totalHeightEl) {
        this.#geometryVerifyPasses = 0;
        return;
      }

      const { fauxHeight, viewportHeight, scrollAreaHeight } = this.#readGeometry();
      if (
        viewportHeight === s.cachedViewportHeight &&
        scrollAreaHeight === s.cachedScrollAreaHeight &&
        fauxHeight === s.cachedFauxHeight
      ) {
        this.#geometryVerifyPasses = 0;
        return;
      }
      // Give up on an oscillating layout. Not re-requesting is what breaks the loop, so the
      // budget resets here — otherwise a later unrelated burst would skip a real correction.
      if (this.#geometryVerifyPasses >= MAX_GEOMETRY_VERIFY_PASSES) {
        this.#geometryVerifyPasses = 0;
        return;
      }
      this.#geometryVerifyPasses++;
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'geometry-drift');
    });
  }

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

    if (!s.enabled) return this.#renderUnvirtualized(totalRows, skipAfterRender);
    if (force) this.#scheduleGeometryVerification();
    if (totalRows <= s.bypassThreshold) return this.#renderBypassWindow(bodyEl, totalRows, force, skipAfterRender);

    // --- Normal virtualization path with faux scrollbar pattern ---
    const fauxScrollbar = s.container!;
    const viewportEl = s.viewportEl ?? fauxScrollbar;

    const viewportHeight = force
      ? (s.cachedViewportHeight = viewportEl.clientHeight)
      : s.cachedViewportHeight || (s.cachedViewportHeight = viewportEl.clientHeight);
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

    const start = this.#computeWindowStart(scrollTop, totalRows);
    const end = this.#computeWindowEnd(start, viewportHeight, totalRows);

    // Early-exit: visible window unchanged and not force
    if (!force && start === s.start && end === s.end) return false;

    s.start = start;
    s.end = end;

    // Read faux scrollbar height (cached on scroll path, fresh on force)
    const fauxScrollHeight = force
      ? (s.cachedFauxHeight = fauxScrollbar.clientHeight)
      : s.cachedFauxHeight || (s.cachedFauxHeight = fauxScrollbar.clientHeight);

    if (force && s.scrollAreaEl) {
      s.cachedScrollAreaHeight = s.scrollAreaEl.clientHeight;
    }

    // Guard: stale DOM references
    if (fauxScrollHeight === 0 && viewportHeight > 0) {
      grid._requestSchedulerPhase(RenderPhase.VIRTUALIZATION, 'stale-refs-retry');
      return false;
    }

    // Recalculate spacer height on force refresh
    if (force && s.totalHeightEl) {
      s.totalHeightEl.style.height = `${this.calculateTotalSpacerHeight(totalRows)}px`;
    }

    // Calculate sub-pixel transform offset
    const positionCache = s.positionCache;
    const startRowOffset =
      s.variableHeights && positionCache && positionCache[start] ? positionCache[start].offset : start * s.rowHeight;
    bodyEl.style.transform = `translateY(${-(scrollTop - startRowOffset)}px)`;

    grid._renderVisibleRows(start, end, grid.__rowRenderEpoch);

    // Measure rendered row heights on force refresh
    if (force && s.variableHeights) {
      this.measureRenderedRowHeights(start, end);
    }

    grid._updateAriaCounts(totalRows, grid._visibleColumns.length);

    // Run plugin afterRender hooks on force refresh
    if (force && !skipAfterRender) {
      grid._afterPluginRender();
      this.#scheduleSpacerRecalc(totalRows);
    }

    return true;
  }

  // #endregion
}

// #endregion

/**
 * Centralized Render Scheduler for the Grid component.
 *
 * This scheduler batches all rendering work into a single requestAnimationFrame,
 * eliminating race conditions between different parts of the grid (ResizeObserver,
 * framework adapters, virtualization, etc.) that previously scheduled independent RAFs.
 *
 * ## Design Principles
 *
 * 1. **Single RAF per frame**: All render requests are batched into one RAF callback
 * 2. **Phase-based execution**: Work is organized into ordered phases that run sequentially
 * 3. **Highest-phase wins**: Multiple requests merge to the highest requested phase
 * 4. **Framework-agnostic timing**: Eliminates need for "double RAF" hacks
 *
 * ## Render Phases (execute in order)
 *
 * - STYLE (1): Lightweight style/class updates, plugin afterRender hooks
 * - VIRTUALIZATION (2): Virtual window recalculation (scroll, resize)
 * - HEADER (3): Header re-render only
 * - ROWS (4): Row model rebuild + header + template + virtual window
 * - COLUMNS (5): Column processing + rows phase work
 * - FULL (6): Complete render including config merge
 *
 * @example
 * ```typescript
 * // The scheduler takes the grid (InternalGrid) directly:
 * const scheduler = new RenderScheduler(this as unknown as InternalGrid);
 *
 * // Request a full render
 * scheduler.requestPhase(RenderPhase.FULL, 'initial-setup');
 *
 * // Wait for render to complete
 * await scheduler.whenReady();
 * ```
 */

import type { InternalGrid, RenderDetail } from '../types';

// #region Types & Enums
/**
 * Render phases in order of execution.
 * Higher phases include all lower phase work.
 *
 * @category Plugin Development
 * @since 0.4.0
 */
export const RenderPhase = {
  /** Lightweight style updates only (plugin afterRender hooks) */
  STYLE: 1,
  /** Virtual window recalculation (includes STYLE) */
  VIRTUALIZATION: 2,
  /** Header re-render (includes VIRTUALIZATION) */
  HEADER: 3,
  /** Row model rebuild (includes HEADER) */
  ROWS: 4,
  /** Column processing (includes ROWS) */
  COLUMNS: 5,
  /** Full render including config merge (includes COLUMNS) */
  FULL: 6,
} as const;
export type RenderPhase = (typeof RenderPhase)[keyof typeof RenderPhase];

/**
 * @internal Scheduler now takes InternalGrid directly — no callback interface needed.
 */
// #endregion

// #region RenderScheduler
/**
 * Centralized render scheduler that batches all grid rendering into single RAF.
 */
export class RenderScheduler {
  readonly #grid: InternalGrid;

  /** Current pending phase (0 = none pending) */
  #pendingPhase: RenderPhase | 0 = 0;

  /** RAF handle for cancellation */
  #rafHandle = 0;

  /** A plugin `processRows` hook called `requestColumns` during this flush (see `runRowHooks`). */
  #rowHookColumns = false;
  #flushingRows = false;
  #inRowHooks = false;
  /** The rendered column window moved (see `requestWindow`). */
  #windowDirty = false;

  /** Promise that resolves when current render completes */
  #readyPromise: Promise<void> | null = null;
  #readyResolve: (() => void) | null = null;

  /** Initial ready resolver (for component's initial ready() promise) */
  #initialReadyResolver: (() => void) | null = null;
  #initialReadyFired = false;

  constructor(grid: InternalGrid) {
    this.#grid = grid;
  }

  /**
   * Request a render at the specified phase.
   * Multiple requests are batched - the highest phase wins.
   *
   * @param phase - The render phase to execute
   * @param _source - Debug identifier for what triggered this request (unused, kept for API compatibility)
   */
  requestPhase(phase: RenderPhase, _source: string): void {
    // Merge to highest phase
    if (phase > this.#pendingPhase) {
      this.#pendingPhase = phase;
    }

    // Schedule RAF if not already scheduled
    if (this.#rafHandle === 0) {
      this.#ensureReadyPromise();
      this.#rafHandle = requestAnimationFrame(() => this.#flush());
    }
  }

  /**
   * Plugin request to re-run the column steps (`grid.requestColumnsRender`). Made from a plugin
   * `processRows` hook (e.g. new pivot column keys, #608), it joins the running flush, whose column
   * steps have not run yet, instead of a second frame that would paint rows against stale columns.
   */
  requestColumns(source: string): void {
    if (this.#inRowHooks) {
      this.#rowHookColumns = true;
      return;
    }
    this.requestPhase(RenderPhase.COLUMNS, source);
  }

  /**
   * Re-window the rendered columns (`grid.requestColumnWindowRender`). The window is a pure function
   * of the processed columns and the scroll position (#603), so a moved window only needs the
   * template, header and row cells rebuilt: a HEADER flush plus `_schedulerRewindow`, not a COLUMNS
   * flush that would re-merge the config and re-run `processRows` over every row.
   */
  requestWindow(source: string): void {
    this.#windowDirty = true;
    this.requestPhase(RenderPhase.HEADER, source);
  }

  /**
   * Run the plugin processRows hooks; see `requestColumns`. Only that request joins the running
   * flush: anything else, e.g. `#setup()` from a consumer's `group-toggle` listener, may need
   * `processRows` again and keeps its own flush.
   */
  runRowHooks<T>(hooks: () => T): T {
    this.#inRowHooks = this.#flushingRows;
    try {
      return hooks();
    } finally {
      this.#inRowHooks = false;
    }
  }

  /**
   * Run a pending render now instead of on the next animation frame. For input handlers that must
   * act on the re-rendered DOM, e.g. a key press that first scrolls the focused column back into a
   * column window (#633). No-op when nothing is pending.
   */
  flushPending(): void {
    if (this.#rafHandle === 0) return;
    cancelAnimationFrame(this.#rafHandle);
    this.#flush();
  }

  /**
   * Returns a promise that resolves when the current render cycle completes.
   * If no render is pending, returns an already-resolved promise.
   */
  whenReady(): Promise<void> {
    if (this.#readyPromise) {
      return this.#readyPromise;
    }
    return Promise.resolve();
  }

  /**
   * Set the initial ready resolver (called once on first render).
   * This connects to the grid's `ready()` promise.
   */
  setInitialReadyResolver(resolver: () => void): void {
    this.#initialReadyResolver = resolver;
  }

  /**
   * Cancel any pending render.
   * Useful for cleanup when component disconnects.
   */
  cancel(): void {
    if (this.#rafHandle !== 0) {
      cancelAnimationFrame(this.#rafHandle);
      this.#rafHandle = 0;
    }
    this.#pendingPhase = 0;
    this.#windowDirty = false;

    // Resolve any pending ready promise (don't leave it hanging)
    if (this.#readyResolve) {
      this.#readyResolve();
      this.#readyResolve = null;
      this.#readyPromise = null;
    }
  }

  /**
   * Check if a render is currently pending.
   */
  get isPending(): boolean {
    return this.#pendingPhase !== 0;
  }

  /**
   * The current pending phase (0 if nothing is pending).
   * Used by `forceLayout()` to flush at the correct phase
   * without unnecessarily escalating to FULL.
   */
  get pendingPhase(): RenderPhase | 0 {
    return this.#pendingPhase;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Methods
  // ─────────────────────────────────────────────────────────────────────────

  #ensureReadyPromise(): void {
    if (!this.#readyPromise) {
      this.#readyPromise = new Promise<void>((resolve) => {
        this.#readyResolve = resolve;
      });
    }
  }

  /**
   * Execute all pending render work in phase order.
   * This is the single RAF callback that does all rendering.
   */
  #flush(): void {
    this.#rafHandle = 0;
    const windowDirty = this.#windowDirty;
    this.#windowDirty = false;

    // Bail if component disconnected
    if (!this.#grid._schedulerIsConnected) {
      this.#pendingPhase = 0;
      if (this.#readyResolve) {
        this.#readyResolve();
        this.#readyResolve = null;
        this.#readyPromise = null;
      }
      return;
    }

    let phase = this.#pendingPhase;
    this.#pendingPhase = 0;

    // Execute phases in order (higher phases include lower phase work)
    // The execution order respects data dependencies:
    // mergeConfig → processRows → processColumns → renderHeader → virtualWindow → afterRender

    // mergeConfig runs for FULL phase OR COLUMNS phase (to pick up framework adapter renderers)
    // IMPORTANT: mergeConfig must run BEFORE processRows because the row model depends on
    // column configuration, and framework adapters (React/Angular) may register renderers
    // asynchronously after the initial gridConfig is set.
    if (phase >= RenderPhase.COLUMNS) {
      this.#grid._schedulerMergeConfig();
    }

    // Phase 4 (ROWS): Rebuild row model
    // NOTE: processRows MUST run before processColumns because tree plugin's
    // processColumns depends on flattenedRows populated by processRows
    if (phase >= RenderPhase.ROWS) {
      this.#flushingRows = true;
      try {
        this.#grid._schedulerProcessRows();
      } finally {
        this.#flushingRows = false;
      }
      phase = this.#serveRowHookRequest(phase);
    }

    // Phase 5 (COLUMNS): Process columns + update template
    if (phase >= RenderPhase.COLUMNS) {
      this.#grid._schedulerProcessColumns();
      this.#grid._schedulerUpdateTemplate();
    } else if (windowDirty) {
      // A COLUMNS flush re-windows anyway (new `_columns`, epoch bump, template).
      this.#grid._schedulerRewindow();
    }

    // Phase 3 (HEADER): Render header
    if (phase >= RenderPhase.HEADER) {
      this.#grid._schedulerRenderHeader();
    }

    // Phase 2 (VIRTUALIZATION): Recalculate virtual window
    if (phase >= RenderPhase.VIRTUALIZATION) {
      this.#grid.refreshVirtualWindow(true, true);
    }

    // Phase 1 (STYLE): Run afterRender hooks (always runs)
    if (phase >= RenderPhase.STYLE) {
      this.#grid._schedulerAfterRender();
    }

    const initial = !this.#initialReadyFired;

    // Fire initial ready resolver once
    if (initial) {
      this.#initialReadyFired = true;
      this.#initialReadyResolver?.();
    }

    // Resolve the ready promise
    if (this.#readyResolve) {
      this.#readyResolve();
      this.#readyResolve = null;
      this.#readyPromise = null;
    }

    // Public 'render' event — fires once per completed flush, after plugin
    // afterRender hooks and after ready()/whenReady() have resolved.
    // Consumers use this to act on the rendered DOM (e.g. focus the first
    // input of a freshly added row) without setTimeout / double-RAF hacks.
    if (phase !== 0) {
      this.#dispatchRenderEvent(phase, initial);
    }
  }

  /** Escalate this flush to COLUMNS when a row hook called `requestColumns`. */
  #serveRowHookRequest(phase: RenderPhase | 0): RenderPhase | 0 {
    if (!this.#rowHookColumns) return phase;
    this.#rowHookColumns = false;
    if (phase >= RenderPhase.COLUMNS) return phase;
    // A COLUMNS flush merges config before processRows; nothing changed the config since.
    this.#grid._schedulerMergeConfig();
    return RenderPhase.COLUMNS;
  }

  #dispatchRenderEvent(phase: RenderPhase, initial: boolean): void {
    const virt = this.#grid._virtualization;
    // `visibleRange` is `{ start, end }` whenever virtualization is enabled
    // (including the empty-dataset `{ 0, 0 }` case); only `null` when
    // virtualization is disabled. Lets consumers distinguish the two.
    const visibleRange = virt?.enabled ? { start: virt.start, end: virt.end } : null;
    const detail: RenderDetail = {
      phase,
      initial,
      rowCount: this.#grid._rows?.length ?? 0,
      visibleRange,
    };
    this.#grid._hostElement.dispatchEvent(new CustomEvent('render', { detail, bubbles: true, composed: true }));
  }
}
// #endregion

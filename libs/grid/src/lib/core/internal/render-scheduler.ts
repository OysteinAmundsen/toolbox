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

import type { InternalGrid } from '../types';

// #region Types & Enums
/**
 * Render phases in order of execution.
 * Higher phases include all lower phase work.
 *
 * @category Plugin Development
 */
export enum RenderPhase {
  /** Lightweight style updates only (plugin afterRender hooks) */
  STYLE = 1,
  /** Virtual window recalculation (includes STYLE) */
  VIRTUALIZATION = 2,
  /** Header re-render (includes VIRTUALIZATION) */
  HEADER = 3,
  /** Row model rebuild (includes HEADER) */
  ROWS = 4,
  /** Column processing (includes ROWS) */
  COLUMNS = 5,
  /** Full render including config merge (includes COLUMNS) */
  FULL = 6,
}

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

    const phase = this.#pendingPhase;
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
      this.#grid._schedulerProcessRows();
    }

    // Phase 5 (COLUMNS): Process columns + update template
    if (phase >= RenderPhase.COLUMNS) {
      this.#grid._schedulerProcessColumns();
      this.#grid._schedulerUpdateTemplate();
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

    // Fire initial ready resolver once
    if (!this.#initialReadyFired && this.#initialReadyResolver) {
      this.#initialReadyFired = true;
      this.#initialReadyResolver();
    }

    // Resolve the ready promise
    if (this.#readyResolve) {
      this.#readyResolve();
      this.#readyResolve = null;
      this.#readyPromise = null;
    }
  }
}
// #endregion

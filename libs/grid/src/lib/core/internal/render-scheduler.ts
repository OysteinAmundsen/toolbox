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
 * const scheduler = new RenderScheduler({
 *   mergeConfig: () => this.#mergeEffectiveConfig(),
 *   processColumns: () => this.#processColumns(),
 *   processRows: () => this.#rebuildRowModel(),
 *   renderHeader: () => renderHeader(this),
 *   updateTemplate: () => updateTemplate(this),
 *   renderVirtualWindow: () => this.refreshVirtualWindow(true),
 *   afterRender: () => this.#pluginManager?.afterRender(),
 *   isConnected: () => this.isConnected && this.#connected,
 * });
 *
 * // Request a full render
 * scheduler.requestPhase(RenderPhase.FULL, 'initial-setup');
 *
 * // Wait for render to complete
 * await scheduler.whenReady();
 * ```
 */

/**
 * Render phases in order of execution.
 * Higher phases include all lower phase work.
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
/**
 * Callbacks that the scheduler invokes during flush.
 * Each callback corresponds to work done in a specific phase.
 */
export interface RenderCallbacks {
  /** Merge effective config (FULL phase) */
  mergeConfig: () => void;
  /** Process columns through plugins (COLUMNS phase) */
  processColumns: () => void;
  /** Rebuild row model through plugins (ROWS phase) */
  processRows: () => void;
  /** Render header DOM (HEADER phase) */
  renderHeader: () => void;
  /** Update CSS grid template (ROWS phase) */
  updateTemplate: () => void;
  /** Recalculate virtual window (VIRTUALIZATION phase) */
  renderVirtualWindow: () => void;
  /** Run plugin afterRender hooks (STYLE phase) */
  afterRender: () => void;
  /** Check if grid is still connected to DOM */
  isConnected: () => boolean;
}

/**
 * Centralized render scheduler that batches all grid rendering into single RAF.
 */
export class RenderScheduler {
  readonly #callbacks: RenderCallbacks;

  /** Current pending phase (0 = none pending) */
  #pendingPhase: RenderPhase | 0 = 0;

  /** RAF handle for cancellation */
  #rafHandle = 0;

  /** Source that triggered the current pending render */
  #pendingSource = '';

  /** Promise that resolves when current render completes */
  #readyPromise: Promise<void> | null = null;
  #readyResolve: (() => void) | null = null;

  /** Initial ready resolver (for component's initial ready() promise) */
  #initialReadyResolver: (() => void) | null = null;
  #initialReadyFired = false;

  constructor(callbacks: RenderCallbacks) {
    this.#callbacks = callbacks;
  }

  /**
   * Request a render at the specified phase.
   * Multiple requests are batched - the highest phase wins.
   *
   * @param phase - The render phase to execute
   * @param source - Debug identifier for what triggered this request
   */
  requestPhase(phase: RenderPhase, source: string): void {
    // Merge to highest phase
    if (phase > this.#pendingPhase) {
      this.#pendingPhase = phase;
      this.#pendingSource = source;
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
    this.#pendingSource = '';

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
   * Get the current pending phase (0 if none).
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
    if (!this.#callbacks.isConnected()) {
      this.#pendingPhase = 0;
      this.#pendingSource = '';
      if (this.#readyResolve) {
        this.#readyResolve();
        this.#readyResolve = null;
        this.#readyPromise = null;
      }
      return;
    }

    const phase = this.#pendingPhase;
    this.#pendingPhase = 0;
    this.#pendingSource = '';

    // Execute phases in order (higher phases include lower phase work)
    // The execution order respects data dependencies:
    // mergeConfig → processRows → processColumns → renderHeader → virtualWindow → afterRender

    // mergeConfig runs for FULL phase OR COLUMNS phase (to pick up framework adapter renderers)
    // IMPORTANT: mergeConfig must run BEFORE processRows because the row model depends on
    // column configuration, and framework adapters (React/Angular) may register renderers
    // asynchronously after the initial gridConfig is set.
    if (phase >= RenderPhase.COLUMNS) {
      this.#callbacks.mergeConfig();
    }

    // Phase 4 (ROWS): Rebuild row model
    // NOTE: processRows MUST run before processColumns because tree plugin's
    // processColumns depends on flattenedRows populated by processRows
    if (phase >= RenderPhase.ROWS) {
      this.#callbacks.processRows();
    }

    // Phase 5 (COLUMNS): Process columns + update template
    if (phase >= RenderPhase.COLUMNS) {
      this.#callbacks.processColumns();
      this.#callbacks.updateTemplate();
    }

    // Phase 3 (HEADER): Render header
    if (phase >= RenderPhase.HEADER) {
      this.#callbacks.renderHeader();
    }

    // Phase 2 (VIRTUALIZATION): Recalculate virtual window
    if (phase >= RenderPhase.VIRTUALIZATION) {
      this.#callbacks.renderVirtualWindow();
    }

    // Phase 1 (STYLE): Run afterRender hooks (always runs)
    if (phase >= RenderPhase.STYLE) {
      this.#callbacks.afterRender();
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

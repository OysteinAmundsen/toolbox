/**
 * PortalManager — renders React content into arbitrary DOM containers
 * while preserving the parent React context tree.
 *
 * Instead of `createRoot()` (which creates isolated React trees that lose
 * all context), the PortalManager uses `createPortal()` to render content
 * into grid cells, editors, detail panels, etc. This preserves Router,
 * Theme, i18n, Redux, and all other React context from the host application.
 *
 * **Performance:** Portal updates are batched via `queueMicrotask`. Multiple
 * `renderPortal` / `removePortal` calls within the same synchronous execution
 * context (e.g., one grid render pass) are coalesced into a single
 * `flushSync` call, avoiding O(N²) re-renders during scroll.
 *
 * @internal
 */

import { Component, forwardRef, useImperativeHandle, useReducer, useRef, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';

// #region Per-portal error boundary

interface PortalBoundaryProps {
  /** Portal key — passed to onError so the manager can drop the entry. */
  portalKey: string;
  /** Notified when the subtree throws during render or commit. */
  onError: (key: string, error: unknown) => void;
  children: ReactNode;
}

/**
 * Error boundary wrapped around each portal subtree.
 *
 * Why: a custom editor / renderer can fail to commit if external code
 * (browser popover API, third-party widget, animation library) moves its
 * DOM out from under React. The reconciler then throws inside a deletion
 * effect (`removeChild` on a node whose parent has changed). Without a
 * boundary, the throw bubbles to the host app and React Router shows
 * the "Unexpected Application Error" page.
 *
 * The boundary catches the throw, asks the manager to drop this entry
 * from `portalsRef`, and renders nothing. The next render then has one
 * fewer portal, which lets React reconcile cleanly. Other portals in
 * the same `PortalManager` are unaffected. Issue #250.
 */
class PortalBoundary extends Component<PortalBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError(this.props.portalKey, error);
  }

  override render(): ReactNode {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

// #endregion

// #region Types

interface PortalEntry {
  container: HTMLElement;
  element: ReactNode;
}

/**
 * Imperative handle exposed by PortalManager via ref.
 */
export interface PortalManagerHandle {
  /**
   * Add or update a portal entry. The update is batched —
   * all calls within the same microtask are coalesced into
   * a single React commit via `flushSync`.
   */
  renderPortal(key: string, container: HTMLElement, element: ReactNode): void;

  /**
   * Remove a portal by key.
   * @param key unique key of the portal to remove
   * @param sync - When true, flush the removal synchronously via `flushSync`
   *   so the caller can safely mutate the container DOM immediately after.
   *   Use this in cleanup callbacks that precede external DOM clearing
   *   (e.g., tool panel accordion collapse sets `innerHTML = ''`).
   *   While a batch is open via {@link beginBatch}, the sync flush is
   *   suppressed and the deletion rides the batch's deferred render —
   *   the caller is then responsible for ensuring the affected container
   *   is detached before {@link endBatch} runs.
   */
  removePortal(key: string, sync?: boolean): void;

  /**
   * Open a teardown batch. While open, sync portal removals do NOT trigger
   * `flushSync` per call. Multiple bulk-cleanup paths (`_clearRowPool`,
   * row-pool shrink, row rebuild) can release N portals without emitting
   * N `flushSync was called from inside a lifecycle method` warnings.
   *
   * Calls nest; only the outermost {@link endBatch} schedules the flush.
   *
   * Caller MUST detach every affected container from the DOM before
   * `endBatch()` runs — otherwise the deferred render commits an unmount
   * against a container whose children were already wiped, reproducing
   * the original `removeChild` `NotFoundError` that issue #250 fixed.
   * Bulk paths in grid core (`_clearRowPool`, pool-shrink, `renderInlineRow`)
   * satisfy this naturally because they wipe the parent (`bodyEl.innerHTML = ''`,
   * `el.remove()`, `rowEl.innerHTML = ''`) AFTER the per-cell release loop.
   */
  beginBatch(): void;

  /**
   * Close a teardown batch. When the depth returns to zero, schedules a
   * single render so the manager's render-time `isConnected` filter drops
   * any portals whose containers are now detached. No `flushSync` is used.
   */
  endBatch(): void;

  /** Remove all portals. */
  clear(): void;
}

// #endregion

// #region Component

/**
 * React component that manages portal-based rendering for the grid adapter.
 *
 * Mount this inside the application's React tree (inside all providers)
 * so that portal content inherits the full context chain.
 *
 * @internal
 */
export const PortalManager = forwardRef<PortalManagerHandle>(function PortalManager(_, ref) {
  const portalsRef = useRef(new Map<string, PortalEntry>());
  const [, forceRender] = useReducer((c: number) => c + 1, 0);
  const batchPendingRef = useRef(false);
  const pruneTimerRef = useRef(0);
  /**
   * Depth counter for `beginBatch` / `endBatch`. While > 0, sync removals
   * skip `flushSync` and the deletion rides a deferred render scheduled
   * by the outermost `endBatch`.
   */
  const batchDepthRef = useRef(0);
  /** Set when at least one removal occurred during the current batch. */
  const batchDirtyRef = useRef(false);

  /**
   * Schedule a single `flushSync` to commit all pending portal changes.
   * Multiple calls within the same synchronous execution context are
   * coalesced into one microtask, reducing scroll-time re-renders from
   * O(N × totalPortals) to O(totalPortals).
   */
  const scheduleFlush = () => {
    if (!batchPendingRef.current) {
      batchPendingRef.current = true;
      queueMicrotask(() => {
        batchPendingRef.current = false;
        flushSync(forceRender);
        schedulePrune();
      });
    }
  };

  /**
   * Schedule a prune pass after the next frame to remove portals whose
   * containers have been detached from the DOM (e.g., grid shrank its
   * row pool without calling adapter cleanup).
   *
   * Uses a plain `forceRender()` (state update) — NOT `flushSync` — for
   * two reasons:
   *
   * 1. The render itself filters out detached portals (see render body
   *    below), so React never commits an unmount against an orphaned
   *    container. That filter is the real defense; this scheduler just
   *    nudges React to re-render so the filter runs.
   * 2. In React 18+/19, exceptions thrown during a `flushSync` commit
   *    are routed to the nearest error boundary's `componentDidCatch`
   *    rather than re-thrown synchronously to the `flushSync` caller
   *    (see React's `defaultOnCaughtError`). A `try/catch` around
   *    `flushSync(forceRender)` therefore cannot recover from a bad
   *    commit — the boundary state has already been mutated by the
   *    time `flushSync` returns. Issue #250.
   */
  const schedulePrune = () => {
    if (pruneTimerRef.current) return;
    pruneTimerRef.current = requestAnimationFrame(() => {
      pruneTimerRef.current = 0;
      // Render-time filter handles the actual prune; just trigger a render.
      forceRender();
    });
  };

  /**
   * Called by a `PortalBoundary` when its child subtree throws. Drops
   * the offending entry and re-renders so the next commit excludes it.
   * Surfaces the error to the console so consumers can still see it.
   * Issue #250.
   */
  const handlePortalError = (key: string, error: unknown): void => {
    console.error(`[grid-react] Portal "${key}" crashed; dropping.`, error);
    portalsRef.current.delete(key);
    schedulePrune();
  };

  useImperativeHandle(
    ref,
    () => ({
      renderPortal(key: string, container: HTMLElement, element: ReactNode) {
        portalsRef.current.set(key, { container, element });
        scheduleFlush();
      },

      removePortal(key: string, sync?: boolean) {
        if (portalsRef.current.delete(key)) {
          if (batchDepthRef.current > 0) {
            // Inside a teardown batch — defer the framework commit. The
            // caller has promised to detach the affected container before
            // `endBatch()` runs, so the next render's `isConnected` filter
            // will silently drop the entry without committing an unmount.
            // This is what eliminates the per-cell `flushSync` warnings
            // during bulk operations like grouping changes (#330).
            batchDirtyRef.current = true;
          } else if (sync) {
            // Synchronous removal — caller is about to clear the container
            // DOM immediately (e.g., accordion collapse via innerHTML = '').
            // React must fully unmount portal content before that happens.
            flushSync(forceRender);
          } else {
            scheduleFlush();
          }
        }
      },

      beginBatch() {
        batchDepthRef.current++;
      },

      endBatch() {
        if (batchDepthRef.current === 0) return;
        batchDepthRef.current--;
        if (batchDepthRef.current === 0 && batchDirtyRef.current) {
          batchDirtyRef.current = false;
          // Plain forceRender (NOT flushSync). React batches with the
          // surrounding event/lifecycle, the next render runs the
          // `isConnected` filter against now-detached containers, and no
          // commit deletion is needed for them. No rAF prune chaser
          // needed — the caller has already detached every affected
          // container before invoking `endBatch`, so this single render
          // is sufficient (unlike `scheduleFlush`, which fires after
          // arbitrary mutations and pairs with a frame-later prune to
          // catch containers detached between flush and frame).
          forceRender();
        }
      },

      clear() {
        if (portalsRef.current.size > 0) {
          portalsRef.current.clear();
          if (pruneTimerRef.current) {
            cancelAnimationFrame(pruneTimerRef.current);
            pruneTimerRef.current = 0;
          }
          scheduleFlush();
        }
      },
    }),
    // forceRender is stable (useReducer dispatch), refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const portals: ReactNode[] = [];
  // Render-time short-circuit: skip portals whose container has been
  // detached from the DOM since the last render. Without this, React
  // would attempt to commit an unmount against an orphaned container,
  // and `container.removeChild(child)` would throw if `child` had been
  // moved elsewhere by external DOM mutation (e.g., a popover-API
  // editor moves its DOM into the top layer, or grid core wiped a cell
  // before the adapter released it). Issue #250.
  //
  // Stale entries are dropped after render via a microtask so we don't
  // mutate `portalsRef` during the render pass itself.
  let stale: string[] | null = null;
  for (const [key, { container, element }] of portalsRef.current) {
    if (!container.isConnected) {
      (stale ??= []).push(key);
      continue;
    }
    // Each portal is wrapped in its own error boundary so that a
    // commit-time crash in one editor / renderer cannot poison the
    // host app's React tree. On crash, the boundary fires `onError`
    // which drops the entry; the next render commits cleanly without
    // it. Other portals are unaffected. Issue #250.
    portals.push(
      createPortal(
        <PortalBoundary portalKey={key} onError={handlePortalError}>
          {element}
        </PortalBoundary>,
        container,
        key,
      ),
    );
  }
  if (stale) {
    const toDrop = stale;
    queueMicrotask(() => {
      for (const k of toDrop) portalsRef.current.delete(k);
    });
  }

  return <>{portals}</>;
});

// #endregion

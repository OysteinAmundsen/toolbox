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

import { useImperativeHandle, useReducer, useRef, forwardRef, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';

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
   */
  removePortal(key: string, sync?: boolean): void;

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
   */
  const schedulePrune = () => {
    if (pruneTimerRef.current) return;
    pruneTimerRef.current = requestAnimationFrame(() => {
      pruneTimerRef.current = 0;
      let changed = false;
      for (const [key, entry] of portalsRef.current) {
        if (!entry.container.isConnected) {
          portalsRef.current.delete(key);
          changed = true;
        }
      }
      if (changed) flushSync(forceRender);
    });
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
          if (sync) {
            // Synchronous removal — caller is about to clear the container
            // DOM immediately (e.g., accordion collapse via innerHTML = '').
            // React must fully unmount portal content before that happens.
            flushSync(forceRender);
          } else {
            scheduleFlush();
          }
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
  for (const [key, { container, element }] of portalsRef.current) {
    portals.push(createPortal(element, container, key));
  }

  return <>{portals}</>;
});

// #endregion

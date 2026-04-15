/**
 * TeleportManager — renders Vue content into arbitrary DOM containers
 * while preserving the parent Vue app context tree.
 *
 * Instead of `createApp()` (which creates isolated Vue trees that lose
 * all context), the TeleportManager uses `<Teleport>` to render content
 * into grid cells, editors, detail panels, etc. This preserves provide/inject,
 * Pinia stores, Vue Router, and all other Vue context from the host application.
 *
 * **Performance:** Teleport updates are batched via `queueMicrotask`. Multiple
 * `renderTeleport` / `removeTeleport` calls within the same synchronous execution
 * context (e.g., one grid render pass) are coalesced into a single state update,
 * avoiding O(N²) re-renders during scroll.
 *
 * @internal
 */

import { defineComponent, h, onBeforeUnmount, ref, Teleport, type VNode } from 'vue';

// #region Types

interface TeleportEntry {
  container: HTMLElement;
  vnode: VNode;
}

/**
 * Imperative handle exposed by TeleportManager via template ref.
 */
export interface TeleportManagerHandle {
  /**
   * Add or update a teleport entry. The update is batched —
   * all calls within the same microtask are coalesced into
   * a single Vue update.
   */
  renderTeleport(key: string, container: HTMLElement, vnode: VNode): void;

  /** Remove a teleport by key. */
  removeTeleport(key: string): void;

  /** Remove all teleports. */
  clear(): void;
}

// #endregion

// #region Component

/**
 * Vue component that manages teleport-based rendering for the grid adapter.
 *
 * Mount this inside the application's Vue tree (inside all providers)
 * so that teleport content inherits the full context chain.
 *
 * @internal
 */
export const TeleportManager = defineComponent({
  name: 'TeleportManager',

  setup(_, { expose }) {
    const teleports = ref(new Map<string, TeleportEntry>());
    let batchPending = false;
    let pruneTimer = 0;
    // Pending operations collected during the current microtask batch
    let pendingOps: Array<
      { type: 'set'; key: string; entry: TeleportEntry } | { type: 'delete'; key: string } | { type: 'clear' }
    > = [];

    /**
     * Schedule a single state update to commit all pending teleport changes.
     * Multiple calls within the same synchronous execution context are
     * coalesced into one microtask, reducing scroll-time re-renders.
     */
    const scheduleFlush = () => {
      if (!batchPending) {
        batchPending = true;
        queueMicrotask(() => {
          batchPending = false;

          // Apply all pending operations in a single reactive update
          const ops = pendingOps;
          pendingOps = [];

          // Build new map from current state, applying ops
          const newMap = new Map(teleports.value);
          for (const op of ops) {
            if (op.type === 'set') {
              newMap.set(op.key, op.entry);
            } else if (op.type === 'delete') {
              newMap.delete(op.key);
            } else if (op.type === 'clear') {
              newMap.clear();
            }
          }

          teleports.value = newMap;
          schedulePrune();
        });
      }
    };

    /**
     * Schedule a prune pass after the next frame to remove teleports whose
     * containers have been detached from the DOM.
     */
    const schedulePrune = () => {
      if (pruneTimer) return;
      pruneTimer = requestAnimationFrame(() => {
        pruneTimer = 0;
        let changed = false;
        const newMap = new Map(teleports.value);
        for (const [key, entry] of newMap) {
          if (!entry.container.isConnected) {
            newMap.delete(key);
            changed = true;
          }
        }
        if (changed) {
          teleports.value = newMap;
        }
      });
    };

    onBeforeUnmount(() => {
      if (pruneTimer) {
        cancelAnimationFrame(pruneTimer);
        pruneTimer = 0;
      }
    });

    const handle: TeleportManagerHandle = {
      renderTeleport(key: string, container: HTMLElement, vnode: VNode) {
        pendingOps.push({ type: 'set', key, entry: { container, vnode } });
        scheduleFlush();
      },

      removeTeleport(key: string) {
        pendingOps.push({ type: 'delete', key });
        scheduleFlush();
      },

      clear() {
        pendingOps.push({ type: 'clear' });
        if (pruneTimer) {
          cancelAnimationFrame(pruneTimer);
          pruneTimer = 0;
        }
        scheduleFlush();
      },
    };

    expose(handle);

    return () => {
      const nodes: VNode[] = [];
      for (const [key, { container, vnode }] of teleports.value) {
        nodes.push(h(Teleport, { to: container, key }, [vnode]));
      }
      return nodes;
    };
  },
});

// #endregion

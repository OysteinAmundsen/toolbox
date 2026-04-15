/**
 * Teleport bridge — module-level registry that connects non-Vue code
 * (the grid adapter, feature bridge files) to the TeleportManager
 * mounted inside each TbwGrid component tree.
 *
 * Each TbwGrid instance registers its own TeleportManager via
 * `setTeleportManager(gridEl, handle)`. The bridge resolves the correct
 * manager for a given container using `container.closest('tbw-grid')`
 * or the explicit `gridEl` parameter.
 *
 * When no TeleportManager is available (e.g., adapter used standalone),
 * the bridge falls back to `createApp()`.
 *
 * @internal
 */

import { createApp, type App, type VNode } from 'vue';
import type { TeleportManagerHandle } from './teleport-manager';

// #region Types

interface FallbackEntry {
  app: App;
  container: HTMLElement;
}

// #endregion

// #region State

/** Map of grid elements to their TeleportManager handles. */
const teleportManagers = new Map<HTMLElement, TeleportManagerHandle>();

/** Reverse lookup: teleport key → owning grid element. */
const keyToGrid = new Map<string, HTMLElement>();

/** Fallback Vue apps for when no TeleportManager is available. */
const fallbackApps = new Map<string, FallbackEntry>();

let nextKey = 0;

// #endregion

// #region Bridge management

/**
 * Register (or unregister) a TeleportManager for a specific grid element.
 * Called from TbwGrid on mount/unmount.
 *
 * @param gridEl - The `<tbw-grid>` DOM element that owns the TeleportManager.
 * @param tm - The TeleportManager handle, or `null` to unregister.
 */
export function setTeleportManager(gridEl: HTMLElement, tm: TeleportManagerHandle | null): void {
  if (tm) {
    teleportManagers.set(gridEl, tm);
  } else {
    teleportManagers.delete(gridEl);
  }
}

/**
 * Get the TeleportManager handle for a specific grid element.
 * If no grid element is provided, returns the first available handle
 * (single-grid convenience).
 */
export function getTeleportManager(gridEl?: HTMLElement): TeleportManagerHandle | null {
  if (gridEl) return teleportManagers.get(gridEl) ?? null;
  if (teleportManagers.size === 1) return teleportManagers.values().next().value!;
  return null;
}

// #endregion

// #region Internal helpers

/**
 * Resolve the owning grid element for a container.
 * Tries explicit `gridEl`, then DOM traversal, then single-TM fallback.
 */
function resolveGrid(container: HTMLElement, gridEl?: HTMLElement): HTMLElement | undefined {
  if (gridEl) return gridEl;
  const closest = container.closest('tbw-grid') as HTMLElement | null;
  if (closest) return closest;
  // Single-grid optimization: if only one TM is registered, use it
  if (teleportManagers.size === 1) return teleportManagers.keys().next().value!;
  return undefined;
}

/**
 * Clean up a fallback app if one exists for the given key.
 * Prevents leaks when transitioning from fallback → TeleportManager.
 */
function cleanupFallbackApp(key: string): void {
  const entry = fallbackApps.get(key);
  if (entry) {
    try {
      entry.app.unmount();
    } catch {
      // Ignore cleanup errors
    }
    fallbackApps.delete(key);
  }
}

// #endregion

// #region Render helpers

/**
 * Render a Vue VNode into a DOM container.
 *
 * - If a TeleportManager is available for the owning grid, creates a teleport
 *   (context-preserving).
 * - Otherwise, falls back to `createApp()` (isolated tree, no context).
 *
 * @param container - The DOM element to render into.
 * @param vnode - The Vue VNode to render.
 * @param existingKey - Reuse a previously-returned key for updates.
 * @param gridEl - Explicit grid element (avoids DOM traversal).
 * @returns The teleport key (for future updates or removal).
 */
export function renderToContainer(
  container: HTMLElement,
  vnode: VNode,
  existingKey?: string,
  gridEl?: HTMLElement,
): string {
  const key = existingKey ?? `t-${nextKey++}`;
  const grid = resolveGrid(container, gridEl);
  const tm = grid ? teleportManagers.get(grid) : undefined;

  if (tm) {
    // Transitioning from fallback → TeleportManager: clean up old app
    cleanupFallbackApp(key);
    if (grid) keyToGrid.set(key, grid);
    tm.renderTeleport(key, container, vnode);
  } else {
    let entry = fallbackApps.get(key);
    if (!entry) {
      const app = createApp({
        render() {
          return vnode;
        },
      });
      app.mount(container);
      entry = { app, container };
      fallbackApps.set(key, entry);
    } else {
      // Update: unmount old, mount new
      try {
        entry.app.unmount();
      } catch {
        // Ignore
      }
      const app = createApp({
        render() {
          return vnode;
        },
      });
      app.mount(container);
      entry.app = app;
    }
  }

  return key;
}

/**
 * Remove a teleport (or fallback app) by key.
 */
export function removeFromContainer(key: string): void {
  // Find the correct TeleportManager via reverse lookup
  const grid = keyToGrid.get(key);
  const tm = grid ? teleportManagers.get(grid) : undefined;
  tm?.removeTeleport(key);
  keyToGrid.delete(key);

  cleanupFallbackApp(key);
}

/**
 * Remove all teleports and fallback apps for a specific grid.
 * Preferred over `clearAllContainers()` in multi-grid scenarios.
 */
export function clearContainersForGrid(gridEl: HTMLElement): void {
  const tm = teleportManagers.get(gridEl);
  tm?.clear();

  // Clean up reverse lookup entries for this grid
  for (const [key, grid] of keyToGrid) {
    if (grid === gridEl) {
      cleanupFallbackApp(key);
      keyToGrid.delete(key);
    }
  }
}

/**
 * Remove all teleports and fallback apps across all grids.
 * Use `clearContainersForGrid()` in multi-grid scenarios instead.
 */
export function clearAllContainers(): void {
  for (const tm of teleportManagers.values()) {
    tm.clear();
  }
  keyToGrid.clear();

  for (const entry of fallbackApps.values()) {
    try {
      entry.app.unmount();
    } catch {
      // Ignore cleanup errors
    }
  }
  fallbackApps.clear();
}

/**
 * Reset the key counter. Only use in tests.
 * @internal
 */
export function resetKeyCounter(): void {
  nextKey = 0;
}

/**
 * Reset all bridge state. Only use in tests.
 * Clears all TeleportManager registrations, key mappings, and fallback apps.
 * @internal
 */
export function resetBridge(): void {
  clearAllContainers();
  teleportManagers.clear();
  keyToGrid.clear();
  nextKey = 0;
}

// #endregion

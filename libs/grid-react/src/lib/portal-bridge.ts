/**
 * Portal bridge — module-level registry that connects non-React code
 * (the grid adapter, feature bridge files, react-column-config wrappers)
 * to the PortalManager mounted inside each DataGrid component tree.
 *
 * Each DataGrid instance registers its own PortalManager via
 * `setPortalManager(gridEl, handle)`. The bridge resolves the correct
 * manager for a given container using `container.closest('tbw-grid')`
 * or the explicit `gridEl` parameter.
 *
 * When no PortalManager is available (e.g., adapter used standalone),
 * the bridge falls back to `createRoot()`.
 *
 * @internal
 */

import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { PortalManagerHandle } from './portal-manager';

// #region State

/** Map of grid elements to their PortalManager handles. */
const portalManagers = new Map<HTMLElement, PortalManagerHandle>();

/** Reverse lookup: portal key → owning grid element. */
const keyToGrid = new Map<string, HTMLElement>();

/** Fallback React roots for when no PortalManager is available. */
const fallbackRoots = new Map<string, Root>();

let nextKey = 0;

// #endregion

// #region Bridge management

/**
 * Register (or unregister) a PortalManager for a specific grid element.
 * Called from DataGrid on mount/unmount.
 *
 * @param gridEl - The `<tbw-grid>` DOM element that owns the PortalManager.
 * @param pm - The PortalManager handle, or `null` to unregister.
 */
export function setPortalManager(gridEl: HTMLElement, pm: PortalManagerHandle | null): void {
  if (pm) {
    portalManagers.set(gridEl, pm);
  } else {
    portalManagers.delete(gridEl);
  }
}

/**
 * Get the PortalManager handle for a specific grid element.
 * If no grid element is provided, returns the first available handle
 * (single-grid convenience).
 */
export function getPortalManager(gridEl?: HTMLElement): PortalManagerHandle | null {
  if (gridEl) return portalManagers.get(gridEl) ?? null;
  if (portalManagers.size === 1) return portalManagers.values().next().value!;
  return null;
}

// #endregion

// #region Internal helpers

/**
 * Resolve the owning grid element for a container.
 * Tries explicit `gridEl`, then DOM traversal, then single-PM fallback.
 */
function resolveGrid(container: HTMLElement, gridEl?: HTMLElement): HTMLElement | undefined {
  if (gridEl) return gridEl;
  const closest = container.closest('tbw-grid') as HTMLElement | null;
  if (closest) return closest;
  // Single-grid optimization: if only one PM is registered, use it
  if (portalManagers.size === 1) return portalManagers.keys().next().value!;
  return undefined;
}

/**
 * Clean up a fallback root if one exists for the given key.
 * Prevents leaks when transitioning from fallback → PortalManager.
 */
function cleanupFallbackRoot(key: string): void {
  const root = fallbackRoots.get(key);
  if (root) {
    try {
      root.unmount();
    } catch {
      // Ignore cleanup errors
    }
    fallbackRoots.delete(key);
  }
}

// #endregion

// #region Render helpers

/**
 * Render a React element into a DOM container.
 *
 * - If a PortalManager is available for the owning grid, creates a portal
 *   (context-preserving).
 * - Otherwise, falls back to `createRoot` (isolated tree, no context).
 *
 * @param container - The DOM element to render into.
 * @param element - The React element to render.
 * @param existingKey - Reuse a previously-returned key for updates.
 * @param gridEl - Explicit grid element (avoids DOM traversal).
 * @returns The portal key (for future updates or removal).
 */
export function renderToContainer(
  container: HTMLElement,
  element: ReactNode,
  existingKey?: string,
  gridEl?: HTMLElement,
): string {
  const key = existingKey ?? `p-${nextKey++}`;
  const grid = resolveGrid(container, gridEl);
  const pm = grid ? portalManagers.get(grid) : undefined;

  if (pm) {
    // Transitioning from fallback → PortalManager: clean up old root
    cleanupFallbackRoot(key);
    if (grid) keyToGrid.set(key, grid);
    pm.renderPortal(key, container, element);
  } else {
    let root = fallbackRoots.get(key);
    if (!root) {
      root = createRoot(container);
      fallbackRoots.set(key, root);
    }
    flushSync(() => root!.render(element));
  }

  return key;
}

/**
 * Remove a portal (or fallback root) by key.
 *
 * @param options.sync - When true, flush the removal synchronously so the
 *   caller can safely clear the container DOM immediately after (e.g.,
 *   tool panel accordion collapse sets `innerHTML = ''`).
 */
export function removeFromContainer(key: string, options?: { sync?: boolean }): void {
  // Find the correct PortalManager via reverse lookup
  const grid = keyToGrid.get(key);
  const pm = grid ? portalManagers.get(grid) : undefined;
  pm?.removePortal(key, options?.sync);
  keyToGrid.delete(key);

  cleanupFallbackRoot(key);
}

/**
 * Remove all portals and fallback roots for a specific grid.
 * Preferred over `clearAllContainers()` in multi-grid scenarios.
 */
export function clearContainersForGrid(gridEl: HTMLElement): void {
  const pm = portalManagers.get(gridEl);
  pm?.clear();

  // Clean up reverse lookup entries for this grid
  for (const [key, grid] of keyToGrid) {
    if (grid === gridEl) {
      cleanupFallbackRoot(key);
      keyToGrid.delete(key);
    }
  }
}

/**
 * Open a teardown batch on every registered PortalManager. Used by the
 * adapter's `beginBatch()` hook so grid core's bulk teardown loops
 * (`_clearRowPool`, row-pool shrink, `renderInlineRow`) can release N
 * portals without N `flushSync` warnings (#330).
 *
 * Optional `gridEl` scopes the batch to a single grid; omit to batch
 * across all grids (the multi-grid case is rare but harmless).
 */
export function beginPortalBatch(gridEl?: HTMLElement): void {
  if (gridEl) {
    portalManagers.get(gridEl)?.beginBatch();
    return;
  }
  for (const pm of portalManagers.values()) pm.beginBatch();
}

/**
 * Close a teardown batch opened by {@link beginPortalBatch}. Calls MUST
 * pair with `beginPortalBatch` (same grid scope or both global).
 */
export function endPortalBatch(gridEl?: HTMLElement): void {
  if (gridEl) {
    portalManagers.get(gridEl)?.endBatch();
    return;
  }
  for (const pm of portalManagers.values()) pm.endBatch();
}

/**
 * Remove all portals and fallback roots across all grids.
 * Use `clearContainersForGrid()` in multi-grid scenarios instead.
 */
export function clearAllContainers(): void {
  for (const pm of portalManagers.values()) {
    pm.clear();
  }
  keyToGrid.clear();

  for (const root of fallbackRoots.values()) {
    try {
      root.unmount();
    } catch {
      // Ignore cleanup errors
    }
  }
  fallbackRoots.clear();
}

/**
 * Wrap a React-returning render function as a vanilla `(ctx) => HTMLElement | null`
 * suitable for any grid renderer slot (cell renderer, group header, pinned-row
 * panel, etc.). Returns `null` when the React function returns `null` /
 * `undefined` / `false`, so built-in conditional renderers can opt out.
 *
 * The wrapper is a `<div style="display:contents">` so it imposes no layout.
 * Each call mounts a fresh portal — call sites that need to update the same
 * container instead should use `renderToContainer` directly with `existingKey`.
 */
export function createNodeBridge<TCtx>(reactFn: (ctx: TCtx) => ReactNode): (ctx: TCtx) => HTMLElement | null {
  return (ctx) => {
    const node = reactFn(ctx);
    if (node == null || node === false) return null;
    // Pass through: vanilla renderers (e.g. `rowCountPanel()` from
    // `@toolbox-web/grid/plugins/pinned-rows`) return a real DOM node, not a
    // React element. Mounting one through React triggers
    // "Objects are not valid as a React child". The grid only needs an
    // HTMLElement, so just hand it back.
    if (node instanceof HTMLElement) return node;
    const wrapper = document.createElement('div');
    wrapper.style.display = 'contents';
    renderToContainer(wrapper, node);
    return wrapper;
  };
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
 * Clears all PortalManager registrations, key mappings, and fallback roots.
 * @internal
 */
export function resetBridge(): void {
  clearAllContainers();
  portalManagers.clear();
  keyToGrid.clear();
  nextKey = 0;
}

// #endregion

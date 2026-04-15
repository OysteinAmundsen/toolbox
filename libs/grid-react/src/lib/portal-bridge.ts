/**
 * Portal bridge — module-level singleton that connects non-React code
 * (the grid adapter, feature bridge files, react-column-config wrappers)
 * to the PortalManager mounted inside the DataGrid component tree.
 *
 * When a PortalManager is mounted, `setPortalManager()` is called and
 * all subsequent `renderToContainer()` calls use portals (preserving
 * React context). When no PortalManager is available (e.g., adapter used
 * standalone), the bridge falls back to `createRoot()`.
 *
 * @internal
 */

import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { PortalManagerHandle } from './portal-manager';

// #region State

let portalManager: PortalManagerHandle | null = null;

/** Fallback React roots for when the PortalManager is not available. */
const fallbackRoots = new Map<string, Root>();

let nextKey = 0;

// #endregion

// #region Bridge management

/**
 * Connect the PortalManager handle. Called from DataGrid on mount.
 * Pass `null` on unmount to disconnect.
 */
export function setPortalManager(pm: PortalManagerHandle | null): void {
  portalManager = pm;
}

/**
 * Get the current PortalManager handle, or null if not connected.
 */
export function getPortalManager(): PortalManagerHandle | null {
  return portalManager;
}

// #endregion

// #region Render helpers

/**
 * Render a React element into a DOM container.
 *
 * - If a PortalManager is connected, creates a portal (context-preserving).
 * - Otherwise, falls back to `createRoot` (isolated tree, no context).
 *
 * @returns The portal key (for future updates or removal).
 */
export function renderToContainer(
  container: HTMLElement,
  element: ReactNode,
  existingKey?: string,
): string {
  const key = existingKey ?? `p-${nextKey++}`;
  const pm = portalManager;

  if (pm) {
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
 */
export function removeFromContainer(key: string): void {
  portalManager?.removePortal(key);

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

/**
 * Remove all portals and fallback roots.
 */
export function clearAllContainers(): void {
  portalManager?.clear();

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
 * Reset the key counter. Only use in tests.
 * @internal
 */
export function resetKeyCounter(): void {
  nextKey = 0;
}

// #endregion

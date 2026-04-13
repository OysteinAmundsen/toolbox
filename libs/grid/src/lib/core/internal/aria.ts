/**
 * ARIA Accessibility Helpers
 *
 * Pure functions for managing ARIA attributes on grid elements.
 * Implements caching to avoid redundant DOM writes during scroll.
 *
 * @module internal/aria
 */

import type { A11yMessages, GridConfig } from '../types';
import { DEFAULT_A11Y_MESSAGES } from '../types';
import type { ShellState } from './shell';

// #region Types

/**
 * State for caching ARIA attributes to avoid redundant DOM writes.
 */
export interface AriaState {
  /** Last set row count */
  rowCount: number;
  /** Last set column count */
  colCount: number;
  /** Last set aria-label */
  ariaLabel: string | undefined;
  /** Last set aria-describedby */
  ariaDescribedBy: string | undefined;
}

/**
 * Create initial ARIA state.
 */
export function createAriaState(): AriaState {
  return {
    rowCount: -1,
    colCount: -1,
    ariaLabel: undefined,
    ariaDescribedBy: undefined,
  };
}

// #endregion

// #region Count Updates

/**
 * Update ARIA row and column counts on grid elements.
 * Uses caching to avoid redundant DOM writes on every scroll frame.
 *
 * @param state - ARIA state for caching
 * @param rowsBodyEl - Element to set aria-rowcount/aria-colcount on
 * @param bodyEl - Element to set role="rowgroup" on
 * @param rowCount - Current row count
 * @param colCount - Current column count
 * @returns true if anything was updated
 */
export function updateAriaCounts(
  state: AriaState,
  rowsBodyEl: HTMLElement | null,
  bodyEl: HTMLElement | null,
  rowCount: number,
  colCount: number,
): boolean {
  // Skip if nothing changed (hot path optimization for scroll)
  if (rowCount === state.rowCount && colCount === state.colCount) {
    return false;
  }

  const prevRowCount = state.rowCount;
  state.rowCount = rowCount;
  state.colCount = colCount;

  // Update ARIA counts on inner grid element
  if (rowsBodyEl) {
    rowsBodyEl.setAttribute('aria-rowcount', String(rowCount));
    rowsBodyEl.setAttribute('aria-colcount', String(colCount));
  }

  // Set role="rowgroup" on .rows only when there are rows (ARIA compliance)
  if (rowCount !== prevRowCount && bodyEl) {
    if (rowCount > 0) {
      bodyEl.setAttribute('role', 'rowgroup');
    } else {
      bodyEl.removeAttribute('role');
    }
  }

  return true;
}

// #endregion

// #region Label Updates

/**
 * Determine the effective aria-label for the grid.
 * Priority: explicit config > shell title > nothing
 *
 * @param config - Grid configuration
 * @param shellState - Shell state (for light DOM title)
 * @returns The aria-label to use, or undefined
 */
export function getEffectiveAriaLabel<T>(
  config: GridConfig<T> | undefined,
  shellState: ShellState | undefined,
): string | undefined {
  const explicitLabel = config?.gridAriaLabel;
  if (explicitLabel) return explicitLabel;

  const shellTitle = config?.shell?.header?.title ?? shellState?.lightDomTitle;
  return shellTitle ?? undefined;
}

/**
 * Update ARIA label and describedby attributes on the grid container.
 * Uses caching to avoid redundant DOM writes.
 *
 * @param state - ARIA state for caching
 * @param rowsBodyEl - Element to set aria-label/aria-describedby on
 * @param config - Grid configuration
 * @param shellState - Shell state (for light DOM title)
 * @returns true if anything was updated
 */
export function updateAriaLabels<T>(
  state: AriaState,
  rowsBodyEl: HTMLElement | null,
  config: GridConfig<T> | undefined,
  shellState: ShellState | undefined,
): boolean {
  if (!rowsBodyEl) return false;

  let updated = false;

  // Determine aria-label: explicit config > shell title > nothing
  const ariaLabel = getEffectiveAriaLabel(config, shellState);

  // Update aria-label only if changed
  if (ariaLabel !== state.ariaLabel) {
    state.ariaLabel = ariaLabel;
    if (ariaLabel) {
      rowsBodyEl.setAttribute('aria-label', ariaLabel);
    } else {
      rowsBodyEl.removeAttribute('aria-label');
    }
    updated = true;
  }

  // Update aria-describedby only if changed
  const ariaDescribedBy = config?.gridAriaDescribedBy;
  if (ariaDescribedBy !== state.ariaDescribedBy) {
    state.ariaDescribedBy = ariaDescribedBy;
    if (ariaDescribedBy) {
      rowsBodyEl.setAttribute('aria-describedby', ariaDescribedBy);
    } else {
      rowsBodyEl.removeAttribute('aria-describedby');
    }
    updated = true;
  }

  return updated;
}

// #endregion

// #region Live Announcements

/**
 * Announce a message to screen readers via the grid's aria-live region.
 * Clears then sets text to ensure repeated messages are re-announced.
 *
 * Respects `effectiveConfig.a11y.announcements` — if set to `false`,
 * the announcement is silently skipped.
 *
 * @param gridEl - The grid host element (or any ancestor containing `.tbw-sr-only`)
 * @param message - The message to announce
 */
export function announce(gridEl: HTMLElement, message: string): void {
  // Check if announcements are disabled via config.
  // gridEl is always a DataGridElement at runtime — use property access safely.
  if (!gridEl) return;
  const config =
    'effectiveConfig' in gridEl
      ? (gridEl as HTMLElement & { effectiveConfig?: GridConfig }).effectiveConfig
      : undefined;
  if (config?.a11y?.announcements === false) return;

  const el = gridEl.querySelector?.('.tbw-sr-only');
  if (!el) return;
  // Clear first so identical consecutive messages are still announced
  el.textContent = '';
  requestAnimationFrame(() => {
    el.textContent = message;
  });
}

/**
 * Get an announcement message, preferring custom overrides from config.
 * Falls back to default English messages when no override is provided.
 *
 * @param gridEl - The grid host element
 * @param key - The message key from A11yMessages
 * @param args - Arguments to pass to the message function
 */
export function getA11yMessage<K extends keyof A11yMessages>(
  gridEl: HTMLElement,
  key: K,
  ...args: Parameters<A11yMessages[K]>
): string {
  const config =
    gridEl && 'effectiveConfig' in gridEl
      ? (gridEl as HTMLElement & { effectiveConfig?: GridConfig }).effectiveConfig
      : undefined;
  const customFn = config?.a11y?.messages?.[key] as ((...a: Parameters<A11yMessages[K]>) => string) | undefined;
  if (customFn) return customFn(...args);
  return (DEFAULT_A11Y_MESSAGES[key] as (...a: Parameters<A11yMessages[K]>) => string)(...args);
}

// #endregion

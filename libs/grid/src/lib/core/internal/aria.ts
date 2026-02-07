/**
 * ARIA Accessibility Helpers
 *
 * Pure functions for managing ARIA attributes on grid elements.
 * Implements caching to avoid redundant DOM writes during scroll.
 *
 * @module internal/aria
 */

import type { GridConfig } from '../types';
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

/**
 * Empty State Module
 *
 * Renders a "no rows" overlay when the grid has been loaded but has no data
 * to display (`loading === false && rendered row count === 0`).
 *
 * Mirrors the shape of `loading.ts` so the two overlays compose cleanly: at
 * any given time at most one of `.tbw-loading-overlay` and `.tbw-empty-overlay`
 * is mounted.
 *
 * @module internal/empty
 */

import type { EmptyContext, EmptyOverlay, EmptyRenderer, GridConfig } from '../types';

/** Default messages used when no `emptyRenderer` is configured. */
export const DEFAULT_EMPTY_MESSAGE = 'No data to display';
export const DEFAULT_FILTERED_OUT_MESSAGE = 'No matching rows';

/**
 * Default empty-state renderer.
 * Produces a non-interactive `<div>` carrying a translatable message.
 */
export function defaultEmptyRenderer(ctx: EmptyContext): HTMLElement {
  const el = document.createElement('div');
  el.className = 'tbw-empty-message';
  el.textContent = ctx.filteredOut ? DEFAULT_FILTERED_OUT_MESSAGE : DEFAULT_EMPTY_MESSAGE;
  return el;
}

/**
 * Create the rendered content for the empty overlay.
 * If a custom renderer is provided, use it; otherwise fall back to the default
 * message. Strings returned by user renderers are wrapped in a `<div>`.
 */
export function createEmptyContent(ctx: EmptyContext, renderer?: EmptyRenderer): HTMLElement {
  const fn = renderer ?? defaultEmptyRenderer;
  const result = fn(ctx);
  if (typeof result === 'string') {
    const wrapper = document.createElement('div');
    wrapper.className = 'tbw-empty-message';
    wrapper.innerHTML = result;
    return wrapper;
  }
  return result;
}

/**
 * Create the empty-state overlay element.
 * Always carries `role="status"` + `aria-live="polite"` so screen readers
 * announce the state on transition; the `data-overlay-target` attribute is
 * informational only (CSS positions absolutely against the closest positioned
 * ancestor — both `.rows-container` and `.tbw-grid-root` are positioned).
 */
export function createEmptyOverlay(
  ctx: EmptyContext,
  renderer?: EmptyRenderer,
  target: EmptyOverlay = 'rows',
): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'tbw-empty-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.setAttribute('data-overlay-target', target);
  overlay.appendChild(createEmptyContent(ctx, renderer));
  return overlay;
}

/**
 * Mount the overlay into the chosen target element.
 * Caller resolves the actual element (`.rows-container` for `'rows'`, the
 * `.tbw-grid-root` for `'grid'`).
 */
export function showEmptyOverlay(target: Element, overlayEl: HTMLElement): void {
  target.appendChild(overlayEl);
}

/** Detach the overlay from the DOM. */
export function hideEmptyOverlay(overlayEl: HTMLElement | undefined): void {
  overlayEl?.remove();
}

/**
 * Decide whether the empty overlay should be visible.
 * The overlay is shown only when:
 *  - the grid is not currently in a loading state (loading takes precedence);
 *  - the rendered row count is zero (after all plugin processing);
 *  - the renderer has not been explicitly disabled by setting it to `null`.
 */
export function shouldShowEmpty(
  loading: boolean,
  renderedRowCount: number,
  renderer: GridConfig['emptyRenderer'] | undefined,
): boolean {
  if (loading) return false;
  if (renderedRowCount > 0) return false;
  if (renderer === null) return false;
  return true;
}

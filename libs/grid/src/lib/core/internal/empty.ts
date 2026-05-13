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
import { sanitizeHTML } from './sanitize';

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
 * message. Strings returned by user renderers are sanitized through
 * `sanitizeHTML()` before being assigned to `innerHTML` — mirroring the cell
 * render path — so consumers can safely embed values from API responses
 * (e.g. `Failed to load deals: ${error.message}`) without opening an XSS sink.
 */
export function createEmptyContent(ctx: EmptyContext, renderer?: EmptyRenderer): HTMLElement {
  const fn = renderer ?? defaultEmptyRenderer;
  const result = fn(ctx);
  if (typeof result === 'string') {
    const wrapper = document.createElement('div');
    wrapper.className = 'tbw-empty-message';
    wrapper.innerHTML = sanitizeHTML(result);
    return wrapper;
  }
  return result;
}

/**
 * Create the empty-state overlay element.
 * Always carries `role="status"` + `aria-live="polite"` so screen readers
 * announce the state on transition; the `data-overlay-target` attribute is
 * informational only. CSS positions absolutely against the closest positioned
 * ancestor — `.tbw-grid-root` is positioned by `base.css`, and `.rows-container`
 * is given `position: relative` for `target='rows'` for the same reason.
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

/**
 * Per-grid mutable state cached between overlay updates so the hot path
 * (`_schedulerAfterRender` fires on every render phase, including
 * VIRTUALIZATION during scroll) can skip the recreate when nothing observable
 * has changed. Without this guard we'd churn DOM and could leak
 * framework-adapter portals returned from user renderers.
 */
export interface EmptyOverlayState {
  el?: HTMLElement;
  renderer?: GridConfig['emptyRenderer'];
  target?: EmptyOverlay;
  sourceRowCount?: number;
  filteredOut?: boolean;
}

/**
 * Compute, mount, or tear down the empty-state overlay in a single call.
 * Encapsulates show/hide decision, change detection, mount-point resolution,
 * and the `filteredOut` derivation so the grid host can stay a one-liner.
 *
 * The `state` object is mutated in place — callers store a single reference
 * and pass it back on every tick.
 */
export function updateEmptyOverlay(
  gridRoot: Element | null,
  loading: boolean,
  renderedRowCount: number,
  sourceRowCount: number,
  renderer: GridConfig['emptyRenderer'] | undefined,
  target: EmptyOverlay,
  state: EmptyOverlayState,
): void {
  if (!gridRoot) return;

  if (!shouldShowEmpty(loading, renderedRowCount, renderer)) {
    hideEmptyOverlay(state.el);
    state.el = undefined;
    state.renderer = undefined;
    state.target = undefined;
    state.sourceRowCount = undefined;
    state.filteredOut = undefined;
    return;
  }

  const filteredOut = sourceRowCount > 0 && renderedRowCount === 0;

  // Idempotent fast path — see EmptyOverlayState docs.
  if (
    state.el &&
    state.renderer === renderer &&
    state.target === target &&
    state.sourceRowCount === sourceRowCount &&
    state.filteredOut === filteredOut
  ) {
    return;
  }

  // Resolve mount point. Fall back to grid root when the rows-container
  // hasn't been built yet (e.g. very first render before #setup completes).
  const mountTarget: Element = target === 'grid' ? gridRoot : (gridRoot.querySelector('.rows-container') ?? gridRoot);

  hideEmptyOverlay(state.el);
  state.el = createEmptyOverlay({ sourceRowCount, filteredOut }, renderer ?? undefined, target);
  showEmptyOverlay(mountTarget, state.el);
  state.renderer = renderer;
  state.target = target;
  state.sourceRowCount = sourceRowCount;
  state.filteredOut = filteredOut;
}

/**
 * Test environment setup for `@toolbox-web/grid-angular`.
 *
 * jsdom does not implement `ResizeObserver`. The grid web component's
 * `connectedCallback` instantiates a `ResizeObserver` to react to viewport
 * resizes, which throws `ReferenceError` whenever any spec causes a
 * `<tbw-grid>` element to be attached to the document.
 *
 * Historically a handful of specs worked around this by carefully avoiding
 * imports that would transitively define the `tbw-grid` custom element. That
 * pattern is fragile — any new spec that legitimately needs to import an
 * adapter module (which now uses the cross-instance shared store from
 * `@toolbox-web/grid`) will reintroduce the error. A no-op polyfill
 * eliminates the failure mode entirely.
 */

if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    constructor(_callback?: ResizeObserverCallback) {
      /* no-op */
    }
    observe(): void {
      /* no-op */
    }
    unobserve(): void {
      /* no-op */
    }
    disconnect(): void {
      /* no-op */
    }
  }
  globalThis.ResizeObserver = NoopResizeObserver as typeof ResizeObserver;
}

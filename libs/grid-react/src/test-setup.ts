/**
 * Test environment setup for `@toolbox-web/grid-react`.
 *
 * jsdom lacks `ResizeObserver`. The grid web component's `connectedCallback`
 * instantiates one whenever a `<tbw-grid>` element is appended to the DOM.
 * A no-op polyfill keeps any spec that attaches the element from throwing.
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

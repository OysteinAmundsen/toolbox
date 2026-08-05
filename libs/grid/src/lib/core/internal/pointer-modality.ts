/**
 * Pointer modality detection — distinguishes coarse (touch/stylus) from fine
 * (mouse/precision trackpad) input devices via the `pointer: coarse` media query.
 *
 * This module is **internal only** and is NOT exported from `src/public.ts`.
 * Plugins and features use it to adapt hit-target sizing, long-press thresholds,
 * and gesture disambiguation at runtime without querying the media each call.
 *
 * Design decisions:
 * - A single `MediaQueryList` instance is shared across all subscribers to avoid
 *   N OS-level listeners. Subscribers share one `change` handler.
 * - Guards for missing `globalThis.matchMedia` keep the module SSR/happy-dom safe.
 * - Legacy `addListener`/`removeListener` fallback for older Safari and happy-dom
 *   environments that predate `MediaQueryList.addEventListener`.
 *
 * @since 3.5.0
 * @internal
 */

// #region Types

/**
 * The resolved pointer category for the primary input device.
 *
 * - `'fine'`  — mouse or precision trackpad (pointer: fine).
 * - `'coarse'` — touch screen or low-precision stylus (pointer: coarse).
 *
 * @since 3.5.0
 */
export type PointerModality = 'fine' | 'coarse';

// #endregion

// #region Singleton MQL + subscriber registry

/** Lazily-created shared `MediaQueryList` for `(pointer: coarse)`. */
let _mql: MediaQueryList | null = null;

/** Active change subscribers. */
const _subscribers = new Set<(m: PointerModality) => void>();

/**
 * Resolve the current modality from a `MediaQueryList` state.
 * Returns `'coarse'` when the query matches, `'fine'` otherwise.
 */
function _resolve(mql: MediaQueryList): PointerModality {
  return mql.matches ? 'coarse' : 'fine';
}

/**
 * Shared MQL change handler — dispatches to all active subscribers.
 */
function _onMqlChange(e: MediaQueryListEvent): void {
  const modality: PointerModality = e.matches ? 'coarse' : 'fine';
  _subscribers.forEach((cb) => cb(modality));
}

/**
 * Return (and lazily create) the shared MQL.
 * Returns `null` in environments without `matchMedia` (SSR / happy-dom).
 */
function _getMql(): MediaQueryList | null {
  if (_mql) return _mql;
  if (typeof globalThis.matchMedia !== 'function') return null;
  _mql = globalThis.matchMedia('(pointer: coarse)');
  // Attach the single shared change handler via the modern or legacy API.
  if (typeof _mql.addEventListener === 'function') {
    _mql.addEventListener('change', _onMqlChange);
  } else if (typeof (_mql as { addListener?: unknown }).addListener === 'function') {
    // Legacy Safari / older environments
    (_mql as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(_onMqlChange);
  }
  return _mql;
}

// #endregion

// #region Public API

/**
 * Return the current pointer modality for the primary input device.
 *
 * Falls back to `'fine'` in SSR environments or browsers that do not
 * support `matchMedia`.
 *
 * @since 3.5.0
 */
export function getPrimaryPointer(): PointerModality {
  const mql = _getMql();
  if (!mql) return 'fine';
  return _resolve(mql);
}

/**
 * Subscribe to pointer-modality changes.
 *
 * The callback fires whenever the browser detects a switch between fine and
 * coarse primary input (e.g. user connects a mouse to a touch-screen device).
 *
 * Returns an **idempotent** unsubscribe function — calling it multiple times
 * is safe.
 *
 * In SSR / environments without `matchMedia` the callback is never invoked
 * and the returned unsubscribe is a no-op.
 *
 * @since 3.5.0
 */
export function onPointerModalityChange(cb: (m: PointerModality) => void): () => void {
  _getMql(); // ensure MQL is created and the shared handler is attached
  _subscribers.add(cb);
  let removed = false;
  return (): void => {
    if (removed) return;
    removed = true;
    _subscribers.delete(cb);
  };
}

// #endregion

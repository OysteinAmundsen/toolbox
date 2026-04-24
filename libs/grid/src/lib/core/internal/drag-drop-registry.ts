/**
 * Drag-Drop Registry
 *
 * Module-level singleton that holds live (WeakRef) references to row objects
 * being dragged across grids in the same JS heap. Used by `RowDragDropPlugin`
 * to recover live references on drop, avoiding any serialization cost when
 * source and target grids share a heap.
 *
 * Lives in `core/internal/` (not in the plugin bundle) so that two copies of
 * `@toolbox-web/grid` loaded via different entry points (e.g. `/all` vs
 * per-plugin imports) cannot end up with two separate registries that silently
 * fall back to JSON.
 *
 * Cross-window / cross-origin-iframe drags do NOT go through this registry —
 * they fall back to `dataTransfer` JSON.
 *
 * @internal
 */

interface RegistryEntry {
  readonly refs: ReadonlyArray<WeakRef<object>>;
  /** True when one or more registered rows were primitives (not objects). */
  readonly hasPrimitives: boolean;
  readonly meta?: unknown;
}

const registry = new Map<string, RegistryEntry>();

/**
 * Register a drag session's live row references.
 *
 * Object rows are stored as `WeakRef<object>`; primitive rows cannot be held
 * weakly and would either need a sentinel (which corrupts the row value on
 * recovery) or be omitted (which misaligns indices). We instead flag the
 * session as containing primitives — `lookupDragSession()` then returns
 * `undefined` so callers fall back to the JSON payload, which round-trips
 * primitives losslessly.
 *
 * @param sessionId - Unique drag session identifier (typically a UUID).
 * @param rows      - Rows being dragged.
 * @param meta      - Optional opaque metadata to associate with the session.
 */
export function registerDragSession(sessionId: string, rows: readonly unknown[], meta?: unknown): void {
  const refs: WeakRef<object>[] = [];
  let hasPrimitives = false;
  for (const row of rows) {
    if (row !== null && typeof row === 'object') {
      refs.push(new WeakRef(row as object));
    } else {
      hasPrimitives = true;
    }
  }
  registry.set(sessionId, { refs, hasPrimitives, meta });
}

/**
 * Look up the live row references for a drag session.
 *
 * Returns `undefined` when the caller MUST fall back to the JSON payload:
 *   - the session is unknown,
 *   - any registered reference has been garbage-collected (partial recovery
 *     would silently corrupt cross-grid moves), or
 *   - the session contains primitive rows (which cannot be held weakly).
 */
export function lookupDragSession<T = unknown>(sessionId: string): T[] | undefined {
  const entry = registry.get(sessionId);
  if (!entry) return undefined;
  if (entry.hasPrimitives) return undefined; // primitives — caller falls back to JSON
  const result: unknown[] = [];
  for (const ref of entry.refs) {
    const obj = ref.deref();
    if (obj === undefined) return undefined; // GC'd — caller falls back to JSON
    result.push(obj);
  }
  return result as T[];
}

/**
 * Get the metadata associated with a drag session, if any.
 */
export function getDragSessionMeta<M = unknown>(sessionId: string): M | undefined {
  return registry.get(sessionId)?.meta as M | undefined;
}

/**
 * Clear a drag session from the registry.
 * Should be called from `dragend` on the source grid.
 */
export function clearDragSession(sessionId: string): void {
  registry.delete(sessionId);
}

/**
 * @internal Test-only — clear all sessions.
 */
export function _clearAllDragSessions(): void {
  registry.clear();
}

/**
 * Generate a unique drag session identifier.
 *
 * Used as a Map key to recover live row references for in-process drags; this
 * is **not** a security context. Uses `crypto.randomUUID()` when available
 * (modern browsers in secure contexts, Node 19+, Bun) and falls back to
 * `crypto.getRandomValues()` for older non-secure contexts. `Math.random()`
 * is intentionally avoided to keep CodeQL clean.
 */
export function newDragSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return `drag-${Date.now().toString(36)}-${buf[0].toString(36)}${buf[1].toString(36)}`;
  }
  // Final fallback: timestamp + monotonically incrementing counter (no PRNG).
  // Sufficient because the registry is in-process and lives only for the
  // duration of a single drag.
  return `drag-${Date.now().toString(36)}-${(++fallbackCounter).toString(36)}`;
}

let fallbackCounter = 0;

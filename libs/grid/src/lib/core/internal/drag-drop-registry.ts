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
  readonly meta?: unknown;
}

const registry = new Map<string, RegistryEntry>();

/**
 * Register a drag session's live row references.
 * Rows that are not objects (primitives) are skipped — they survive the JSON
 * round-trip and don't need WeakRef recovery.
 *
 * @param sessionId - Unique drag session identifier (typically a UUID).
 * @param rows      - Rows being dragged. Object references are stored weakly.
 * @param meta      - Optional opaque metadata to associate with the session.
 */
export function registerDragSession(sessionId: string, rows: readonly unknown[], meta?: unknown): void {
  const refs: WeakRef<object>[] = [];
  for (const row of rows) {
    if (row !== null && typeof row === 'object') {
      refs.push(new WeakRef(row as object));
    } else {
      // Push a sentinel WeakRef that will always be empty so indices line up
      // with primitive entries in the JSON payload during recovery.
      refs.push(new WeakRef({}));
    }
  }
  registry.set(sessionId, { refs, meta });
}

/**
 * Look up the live row references for a drag session.
 * Returns `undefined` if the session is unknown OR if any registered reference
 * has been garbage-collected (in which case the caller MUST fall back to the
 * JSON payload — partial recovery would silently corrupt cross-grid moves).
 */
export function lookupDragSession<T = unknown>(sessionId: string): T[] | undefined {
  const entry = registry.get(sessionId);
  if (!entry) return undefined;
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
 * Uses `crypto.randomUUID()` when available, otherwise a timestamped fallback.
 */
export function newDragSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `drag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

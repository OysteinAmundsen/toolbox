/**
 * Cross-module-instance shared store for `@toolbox-web/grid` and its adapters.
 *
 * Background: in micro-frontend hosts (module federation, etc.)
 * the same logical package can be bundled and loaded twice on one page —
 * once by the host, once by an embedded widget. Each copy has its own
 * module-private state (feature registry, React Contexts, Vue InjectionKeys,
 * Angular InjectionTokens). Meanwhile `customElements.define('tbw-grid', ...)`
 * is first-write-wins, so the actual `<tbw-grid>` instance always belongs to
 * the *first-loaded* class. The mismatch crashes React (Context identity miss)
 * and silently breaks Vue feature composables and Angular DI lookups.
 *
 * Fix: every cross-module-instance identity is created lazily via
 * {@link getOrCreateShared} so that all module copies converge on the same
 * object. The store is anchored on `globalThis` under a `Symbol.for(...)` key
 * (which is realm-shared) AND re-exposed as `DataGridElement.shared` for
 * inspector visibility.
 *
 * This is NOT multi-version coexistence — that is a separate, more invasive
 * change (see issue #339). This is the minimal mechanism that makes the
 * single-runtime, multi-bundle case robust.
 *
 * @see https://github.com/OysteinAmundsen/toolbox/issues/338
 * @internal
 */

const SHARED_STORE_KEY = Symbol.for('@toolbox-web/grid/shared');

/**
 * Lazily-populated shared store. Buckets are filled by the modules that need
 * them; consumers should always read through {@link getOrCreateShared} or
 * {@link getSharedStore} rather than caching their own references, since the
 * store identity is fixed but bucket contents grow over time.
 *
 * @internal
 */
export interface SharedGridStore {
  /** Feature registry: name → factory. Owned by `features/registry.ts`. */
  readonly features: Map<string, unknown>;
  /** Currently-installed feature resolver (set by `features/registry.ts`). */
  featureResolver: ((features: Record<string, unknown>) => unknown[]) | undefined;
  /** React Context identities (by name). Owned by `@toolbox-web/grid-react`. */
  readonly reactContexts: Record<string, unknown>;
  /** Vue `InjectionKey` Symbols (by name). Owned by `@toolbox-web/grid-vue`. */
  readonly vueKeys: Record<string, unknown>;
  /** Angular `InjectionToken` instances (by name). Owned by `@toolbox-web/grid-angular`. */
  readonly ngTokens: Record<string, unknown>;
}

type GlobalWithStore = typeof globalThis & {
  [SHARED_STORE_KEY]?: SharedGridStore;
};

/**
 * Return the page-wide shared store, creating it on first access.
 *
 * Safe to call from any module at any time, including before `grid.ts`'s
 * `DataGridElement` class has been defined.
 *
 * @internal
 */
export function getSharedStore(): SharedGridStore {
  const g = globalThis as GlobalWithStore;
  let store = g[SHARED_STORE_KEY];
  if (!store) {
    // Bucket records use `Object.create(null)` (no prototype chain) so that
    // `slot[key] = factory()` in `getOrCreateShared` cannot accidentally
    // mutate `Object.prototype` if `key` ever held a value like `'__proto__'`
    // or `'constructor'`. The keys are internal today, but CodeQL flags the
    // assignment pattern regardless of provenance — eliminating the prototype
    // chain closes the rule structurally.
    store = {
      features: new Map(),
      featureResolver: undefined,
      reactContexts: Object.create(null) as Record<string, unknown>,
      vueKeys: Object.create(null) as Record<string, unknown>,
      ngTokens: Object.create(null) as Record<string, unknown>,
    };
    g[SHARED_STORE_KEY] = store;
  }
  return store;
}

/**
 * Look up or lazily create a single shared identity in one of the registry
 * buckets. The factory runs at most once per page (across all module copies).
 *
 * @example
 * ```ts
 * export const GridIconContext = getOrCreateShared(
 *   'reactContexts',
 *   'icons',
 *   () => createContext<Partial<GridIcons> | null>(null),
 * );
 * ```
 *
 * @internal
 */
export function getOrCreateShared<T>(
  bucket: 'reactContexts' | 'vueKeys' | 'ngTokens',
  key: string,
  factory: () => T,
): T {
  const slot = getSharedStore()[bucket] as Record<string, unknown>;
  if (!(key in slot)) {
    slot[key] = factory();
  }
  return slot[key] as T;
}

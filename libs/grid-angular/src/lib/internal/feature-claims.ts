/**
 * Per-grid-element claims registry used by the hybrid feature-directive
 * refactor (v1.4 → v2).
 *
 * Background: historically every plugin's input/output (e.g. `[filtering]`,
 * `(filterChange)`) was declared on the central {@link Grid} directive. That
 * pulled the typed surface for *all* 22 plugins into the core bundle even
 * for apps that only used a few. The new approach gives every feature a
 * thin **attribute-selector** directive (e.g. `GridFilteringDirective` with
 * selector `tbw-grid[filtering], tbw-grid[filterChange]`) that lives in the
 * feature secondary entry — so the plugin's typed surface is only paid for
 * when the feature is actually imported.
 *
 * To stay non-breaking in v1.x, the deprecated inputs/outputs remain on
 * {@link Grid}. When a feature directive is present on the same `<tbw-grid>`
 * element it **claims** its feature here; {@link Grid} consults the registry
 * and lets the directive own the input + event so we never produce duplicate
 * plugins or double-emit events.
 *
 * This module is deliberately framework-free (plain {@link WeakMap} state, no
 * `@angular/core` imports) so feature secondary entries can import it through
 * the package barrel without introducing circular module graphs.
 *
 * @internal
 */

/**
 * Reads the directive-owned config value for a feature. The function is
 * called during {@link Grid}'s `createFeaturePlugins` effect, so reading a
 * signal inside it establishes reactive dependency tracking — the effect
 * re-runs when the directive's input changes.
 * @internal
 */
export type FeatureConfigGetter = () => unknown;

/** Per-element map of claimed feature names → config getter. */
const featureClaims = new WeakMap<HTMLElement, Map<string, FeatureConfigGetter>>();

/** Per-element set of claimed event names (matches `keyof DataGridEventMap`). */
const eventClaims = new WeakMap<HTMLElement, Set<string>>();

/**
 * Register a feature claim. Called by a feature directive's constructor;
 * the {@link Grid} directive will then use {@link getFeatureClaim} during
 * plugin creation instead of reading its own deprecated input.
 * @internal
 */
export function registerFeatureClaim(grid: HTMLElement, name: string, getConfig: FeatureConfigGetter): void {
  let map = featureClaims.get(grid);
  if (!map) {
    map = new Map();
    featureClaims.set(grid, map);
  }
  map.set(name, getConfig);
}

/**
 * Look up a feature claim. Returns the registered config getter, or
 * `undefined` if no directive owns this feature on this element.
 * @internal
 */
export function getFeatureClaim(grid: HTMLElement, name: string): FeatureConfigGetter | undefined {
  return featureClaims.get(grid)?.get(name);
}

/**
 * Drop a feature claim. Called by a feature directive's `ngOnDestroy` so
 * that, if the directive is removed (e.g. via `*ngIf`) but the host
 * `<tbw-grid>` survives, {@link Grid}'s deprecated input takes back over.
 * @internal
 */
export function unregisterFeatureClaim(grid: HTMLElement, name: string): void {
  featureClaims.get(grid)?.delete(name);
}

/**
 * Mark an event as owned by a feature directive. {@link Grid}'s
 * `setupEventListeners` skips wiring its own deprecated `output()` for any
 * claimed event — the directive owns the listener and the emit.
 * @internal
 */
export function claimEvent(grid: HTMLElement, eventName: string): void {
  let set = eventClaims.get(grid);
  if (!set) {
    set = new Set();
    eventClaims.set(grid, set);
  }
  set.add(eventName);
}

/**
 * Returns true if a directive has claimed this event on this grid element.
 * @internal
 */
export function isEventClaimed(grid: HTMLElement, eventName: string): boolean {
  return eventClaims.get(grid)?.has(eventName) ?? false;
}

/**
 * Drop an event claim. Pair with {@link claimEvent} in a directive's
 * `ngOnDestroy`.
 * @internal
 */
export function unclaimEvent(grid: HTMLElement, eventName: string): void {
  eventClaims.get(grid)?.delete(eventName);
}

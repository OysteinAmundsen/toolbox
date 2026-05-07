/**
 * Internal registries used by `@toolbox-web/grid-angular`.
 *
 * Two extension points are exposed so individual feature secondary entries
 * (e.g. `@toolbox-web/grid-angular/features/master-detail`) can plug into
 * the core `Grid` directive without the directive needing to know about them.
 *
 * - {@link registerTemplateBridge} — runs in `ngAfterContentInit` once Angular
 *   templates inside the grid have been registered. Used to discover light-DOM
 *   slot elements (`<tbw-grid-detail>`, `<tbw-grid-responsive-card>`, …) and
 *   wire them to the corresponding plugin's renderer setter.
 * - {@link registerFeatureConfigPreprocessor} — runs inside the directive's
 *   feature-plugin builder before `createPluginFromFeature` is called. Lets a
 *   feature transform its config object (e.g. to convert Angular component
 *   classes embedded in `customPanels` to renderer functions).
 *
 * Both registries are append-only and module-scoped: they are populated by
 * side-effect imports of feature secondary entries and consumed by the core
 * `Grid` directive. Order is insertion order.
 *
 * @internal — public for cross-entry-point use; not part of the supported API.
 */

import type { GridAdapter } from '../angular-grid-adapter';
import type { FeatureName } from '../feature-registry';

/**
 * Context passed to template bridges.
 *
 * @internal
 * @since 1.4.0
 */
export interface TemplateBridgeContext {
  /** The `<tbw-grid>` element this directive is attached to. */
  grid: HTMLElement;
  /** The Angular `GridAdapter` instance for this grid. */
  adapter: GridAdapter;
}

/**
 * A template bridge runs once per grid in `ngAfterContentInit`, after the
 * grid has refreshed its columns and Angular content templates have been
 * registered. Bridges may be async; the directive does not await them
 * sequentially — they run concurrently.
 *
 * @internal
 * @since 1.4.0
 */
export type TemplateBridge = (ctx: TemplateBridgeContext) => void | Promise<void>;

const templateBridges: TemplateBridge[] = [];

/**
 * Register a template bridge. Called by feature secondary entries at module
 * load (e.g. `import '@toolbox-web/grid-angular/features/master-detail'`).
 *
 * Bridges are append-only and never deduplicated; calling registration twice
 * for the same feature module is safe because module imports are deduplicated
 * by the JS loader.
 *
 * @internal
 * @since 1.4.0
 */
export function registerTemplateBridge(bridge: TemplateBridge): void {
  templateBridges.push(bridge);
}

/**
 * Run all registered template bridges for a grid. The directive calls this
 * from `ngAfterContentInit` after `refreshColumns()`. Bridges run concurrently;
 * errors thrown by one bridge do not stop the others.
 *
 * @internal
 * @since 1.4.0
 */
export function runTemplateBridges(ctx: TemplateBridgeContext): void {
  for (const bridge of templateBridges) {
    try {
      const result = bridge(ctx);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[tbw-grid-angular] template bridge threw:', err);
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[tbw-grid-angular] template bridge threw:', err);
    }
  }
}

/**
 * A feature config preprocessor receives the user-supplied config for a
 * specific feature input and returns a transformed config that the core
 * plugin factory can consume. Used to bridge Angular component classes
 * embedded in feature configs (e.g. `customPanels`, `groupHeaderRenderer`)
 * to plain renderer functions.
 *
 * Receives the typed config and the directive's adapter. Returning the same
 * reference is fine — preprocessors typically clone-and-augment.
 *
 * @internal
 * @since 1.4.0
 */
export type FeatureConfigPreprocessor = (config: unknown, adapter: GridAdapter) => unknown;

const featureConfigPreprocessors = new Map<FeatureName, FeatureConfigPreprocessor>();

/**
 * Register a feature config preprocessor. Last registration wins (subsequent
 * imports of the same feature module re-register the same function, which is
 * a no-op).
 *
 * @internal
 * @since 1.4.0
 */
export function registerFeatureConfigPreprocessor(name: FeatureName, fn: FeatureConfigPreprocessor): void {
  featureConfigPreprocessors.set(name, fn);
}

/**
 * Look up the preprocessor for a feature, if any.
 *
 * @internal
 * @since 1.4.0
 */
export function getFeatureConfigPreprocessor(name: FeatureName): FeatureConfigPreprocessor | undefined {
  return featureConfigPreprocessors.get(name);
}

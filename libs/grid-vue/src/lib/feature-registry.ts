/**
 * Feature Registry for @toolbox-web/grid-vue
 *
 * This module provides a synchronous registry for plugin factories.
 * Features are registered via side-effect imports, enabling tree-shaking
 * while maintaining the clean prop-based API.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-vue/features/selection';
 * import '@toolbox-web/grid-vue/features/filtering';
 *
 * // Props work automatically - no async loading, no HTTP requests
 * <TbwGrid :selection="'range'" :filtering="{ debounceMs: 200 }" />
 * ```
 */

/**
 * Feature names supported by the TbwGrid component.
 */
export type FeatureName =
  | 'selection'
  | 'editing'
  | 'clipboard'
  | 'contextMenu'
  | 'multiSort'
  | 'sorting' // @deprecated - use 'multiSort' instead
  | 'filtering'
  | 'reorder'
  | 'visibility'
  | 'pinnedColumns'
  | 'groupingColumns'
  | 'columnVirtualization'
  | 'rowReorder'
  | 'groupingRows'
  | 'pinnedRows'
  | 'tree'
  | 'masterDetail'
  | 'responsive'
  | 'undoRedo'
  | 'export'
  | 'print'
  | 'pivot'
  | 'serverSide';

/**
 * Plugin factory function type.
 * Takes configuration and returns a plugin instance.
 */
export type PluginFactory<TConfig = unknown> = (config: TConfig) => unknown;

/**
 * Registry entry containing the factory and metadata.
 */
interface RegistryEntry {
  factory: PluginFactory;
  /** Feature name for debugging */
  name: string;
}

/**
 * Central registry mapping feature names to their plugin factories.
 * Populated by side-effect feature imports.
 */
const featureRegistry = new Map<FeatureName, RegistryEntry>();

/**
 * Set of features that have been used without being registered.
 * Used to show helpful warnings only once per feature.
 */
const warnedFeatures = new Set<string>();

/**
 * Register a feature's plugin factory.
 * Called by side-effect feature imports.
 *
 * @param name - The feature name (matches the prop name on TbwGrid)
 * @param factory - Function that creates the plugin instance
 *
 * @example
 * ```ts
 * // features/selection.ts
 * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 * import { registerFeature } from '../lib/feature-registry';
 *
 * registerFeature('selection', (config) => new SelectionPlugin(config));
 * ```
 */
export function registerFeature<TConfig = unknown>(name: FeatureName, factory: PluginFactory<TConfig>): void {
  featureRegistry.set(name, {
    factory: factory as PluginFactory,
    name,
  });
}

/**
 * Check if a feature is registered.
 */
export function isFeatureRegistered(name: FeatureName): boolean {
  return featureRegistry.has(name);
}

/**
 * Get all registered feature names.
 */
export function getRegisteredFeatures(): FeatureName[] {
  return Array.from(featureRegistry.keys());
}

/**
 * Get the factory for a feature, if registered.
 */
export function getFeatureFactory(name: FeatureName): PluginFactory | undefined {
  return featureRegistry.get(name)?.factory;
}

/**
 * Create a plugin from a feature prop.
 * Returns undefined if the feature is not registered (with a console warning).
 *
 * @param name - Feature name
 * @param config - Configuration value from the prop
 */
export function createPluginFromFeature(name: FeatureName, config: unknown): unknown | undefined {
  const entry = featureRegistry.get(name);

  if (!entry) {
    // Only warn once per feature
    if (!warnedFeatures.has(name)) {
      warnedFeatures.add(name);
      console.warn(
        `[TbwGrid] Feature "${name}" is not registered. ` +
          `Import '@toolbox-web/grid-vue/features/${name}' to enable it.`,
      );
    }
    return undefined;
  }

  return entry.factory(config);
}

/**
 * Clear the feature registry.
 * @internal - for testing only
 */
export function clearFeatureRegistry(): void {
  featureRegistry.clear();
  warnedFeatures.clear();
}

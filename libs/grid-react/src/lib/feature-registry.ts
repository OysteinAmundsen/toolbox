/**
 * Feature Registry for @toolbox-web/grid-react
 *
 * This module provides a synchronous registry for plugin factories.
 * Features are registered via side-effect imports, enabling tree-shaking
 * while maintaining the clean prop-based API.
 *
 * @example
 * ```tsx
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-react/features/selection';
 * import '@toolbox-web/grid-react/features/filtering';
 *
 * // Props work automatically - no async loading, no HTTP requests
 * <DataGrid selection="range" filtering={{ debounceMs: 200 }} />
 * ```
 */

import type { FeatureProps } from './feature-props';

/**
 * Feature names - keys of the FeatureProps interface.
 */
export type FeatureName = keyof FeatureProps;

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
 * @param name - The feature name (matches the prop name on DataGrid)
 * @param factory - Function that creates the plugin instance
 *
 * @example
 * ```ts
 * // features/selection.ts
 * import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
 * import { registerFeature } from '../feature-registry';
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
 * Get a registered feature's factory.
 * Returns undefined if not registered.
 */
export function getFeatureFactory(name: FeatureName): PluginFactory | undefined {
  return featureRegistry.get(name)?.factory;
}

/**
 * Get all registered feature names.
 * Useful for debugging.
 */
export function getRegisteredFeatures(): FeatureName[] {
  return Array.from(featureRegistry.keys());
}

/**
 * Create a plugin instance for a feature.
 * Shows a helpful warning if the feature is not registered.
 *
 * @param name - Feature name
 * @param config - Plugin configuration
 * @returns Plugin instance or undefined if not registered
 */
export function createPluginFromFeature<TConfig = unknown>(name: FeatureName, config: TConfig): unknown | undefined {
  const entry = featureRegistry.get(name);

  if (!entry) {
    // Show warning only once per feature in development
    const isDev =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (!warnedFeatures.has(name) && isDev) {
      warnedFeatures.add(name);
      console.warn(
        `[DataGrid] Feature "${name}" prop is set but the feature is not registered.\n` +
          `Add this import to enable it:\n\n` +
          `  import '@toolbox-web/grid-react/features/${name}';\n`,
      );
    }
    return undefined;
  }

  return entry.factory(config);
}

/**
 * Clear the registry. For testing only.
 * @internal
 */
export function clearFeatureRegistry(): void {
  featureRegistry.clear();
  warnedFeatures.clear();
}

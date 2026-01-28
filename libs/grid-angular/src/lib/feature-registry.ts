/**
 * Feature Registry for @toolbox-web/grid-angular
 *
 * This module provides a synchronous registry for plugin factories.
 * Features are registered via side-effect imports, enabling tree-shaking
 * while maintaining the clean input-based API.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-angular/features/selection';
 * import '@toolbox-web/grid-angular/features/filtering';
 *
 * // Inputs work automatically - no async loading, no HTTP requests
 * <tbw-grid [selection]="'range'" [filtering]="{ debounceMs: 200 }" />
 * ```
 */

/**
 * Feature names supported by the Grid directive.
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
 * @param name - The feature name (matches the input name on Grid directive)
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
        `[tbw-grid] Feature "${name}" input is set but the feature is not registered.\n` +
          `Add this import to enable it:\n\n` +
          `  import '@toolbox-web/grid-angular/features/${toKebabCase(name)}';\n`,
      );
    }
    return undefined;
  }

  return entry.factory(config);
}

/**
 * Convert camelCase to kebab-case for import paths.
 */
function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Clear the registry. For testing only.
 * @internal
 */
export function clearFeatureRegistry(): void {
  featureRegistry.clear();
  warnedFeatures.clear();
}

/**
 * Synchronous plugin creation from feature props using the feature registry.
 *
 * This module provides synchronous plugin creation based on feature props.
 * Features must be registered via side-effect imports before use.
 *
 * @example
 * ```tsx
 * // Import features first (side effects)
 * import '@toolbox-web/grid-react/features/selection';
 * import '@toolbox-web/grid-react/features/filtering';
 *
 * // Then use the props
 * <DataGrid selection="range" filtering />
 * ```
 */

import type { AllFeatureProps } from './feature-props';
import { createPluginFromFeature, isFeatureRegistered, type FeatureName } from './feature-registry';

/**
 * Plugin dependency declarations.
 * Some plugins require others to be loaded first.
 */
const PLUGIN_DEPENDENCIES: Partial<Record<FeatureName, FeatureName[]>> = {
  undoRedo: ['editing'],
  clipboard: ['selection'],
};

/**
 * Validates that all required dependencies are met for the requested features.
 * Logs a warning if a dependency is missing.
 */
export function validateFeatureDependencies(featureNames: FeatureName[]): void {
  const featureSet = new Set(featureNames);

  for (const feature of featureNames) {
    const deps = PLUGIN_DEPENDENCIES[feature];
    if (!deps) continue;

    for (const dep of deps) {
      if (!featureSet.has(dep)) {
        console.warn(
          `[DataGrid] Feature "${feature}" requires "${dep}" to be enabled. ` +
            `Add the "${dep}" prop to your DataGrid.`,
        );
      }
    }
  }
}

/**
 * Creates plugin instances synchronously from feature props.
 * Returns an array of plugin instances for all registered features.
 *
 * @param featureProps - The feature props from DataGrid
 * @returns Array of plugin instances
 */
export function createPluginsFromFeatures<TRow = unknown>(featureProps: Partial<AllFeatureProps<TRow>>): unknown[] {
  const plugins: unknown[] = [];
  const enabledFeatures: FeatureName[] = [];

  // Collect all enabled features
  for (const [key, value] of Object.entries(featureProps)) {
    if (value === undefined || value === false) continue;

    const featureName = key as FeatureName;
    enabledFeatures.push(featureName);
  }

  // Validate dependencies
  validateFeatureDependencies(enabledFeatures);

  // Create plugins in dependency order
  // First: plugins that others depend on
  const dependencyOrder: FeatureName[] = [
    'selection',
    'editing',
    // Then everything else in the order they were specified
    ...enabledFeatures.filter((f) => f !== 'selection' && f !== 'editing'),
  ];

  // Remove duplicates while preserving order
  const orderedFeatures = [...new Set(dependencyOrder)].filter((f) => enabledFeatures.includes(f));

  for (const featureName of orderedFeatures) {
    const config = featureProps[featureName];
    if (config === undefined || config === false) continue;

    // createPluginFromFeature handles unregistered features with a warning
    const plugin = createPluginFromFeature(featureName, config);
    if (plugin) {
      plugins.push(plugin);
    }
  }

  return plugins;
}

/**
 * Get list of feature names that are enabled but not registered.
 * Useful for debugging.
 */
export function getUnregisteredFeatures(featureProps: Partial<AllFeatureProps>): FeatureName[] {
  const unregistered: FeatureName[] = [];

  for (const [key, value] of Object.entries(featureProps)) {
    if (value === undefined || value === false) continue;

    const featureName = key as FeatureName;
    if (!isFeatureRegistered(featureName)) {
      unregistered.push(featureName);
    }
  }

  return unregistered;
}

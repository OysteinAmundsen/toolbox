/**
 * Core Feature Registry for @toolbox-web/grid
 *
 * This module provides a framework-agnostic registry for plugin factories.
 * Features are registered via side-effect imports, enabling tree-shaking
 * while maintaining a clean declarative API.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid/features/selection';
 * import '@toolbox-web/grid/features/filtering';
 *
 * // Configure grid declaratively
 * grid.gridConfig = {
 *   features: {
 *     selection: 'range',
 *     filtering: { debounceMs: 200 },
 *   },
 * };
 * ```
 *
 * @packageDocumentation
 * @module Features
 */

import { Diagnostic, warnDiagnostic } from '../core/internal/diagnostics';
import { setFeatureResolver } from '../core/internal/feature-hook';
import type { FeatureConfig, GridPlugin } from '../core/types';

// #region Types

/** Feature name — keys of the augmented FeatureConfig interface. */
export type FeatureName = keyof FeatureConfig;

/** Factory function that creates a plugin from a feature config value. */
export type PluginFactory<TConfig = unknown> = (config: TConfig) => GridPlugin;

interface RegistryEntry {
  factory: PluginFactory;
  name: string;
}

// #endregion

// #region Registry State

const featureRegistry = new Map<string, RegistryEntry>();
const warnedFeatures = new Set<string>();

// #endregion

// #region Registration API

/** Runtime dev-mode check (localhost or 127.0.0.1). */
const isDev = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1');

/**
 * Register a feature's plugin factory.
 * Called by side-effect feature imports (e.g., `import '@toolbox-web/grid/features/selection'`).
 *
 * @param name - The feature name (matches a key on FeatureConfig)
 * @param factory - Function that creates a plugin instance from config
 */
export function registerFeature<K extends FeatureName>(name: K, factory: PluginFactory<FeatureConfig[K]>): void;
export function registerFeature(name: string, factory: PluginFactory): void;
export function registerFeature(name: string, factory: PluginFactory): void {
  if (isDev() && featureRegistry.has(name)) {
    warnDiagnostic(
      Diagnostic.FEATURE_REREGISTERED,
      `Feature "${name}" was re-registered. Previous registration overwritten.`,
    );
  }
  featureRegistry.set(name, { factory, name });
}

/**
 * Check if a feature has been registered.
 */
export function isFeatureRegistered(name: string): boolean {
  return featureRegistry.has(name);
}

/**
 * Get a registered feature's factory. Returns undefined if not registered.
 */
export function getFeatureFactory(name: string): PluginFactory | undefined {
  return featureRegistry.get(name)?.factory;
}

/**
 * Get all registered feature names.
 */
export function getRegisteredFeatures(): string[] {
  return Array.from(featureRegistry.keys());
}

// #endregion

// #region Plugin Creation

/**
 * Plugin dependency declarations.
 * Some plugins require others to be loaded first.
 */
const PLUGIN_DEPENDENCIES: Record<string, string[]> = {
  undoRedo: ['editing'],
  clipboard: ['selection'],
};

/**
 * Deprecated alias mappings.
 * When both alias and primary are set, primary takes precedence.
 */
const FEATURE_ALIASES: Record<string, string> = {
  sorting: 'multiSort',
  reorder: 'reorderColumns',
  rowReorder: 'reorderRows',
};

/**
 * Create a plugin instance for a single feature.
 * Shows a warning if the feature is not registered.
 */
export function createPluginFromFeature(name: string, config: unknown): GridPlugin | undefined {
  const entry = featureRegistry.get(name);

  if (!entry) {
    if (isDev() && !warnedFeatures.has(name)) {
      warnedFeatures.add(name);
      const kebab = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      warnDiagnostic(
        Diagnostic.FEATURE_NOT_IMPORTED,
        `Feature "${name}" is configured but not registered.\n` +
          `Add this import to enable it:\n\n` +
          `  import '@toolbox-web/grid/features/${kebab}';\n`,
      );
    }
    return undefined;
  }

  return entry.factory(config);
}

/**
 * Validate feature dependencies and log warnings for missing ones.
 */
function validateDependencies(featureNames: string[]): void {
  const featureSet = new Set(featureNames);

  for (const feature of featureNames) {
    const deps = PLUGIN_DEPENDENCIES[feature];
    if (!deps) continue;

    for (const dep of deps) {
      if (!featureSet.has(dep)) {
        if (isDev()) {
          warnDiagnostic(
            Diagnostic.FEATURE_MISSING_DEP,
            `Feature "${feature}" requires "${dep}" to be enabled. ` + `Add "${dep}" to your features configuration.`,
          );
        }
      }
    }
  }
}

/**
 * Create plugin instances from a features configuration object.
 *
 * Handles:
 * - Deprecated alias resolution (sorting → multiSort, etc.)
 * - Dependency validation (clipboard needs selection)
 * - Dependency ordering (selection before clipboard)
 * - Skipping false/undefined values
 *
 * @param features - Partial FeatureConfig object
 * @returns Array of plugin instances ready for gridConfig.plugins
 */
export function createPluginsFromFeatures(features: Record<string, unknown>): GridPlugin[] {
  const plugins: GridPlugin[] = [];
  const enabledFeatures: string[] = [];

  // Resolve deprecated aliases: use primary name, skip alias if primary is set
  const effective: Record<string, unknown> = { ...features };
  for (const [alias, primary] of Object.entries(FEATURE_ALIASES)) {
    if (effective[alias] !== undefined && effective[primary] === undefined) {
      effective[primary] = effective[alias];
    }
    delete effective[alias];
  }

  // Collect enabled feature names
  for (const [key, value] of Object.entries(effective)) {
    if (value === undefined || value === false) continue;
    enabledFeatures.push(key);
  }

  // Validate dependencies
  validateDependencies(enabledFeatures);

  // Create plugins in dependency order: dep-targets first, then the rest
  const dependencyOrder: string[] = [
    'selection',
    'editing',
    ...enabledFeatures.filter((f) => f !== 'selection' && f !== 'editing'),
  ];
  const orderedFeatures = [...new Set(dependencyOrder)].filter((f) => enabledFeatures.includes(f));

  for (const featureName of orderedFeatures) {
    const config = effective[featureName];
    if (config === undefined || config === false) continue;

    const plugin = createPluginFromFeature(featureName, config);
    if (plugin) {
      plugins.push(plugin);
    }
  }

  return plugins;
}

// #endregion

// #region Auto-Registration

// Wire feature resolver into grid core so `gridConfig.features` is handled automatically.
// This runs when any feature module is imported (they all import this registry).
setFeatureResolver(createPluginsFromFeatures as (features: Record<string, unknown>) => GridPlugin[]);

// #endregion

// #region Testing Utilities

/**
 * Clear the registry. For testing only.
 * @internal
 */
export function clearFeatureRegistry(): void {
  featureRegistry.clear();
  warnedFeatures.clear();
}

// #endregion

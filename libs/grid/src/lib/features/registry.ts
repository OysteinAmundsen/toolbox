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

import {
  FEATURE_MISSING_DEP,
  FEATURE_NOT_IMPORTED,
  FEATURE_REREGISTERED,
  warnDiagnostic,
} from '../core/internal/diagnostics';
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

/*
 * Cross-bundle singleton (version-scoped).
 *
 * The custom-elements registry is realm-global, but `import` graphs are not:
 * when two micro-frontend widgets on the same page bundle their own copy of
 * `@toolbox-web/grid`, each copy gets its own `featureRegistry` Map. The
 * `<tbw-grid>` class is realm-global (see `registerDataGrid()` in
 * `core/grid.ts`), so the *running* class resolves features via the resolver
 * its own bundle wired up — which closes over the *local* Map. Side-effect
 * imports from any other bundle (`import '@toolbox-web/grid/features/tree'`)
 * land in a different Map that the running class never reads, producing
 * spurious TBW031 "feature not registered" warnings.
 *
 * Fix: persist the Map on `globalThis` under a `Symbol.for(...)` key so every
 * loaded copy of this module reads and writes the same instance.
 *
 * The key embeds `__GRID_VERSION__` so **only same-version** bundles share a
 * registry. `registerDataGrid()` already isolates differently-versioned grid
 * classes by registering them under suffixed tag names (`tbw-grid-v<version>`,
 * issue #339); the feature registry must mirror that isolation, otherwise the
 * last-loaded bundle's plugin factories would overwrite earlier versions'
 * entries and the running grid would attach plugin instances built against a
 * different internal contract. The trailing `/v1` is a schema version for the
 * slot shape — bump if the stored value's shape changes incompatibly.
 *
 * Issue: planning #9 (two Roma widgets each bundling their own grid copy).
 */
declare const __GRID_VERSION__: string;
const GRID_VERSION = typeof __GRID_VERSION__ !== 'undefined' ? __GRID_VERSION__ : 'dev';
const REGISTRY_KEY = Symbol.for(`@toolbox-web/grid:feature-registry@${GRID_VERSION}/v1`);
const WARNED_KEY = Symbol.for(`@toolbox-web/grid:feature-registry-warned@${GRID_VERSION}/v1`);

function getOrCreateGlobal<T>(key: symbol, make: () => T): T {
  let value = Reflect.get(globalThis, key) as T | undefined;
  if (value === undefined) {
    value = make();
    Reflect.set(globalThis, key, value);
  }
  return value;
}

const featureRegistry = getOrCreateGlobal(REGISTRY_KEY, () => new Map<string, RegistryEntry>());
const warnedFeatures = getOrCreateGlobal(WARNED_KEY, () => new Set<string>());

// #endregion

// #region Registration API

/** Runtime dev-mode check (localhost or 127.0.0.1). */
const isDev = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1');

/** Optional flags passed to {@link registerFeature}. */
export interface RegisterFeatureOptions {
  /**
   * Set to `true` when the registration is intentionally overwriting an
   * existing entry (e.g. a framework adapter wrapping the vanilla factory
   * with reactive bridging). Suppresses the TBW030 dev-mode warning.
   */
  override?: boolean;
}

/**
 * Register a feature's plugin factory.
 * Called by side-effect feature imports (e.g., `import '@toolbox-web/grid/features/selection'`).
 *
 * @param name - The feature name (matches a key on FeatureConfig)
 * @param factory - Function that creates a plugin instance from config
 * @param options - Pass `{ override: true }` for intentional re-registration
 *   (framework adapters bridging the vanilla factory) to suppress TBW030.
 */
export function registerFeature<K extends FeatureName>(
  name: K,
  factory: PluginFactory<FeatureConfig[K]>,
  options?: RegisterFeatureOptions,
): void;
export function registerFeature(name: string, factory: PluginFactory, options?: RegisterFeatureOptions): void;
export function registerFeature(name: string, factory: PluginFactory, options?: RegisterFeatureOptions): void {
  if (isDev() && featureRegistry.has(name) && !options?.override) {
    warnDiagnostic(FEATURE_REREGISTERED, `Feature "${name}" was re-registered. Previous registration overwritten.`);
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
        FEATURE_NOT_IMPORTED,
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
            FEATURE_MISSING_DEP,
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

  // Collect enabled feature names
  for (const [key, value] of Object.entries(features)) {
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
    const config = features[featureName];
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

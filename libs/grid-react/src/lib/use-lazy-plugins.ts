/**
 * React hook for dynamically loading grid plugins based on feature props.
 *
 * This hook uses dynamic imports to load only the plugins you actually use.
 * The consumer's bundler will code-split each plugin into separate chunks,
 * which are fetched on-demand at runtime.
 *
 * @internal
 */

import type { BaseGridPlugin } from '@toolbox-web/grid';
import { useEffect, useMemo, useState } from 'react';
import type { FeatureProps } from './feature-props';
import { PLUGIN_LOADERS, type FeaturePropName } from './plugin-loaders';

/**
 * Result of the plugin loading hook
 */
export interface UseLazyPluginsResult {
  /** Plugin instances (empty while loading) */
  plugins: BaseGridPlugin[];
  /** True while plugins are being loaded */
  isLoading: boolean;
  /** Error if loading failed (null if successful) */
  error: Error | null;
}

/**
 * Performs topological sort on plugins based on dependencies.
 * Ensures plugins are instantiated in correct order (dependencies first).
 *
 * @param propNames - Set of feature prop names to instantiate
 * @returns Ordered array of prop names with dependencies first
 */
function topologicalSort(propNames: Set<FeaturePropName>): FeaturePropName[] {
  const result: FeaturePropName[] = [];
  const visited = new Set<FeaturePropName>();
  const visiting = new Set<FeaturePropName>(); // For cycle detection

  function visit(name: FeaturePropName) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      // Cycle detected - shouldn't happen with our known dependencies, but handle gracefully
      console.warn(`[grid-react] Circular plugin dependency detected involving: ${name}`);
      return;
    }

    visiting.add(name);

    // Get dependencies for this plugin
    const loader = PLUGIN_LOADERS[name];
    const dependencies = loader?.dependencies ?? [];

    // Visit dependencies first (if they're in our set)
    for (const dep of dependencies) {
      if (propNames.has(dep as FeaturePropName)) {
        visit(dep as FeaturePropName);
      } else if (dep in PLUGIN_LOADERS) {
        // Dependency exists but wasn't specified - we need to add it!
        // This handles implicit dependency resolution
        propNames.add(dep as FeaturePropName);
        visit(dep as FeaturePropName);
      }
    }

    visiting.delete(name);
    visited.add(name);
    result.push(name);
  }

  // Visit all requested plugins
  for (const name of propNames) {
    visit(name);
  }

  return result;
}

/**
 * Extracts feature prop names and their values from props object.
 * Only returns props that are defined and not explicitly disabled (false).
 */
function extractFeatureProps<TRow = unknown>(props: FeatureProps<TRow>): Map<FeaturePropName, unknown> {
  const featureMap = new Map<FeaturePropName, unknown>();
  const featureNames = Object.keys(PLUGIN_LOADERS) as FeaturePropName[];

  for (const name of featureNames) {
    const value = (props as Record<string, unknown>)[name];
    // Skip undefined (not specified) and false (explicitly disabled)
    if (value !== undefined && value !== false) {
      featureMap.set(name, value);
    }
  }

  return featureMap;
}

/**
 * Hook for dynamically loading grid plugins based on feature props.
 *
 * Plugins are loaded asynchronously via dynamic imports. This enables
 * code-splitting - only plugins you use are downloaded to the browser.
 *
 * @example
 * ```tsx
 * const { plugins, isLoading, error } = useLazyPlugins({
 *   selection: 'range',
 *   filtering: true,
 *   editing: 'dblclick',
 * });
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * // plugins is now ready to use
 * ```
 *
 * @param featureProps - Object containing feature props
 * @returns Object with plugins array, isLoading flag, and error
 */
export function useLazyPlugins<TRow = unknown>(featureProps: FeatureProps<TRow>): UseLazyPluginsResult {
  // Compute stable key FIRST - directly from props, before creating Map
  // This ensures the key is stable even when featureProps object reference changes
  const featureKey = useMemo(() => {
    const featureNames = Object.keys(PLUGIN_LOADERS) as FeaturePropName[];
    return featureNames
      .filter((name) => {
        const value = (featureProps as Record<string, unknown>)[name];
        return value !== undefined && value !== false;
      })
      .map((name) => `${name}:${JSON.stringify((featureProps as Record<string, unknown>)[name])}`)
      .sort()
      .join('|');
  }, [featureProps]);

  // Extract feature props only when the stable key changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureMap = useMemo(() => extractFeatureProps(featureProps), [featureKey]);

  // Track loading state - start as loading only if we have features
  const [plugins, setPlugins] = useState<BaseGridPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(() => {
    // Check if there are any features on initial render
    const featureNames = Object.keys(PLUGIN_LOADERS) as FeaturePropName[];
    return featureNames.some((name) => {
      const value = (featureProps as Record<string, unknown>)[name];
      return value !== undefined && value !== false;
    });
  });
  const [error, setError] = useState<Error | null>(null);

  // Load plugins asynchronously - only depends on featureKey (stable string)
  useEffect(() => {
    // If no features, nothing to load
    if (featureMap.size === 0) {
      setPlugins([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadPlugins() {
      setIsLoading(true);
      setError(null);

      try {
        // Get topologically sorted plugin names (dependencies first)
        const propNames = new Set(featureMap.keys());
        const sortedNames = topologicalSort(propNames);

        // Load plugins in order (maintaining dependency order)
        const loadedPlugins: BaseGridPlugin[] = [];

        for (const name of sortedNames) {
          if (cancelled) return;

          const loaderDef = PLUGIN_LOADERS[name];
          if (!loaderDef) {
            console.warn(`[grid-react] Unknown feature prop: ${name}`);
            continue;
          }

          // Get the config value (may have been added via dependency resolution)
          let config = featureMap.get(name);

          // If this was added as an implicit dependency, use default config
          if (config === undefined) {
            if (name === 'selection') {
              config = 'row';
            } else if (name === 'editing') {
              config = true;
            } else {
              config = true;
            }
          }

          // Load and instantiate the plugin asynchronously
          const plugin = await loaderDef.loader(config as never);
          loadedPlugins.push(plugin);
        }

        if (!cancelled) {
          setPlugins(loadedPlugins);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const loadError = err instanceof Error ? err : new Error(String(err));
          console.error('[grid-react] Failed to load plugins:', loadError);
          setError(loadError);
          setIsLoading(false);
        }
      }
    }

    loadPlugins();

    return () => {
      cancelled = true;
    };
    // Only depend on featureKey (stable string), not featureMap (object reference)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureKey]);

  return { plugins, isLoading, error };
}

/**
 * Validates that required dependencies are present.
 * Logs warnings for missing dependencies that will be auto-added.
 *
 * @param featureProps - Object containing feature props
 * @returns Array of warning messages for auto-added dependencies
 */
export function validateDependencies<TRow = unknown>(featureProps: FeatureProps<TRow>): string[] {
  const warnings: string[] = [];
  const featureMap = extractFeatureProps(featureProps);

  for (const [name] of featureMap) {
    const loader = PLUGIN_LOADERS[name];
    if (!loader?.dependencies?.length) continue;

    for (const dep of loader.dependencies) {
      if (!featureMap.has(dep as FeaturePropName)) {
        warnings.push(
          `The "${name}" feature requires "${dep}". ` + `Adding "${dep}" automatically with default configuration.`,
        );
      }
    }
  }

  return warnings;
}

/**
 * React hook for lazy-loading grid plugins based on feature props.
 *
 * This hook dynamically imports plugins only when their corresponding feature props
 * are used, ensuring tree-shaking and minimal bundle size.
 *
 * @internal
 */

import type { BaseGridPlugin } from '@toolbox-web/grid';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureProps } from './feature-props';
import { PLUGIN_LOADERS, type FeaturePropName } from './plugin-loaders';

/**
 * Result of the lazy plugin loading hook
 */
export interface UseLazyPluginsResult {
  /** Loaded plugin instances ready to use */
  plugins: BaseGridPlugin[];
  /** Whether plugins are currently loading */
  isLoading: boolean;
  /** Error if loading failed */
  error: Error | null;
}

/**
 * Performs topological sort on plugins based on dependencies.
 * Ensures plugins are loaded in correct order (dependencies first).
 *
 * @param propNames - Set of feature prop names to load
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
 * Creates a stable cache key from feature props for dependency tracking.
 * Only includes defined feature props to minimize re-loads.
 */
function createCacheKey(featureMap: Map<FeaturePropName, unknown>): string {
  const entries = Array.from(featureMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      // For objects, create a deterministic string representation
      const valueKey = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
      return `${key}:${valueKey}`;
    });
  return entries.join('|');
}

/**
 * Hook for lazy-loading grid plugins based on feature props.
 *
 * @example
 * ```tsx
 * const { plugins, isLoading, error } = useLazyPlugins({
 *   selection: 'range',
 *   filtering: true,
 *   editing: 'dblclick',
 * });
 * ```
 *
 * @param featureProps - Object containing feature props
 * @returns Object with loaded plugins, loading state, and error
 */
export function useLazyPlugins<TRow = unknown>(featureProps: FeatureProps<TRow>): UseLazyPluginsResult {
  const [plugins, setPlugins] = useState<BaseGridPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the previous cache key to detect changes
  const prevCacheKeyRef = useRef<string>('');

  // Extract active feature props and create cache key
  const featureMap = useMemo(() => extractFeatureProps(featureProps), [featureProps]);
  const cacheKey = useMemo(() => createCacheKey(featureMap), [featureMap]);

  useEffect(() => {
    // Skip if nothing changed
    if (cacheKey === prevCacheKeyRef.current) {
      return;
    }
    prevCacheKeyRef.current = cacheKey;

    // If no features, return empty
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

        // Load plugins in order
        const loadedPlugins: BaseGridPlugin[] = [];

        for (const name of sortedNames) {
          if (cancelled) return;

          const loader = PLUGIN_LOADERS[name];
          if (!loader) {
            console.warn(`[grid-react] Unknown feature prop: ${name}`);
            continue;
          }

          // Get the config value (may have been added via dependency resolution)
          let config = featureMap.get(name);

          // If this was added as an implicit dependency, use default config
          if (config === undefined) {
            // Implicit dependencies get sensible defaults
            if (name === 'selection') {
              config = 'row'; // Default selection mode
            } else if (name === 'editing') {
              config = true; // Default editing
            } else {
              config = true; // Generic true for boolean-like props
            }
          }

          try {
            // Config type varies per loader, so we use type assertion here
            const plugin = await loader.loader(config as never);
            loadedPlugins.push(plugin);
          } catch (err) {
            console.error(`[grid-react] Failed to load plugin "${name}":`, err);
            throw new Error(`Failed to load plugin "${name}": ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        if (!cancelled) {
          setPlugins(loadedPlugins);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      }
    }

    loadPlugins();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, featureMap]);

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

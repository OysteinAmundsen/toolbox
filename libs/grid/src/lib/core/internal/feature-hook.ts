/**
 * Hook point for the feature registry to connect to the grid core
 * without introducing circular imports or adding registry code to the core bundle.
 *
 * - grid.ts reads `resolveFeatures` to convert `gridConfig.features` into plugins.
 * - registry.ts calls `setFeatureResolver()` at load time to provide the implementation.
 *
 * If no feature modules are imported, `resolveFeatures` stays undefined,
 * and the grid ignores `gridConfig.features` (zero cost).
 *
 * @internal
 */

import type { GridPlugin } from '../types';

/** Feature-to-plugin resolver function type. */
export type FeatureResolverFn = (features: Record<string, unknown>) => GridPlugin[];

/** Resolver set by the feature registry when loaded. undefined until first feature import. */
export let resolveFeatures: FeatureResolverFn | undefined;

/** Called by `features/registry.ts` at module evaluation time. @internal * @since 1.24.0
 */
export function setFeatureResolver(fn: FeatureResolverFn): void {
  resolveFeatures = fn;
}

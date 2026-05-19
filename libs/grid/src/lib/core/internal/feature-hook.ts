/**
 * Hook point for the feature registry to connect to the grid core
 * without introducing circular imports or adding registry code to the core bundle.
 *
 * - grid.ts reads the resolver via {@link getFeatureResolver} to convert
 *   `gridConfig.features` into plugins.
 * - registry.ts calls {@link setFeatureResolver} at load time to provide the
 *   implementation.
 *
 * The resolver lives on the page-wide shared store (see `shared-store.ts`)
 * so that two bundled copies of `@toolbox-web/grid` on the same page
 * (micro-frontend scenario, issue #338) converge on a single resolver.
 * Without this, a feature module imported by copy B would register into B's
 * local map while the `<tbw-grid>` element on the page reads from A's map,
 * surfacing as a TBW031 "Feature X is configured but not registered" warning.
 *
 * If no feature modules are imported anywhere on the page,
 * {@link getFeatureResolver} returns `undefined` and the grid ignores
 * `gridConfig.features` (zero cost).
 *
 * @internal
 */

import { getSharedStore } from './shared-store';
import type { GridPlugin } from '../types';

/** Feature-to-plugin resolver function type. */
export type FeatureResolverFn = (features: Record<string, unknown>) => GridPlugin[];

/**
 * Read the current resolver. Returns `undefined` until a feature module is
 * imported anywhere on the page.
 *
 * @internal
 * @since 2.14.0
 */
export function getFeatureResolver(): FeatureResolverFn | undefined {
  return getSharedStore().featureResolver as FeatureResolverFn | undefined;
}

/**
 * Called by `features/registry.ts` at module evaluation time.
 *
 * @internal
 * @since 1.24.0
 */
export function setFeatureResolver(fn: FeatureResolverFn): void {
  getSharedStore().featureResolver = fn as (features: Record<string, unknown>) => unknown[];
}

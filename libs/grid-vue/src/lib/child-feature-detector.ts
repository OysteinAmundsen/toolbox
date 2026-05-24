/**
 * Child-component feature-detector registry — keyed by Vue component name
 * (`type.__name` for `<script setup>` SFCs or `type.name`), each entry returns
 * a partial feature-prop record that `<TbwGrid>` can merge into its
 * `createPluginsFromFeatures()` input.
 *
 * Mirrors the React adapter's
 * `@toolbox-web/grid-react/lib/child-feature-detector` registry so the
 * declarative child-component pattern stays portable across adapters (gh #356
 * §8). Vue's `<TbwGrid>` does not currently invoke this registry — child
 * detection from default slots is deferred to the v3 `:features=` decoupling
 * (#262). The registry ships now so feature secondary entries can register
 * detectors with the same `register*(name, fn)` shape they use in React, and
 * so third-party features built today will Just Work once the call site lands.
 *
 * Mirrors {@link registerPostMountRefresh}: Map-based, replace-on-re-register
 * (HMR-friendly).
 *
 * @packageDocumentation
 * @internal
 */

import type { VNode } from 'vue';

/**
 * Detector callback: given the VNode whose component name matched the
 * registry key, return the partial feature-prop record to auto-enable the
 * corresponding plugin. Return `undefined` to skip.
 *
 * @typeParam TFeatures - Adapter `FeatureProps` shape.
 */
export type ChildFeatureDetector<TFeatures = Record<string, unknown>> = (
  vnode: VNode,
) => Partial<TFeatures> | undefined;

const childFeatureDetectors = new Map<string, ChildFeatureDetector>();

/**
 * Install a child-feature detector keyed by Vue component name (matches
 * `vnode.type.__name` for `<script setup>` SFCs or `vnode.type.name`).
 * Re-registering the same name replaces the previous detector
 * (HMR-friendly). Called by feature secondary entries on import.
 *
 * @internal Plugin API
 */
export function registerChildFeatureDetector<TFeatures = Record<string, unknown>>(
  name: string,
  detector: ChildFeatureDetector<TFeatures>,
): void {
  childFeatureDetectors.set(name, detector as ChildFeatureDetector);
}

/**
 * Scan an array of VNodes (typically the result of calling the default slot
 * function) and merge every matching detector's output into a single partial
 * feature-prop record. Later children override earlier ones for the same
 * feature key.
 *
 * Not yet wired into `<TbwGrid>` — see module docs.
 *
 * @internal
 */
export function detectChildFeatures<TFeatures = Record<string, unknown>>(
  vnodes: readonly VNode[] | undefined,
): Partial<TFeatures> {
  const features: Record<string, unknown> = {};
  if (!vnodes || childFeatureDetectors.size === 0) return features as Partial<TFeatures>;

  for (const vnode of vnodes) {
    const type = vnode?.type as { __name?: string; name?: string } | string | symbol | undefined;
    if (!type || typeof type === 'string' || typeof type === 'symbol') continue;
    const name = type.__name ?? type.name;
    if (typeof name !== 'string') continue;
    const detector = childFeatureDetectors.get(name);
    if (!detector) continue;
    const detected = detector(vnode);
    if (detected) Object.assign(features, detected);
  }

  return features as Partial<TFeatures>;
}

/**
 * Test-only: clear all registered detectors so specs assert in isolation.
 *
 * @internal
 */
export function clearChildFeatureDetectors(): void {
  childFeatureDetectors.clear();
}

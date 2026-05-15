/**
 * Adapter conformance helpers.
 *
 * Every framework adapter (React, Vue, Angular, custom) must implement the
 * same set of {@link FrameworkAdapter} hooks — otherwise users on one
 * framework silently lose features available on the others.
 *
 * Add a single conformance spec per adapter:
 *
 * ```ts
 * import { assertAdapterConformance } from '@toolbox-web/grid';
 * import { GridAdapter } from './my-grid-adapter';
 *
 * it('conforms', () => assertAdapterConformance(new GridAdapter()));
 * ```
 *
 * @category Framework Adapters
 */

import type { FrameworkAdapter } from './types';

/**
 * Method names that are technically optional on {@link FrameworkAdapter}
 * but are actually consumed by the grid core. An adapter that skips any
 * of these silently drops the matching feature for its framework users.
 * @since 2.3.0
 */
export const CORE_CONSUMED_ADAPTER_METHODS: ReadonlyArray<keyof FrameworkAdapter> = [
  'canHandle',
  'createRenderer',
  'createEditor',
  'processConfig',
  'getTypeDefault',
  'createToolPanelRenderer',
  'parseDetailElement',
  'parseResponsiveCardElement',
  'releaseCell',
  'unmount',
  'beginBatch',
  'endBatch',
] as const;

export interface AdapterConformanceReport {
  name: string;
  implemented: (keyof FrameworkAdapter)[];
  missing: (keyof FrameworkAdapter)[];
}

/**
 * Inspect an adapter and report which core-consumed hooks are implemented
 * vs. missing. Performs a shallow `typeof adapter[name] === 'function'`
 * check — works for class instances, prototypes, and plain objects.
 */
export function reportAdapterConformance(adapter: FrameworkAdapter): AdapterConformanceReport {
  const implemented: (keyof FrameworkAdapter)[] = [];
  const missing: (keyof FrameworkAdapter)[] = [];
  for (const m of CORE_CONSUMED_ADAPTER_METHODS) {
    const v = (adapter as unknown as Record<string, unknown>)[m];
    (typeof v === 'function' ? implemented : missing).push(m);
  }
  const name = (adapter as { constructor?: { name?: string } }).constructor?.name ?? 'Adapter';
  return { name, implemented, missing };
}

/**
 * Assert that an adapter implements every core-consumed hook.
 * Throws listing the missing method names. Intended for unit tests.
 */
export function assertAdapterConformance(adapter: FrameworkAdapter): void {
  const r = reportAdapterConformance(adapter);
  if (r.missing.length === 0) return;
  throw new Error(`${r.name} is missing FrameworkAdapter hook(s): ${r.missing.join(', ')}`);
}

/**
 * Cross-module-instance shared-store tests.
 *
 * Simulates the micro-frontend scenario where two bundled copies of
 * `@toolbox-web/grid` live on the same page (issue #338). `vi.resetModules()`
 * clears the module cache so the next dynamic `import()` re-evaluates the
 * registry, giving us a fresh "copy". The `globalThis` symbol slot persists
 * across `resetModules()` calls, which is exactly the property that lets
 * both copies converge on the same shared state.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedStore } from './shared-store';

const SHARED_STORE_KEY = Symbol.for('@toolbox-web/grid/shared');

describe('shared-store', () => {
  beforeEach(() => {
    // Reset to a clean global between tests so we exercise both "first load"
    // and "second load" code paths deterministically.
    delete (globalThis as Record<symbol, unknown>)[SHARED_STORE_KEY];
    vi.resetModules();
  });

  it('returns the same store identity across calls within one module copy', () => {
    expect(getSharedStore()).toBe(getSharedStore());
  });

  it('returns the same store identity across two module copies', async () => {
    const first = (await import('./shared-store')).getSharedStore();
    vi.resetModules();
    const second = (await import('./shared-store')).getSharedStore();
    expect(second).toBe(first);
  });

  it('preserves bucket contents across module copies (the registry-sharing invariant)', async () => {
    const copyA = await import('./shared-store');
    copyA.getOrCreateShared('reactContexts', 'demo', () => ({ tag: 'A' }));

    vi.resetModules();
    const copyB = await import('./shared-store');

    // Copy B's factory MUST NOT run — copy A's value wins.
    const fromB = copyB.getOrCreateShared('reactContexts', 'demo', () => ({ tag: 'B' }));
    expect(fromB).toEqual({ tag: 'A' });
  });

  it('exposes the feature resolver through the shared store', async () => {
    const copyA = await import('./feature-hook');
    const resolverA = vi.fn(() => []);
    copyA.setFeatureResolver(resolverA);

    vi.resetModules();
    const copyB = await import('./feature-hook');

    expect(copyB.getFeatureResolver()).toBe(resolverA);
  });
});

describe('feature registry — cross-module-instance', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[SHARED_STORE_KEY];
    vi.resetModules();
  });

  it('features registered by copy B are visible to copy A (TBW031 root cause)', async () => {
    const copyA = await import('../../features/registry');
    vi.resetModules();
    const copyB = await import('../../features/registry');

    // Widget (copy B) imports a feature module that calls registerFeature.
    const factory = vi.fn(() => ({ name: 'demo', enabled: true }) as never);
    copyB.registerFeature('demo' as never, factory);

    // Host (copy A) reads the registry to resolve gridConfig.features.
    expect(copyA.isFeatureRegistered('demo')).toBe(true);
    expect(copyA.getFeatureFactory('demo')).toBe(factory);
  });
});

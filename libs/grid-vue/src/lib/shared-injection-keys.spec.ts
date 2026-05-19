/**
 * Cross-module-instance InjectionKey sharing test for grid-vue.
 *
 * Simulates two bundled copies of `@toolbox-web/grid-vue` co-existing on
 * one page (micro-frontend scenario, issue #338). Without the shared-store
 * indirection, each copy would mint its own `Symbol(...)` — `provide()` from
 * copy A and `inject()` from copy B would silently fall back to the default
 * (typically `ref(null)`) and feature composables (export, filtering, print,
 * selection, undo-redo) would no-op with no error.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SHARED_STORE_KEY = Symbol.for('@toolbox-web/grid/shared');

describe('grid-vue cross-module-instance injection-key sharing', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[SHARED_STORE_KEY];
    vi.resetModules();
  });

  it('GRID_ELEMENT_KEY symbol is shared across module copies', async () => {
    const copyA = await import('./use-grid');
    vi.resetModules();
    const copyB = await import('./use-grid');

    expect(copyB.GRID_ELEMENT_KEY).toBe(copyA.GRID_ELEMENT_KEY);
  });

  it('GRID_ICONS symbol is shared across module copies', async () => {
    const copyA = await import('./grid-icon-registry');
    vi.resetModules();
    const copyB = await import('./grid-icon-registry');

    expect(copyB.GRID_ICONS).toBe(copyA.GRID_ICONS);
  });

  it('GRID_TYPE_DEFAULTS symbol is shared across module copies', async () => {
    const copyA = await import('./grid-type-registry');
    vi.resetModules();
    const copyB = await import('./grid-type-registry');

    expect(copyB.GRID_TYPE_DEFAULTS).toBe(copyA.GRID_TYPE_DEFAULTS);
  });
});

/**
 * Cross-module-instance Context sharing test for grid-react.
 *
 * Simulates two bundled copies of `@toolbox-web/grid-react` co-existing on
 * one page (micro-frontend scenario, issue #338). Without the shared-store
 * indirection, each copy would call `React.createContext(...)` and get a
 * distinct Context identity — `useContext` lookups across copies would miss
 * and `<DataGrid>`'s consumers would crash with the classic
 * `TypeError: g is not a function` inside React's reconciler.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const SHARED_STORE_KEY = Symbol.for('@toolbox-web/grid/shared');

describe('grid-react cross-module-instance context sharing', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[SHARED_STORE_KEY];
    vi.resetModules();
  });

  it('GridElementContext identity is shared across module copies', async () => {
    const copyA = await import('./grid-element-context');
    vi.resetModules();
    const copyB = await import('./grid-element-context');

    expect(copyB.GridElementContext).toBe(copyA.GridElementContext);
  });

  it('GridIconContext identity is shared across module copies', async () => {
    const copyA = await import('./grid-icon-registry');
    vi.resetModules();
    const copyB = await import('./grid-icon-registry');

    expect(copyB.GridIconContext).toBe(copyA.GridIconContext);
  });
});

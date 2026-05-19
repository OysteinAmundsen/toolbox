/**
 * Cross-module-instance InjectionToken sharing test for grid-angular.
 *
 * Simulates two bundled copies of `@toolbox-web/grid-angular` co-existing on
 * one page (micro-frontend scenario, issue #338). Without the shared-store
 * indirection, each copy would call `new InjectionToken(...)` and DI lookups
 * across copies would miss — `inject(GRID_ICONS)` would throw
 * `NullInjectorError` (or, with `{ optional: true }`, silently return `null`).
 */

import '@angular/compiler';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SHARED_STORE_KEY = Symbol.for('@toolbox-web/grid/shared');

describe('grid-angular cross-module-instance injection-token sharing', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, unknown>)[SHARED_STORE_KEY];
    vi.resetModules();
  });

  it('GRID_ICONS token is shared across module copies', async () => {
    const copyA = await import('./grid-icon-registry');
    vi.resetModules();
    const copyB = await import('./grid-icon-registry');

    expect(copyB.GRID_ICONS).toBe(copyA.GRID_ICONS);
  });

  it('GRID_TYPE_DEFAULTS token is shared across module copies', async () => {
    const copyA = await import('./grid-type-registry');
    vi.resetModules();
    const copyB = await import('./grid-type-registry');

    expect(copyB.GRID_TYPE_DEFAULTS).toBe(copyA.GRID_TYPE_DEFAULTS);
  });

  it('GRID_CELL_EDITOR token is shared across module copies', async () => {
    const copyA = await import('./interfaces/grid-cell-editor');
    vi.resetModules();
    const copyB = await import('./interfaces/grid-cell-editor');

    expect(copyB.GRID_CELL_EDITOR).toBe(copyA.GRID_CELL_EDITOR);
  });

  it('GRID_CELL_RENDERER token is shared across module copies', async () => {
    const copyA = await import('./interfaces/grid-cell-renderer');
    vi.resetModules();
    const copyB = await import('./interfaces/grid-cell-renderer');

    expect(copyB.GRID_CELL_RENDERER).toBe(copyA.GRID_CELL_RENDERER);
  });
});

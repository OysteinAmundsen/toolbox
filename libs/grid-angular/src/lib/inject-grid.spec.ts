/**
 * Tests for the `injectGrid` helper.
 *
 * Mocks Angular's `inject` and `afterNextRender` primitives so the function
 * can be exercised outside an Angular injection context. Real `signal` /
 * `computed` are kept (they work standalone).
 *
 * @vitest-environment happy-dom
 */
import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let injectResolver: (token: unknown) => unknown = () => undefined;
let pendingAfterNextRender: (() => void) | null = null;

vi.mock('@angular/core', async () => {
  const actual = await vi.importActual<typeof import('@angular/core')>('@angular/core');
  return {
    ...actual,
    inject: (token: unknown) => injectResolver(token),
    afterNextRender: (cb: () => void) => {
      pendingAfterNextRender = cb;
    },
  };
});

import { DestroyRef, ElementRef } from '@angular/core';
import { injectGrid } from './inject-grid';

interface MockGrid extends HTMLElement {
  ready: ReturnType<typeof vi.fn>;
  getConfig: ReturnType<typeof vi.fn>;
  forceLayout: ReturnType<typeof vi.fn>;
  toggleGroup: ReturnType<typeof vi.fn>;
  registerStyles: ReturnType<typeof vi.fn>;
  unregisterStyles: ReturnType<typeof vi.fn>;
  getPlugin: ReturnType<typeof vi.fn>;
  getPluginByName: ReturnType<typeof vi.fn>;
}

function createMockGrid(overrides: Partial<MockGrid> = {}): MockGrid {
  const grid = document.createElement('tbw-grid') as unknown as MockGrid;
  grid.ready = vi.fn(() => Promise.resolve());
  grid.getConfig = vi.fn(() => ({ columns: [{ field: 'a' }, { field: 'b', hidden: true }] }));
  grid.forceLayout = vi.fn(() => Promise.resolve());
  grid.toggleGroup = vi.fn(() => Promise.resolve());
  grid.registerStyles = vi.fn();
  grid.unregisterStyles = vi.fn();
  grid.getPlugin = vi.fn(() => ({ kind: 'plugin' }));
  grid.getPluginByName = vi.fn(() => ({ kind: 'plugin-by-name' }));
  Object.assign(grid, overrides);
  return grid;
}

function createHost(grid?: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  if (grid) host.appendChild(grid);
  return host;
}

function setup(host: HTMLElement, destroyCallbacks: Array<() => void> = []) {
  const elementRef = { nativeElement: host } as ElementRef<HTMLElement>;
  const destroyRef = {
    onDestroy: (cb: () => void) => {
      destroyCallbacks.push(cb);
      return () => undefined;
    },
  } as unknown as DestroyRef;

  injectResolver = (token: unknown) => {
    if (token === ElementRef) return elementRef;
    if (token === DestroyRef) return destroyRef;
    return undefined;
  };
}

beforeEach(() => {
  pendingAfterNextRender = null;
  document.body.innerHTML = '';
});

afterEach(() => {
  injectResolver = () => undefined;
  pendingAfterNextRender = null;
});

describe('injectGrid: initialisation', () => {
  it('returns the documented signal-based API surface', () => {
    setup(createHost());
    const api = injectGrid();
    expect(typeof api.element).toBe('function');
    expect(typeof api.isReady).toBe('function');
    expect(typeof api.config).toBe('function');
    expect(typeof api.visibleColumns).toBe('function');
    expect(typeof api.getConfig).toBe('function');
    expect(typeof api.forceLayout).toBe('function');
    expect(typeof api.toggleGroup).toBe('function');
    expect(typeof api.registerStyles).toBe('function');
    expect(typeof api.unregisterStyles).toBe('function');
    expect(typeof api.getPlugin).toBe('function');
    expect(typeof api.getPluginByName).toBe('function');
  });

  it('starts with empty signals before afterNextRender fires', () => {
    setup(createHost());
    const api = injectGrid();
    expect(api.element()).toBeNull();
    expect(api.isReady()).toBe(false);
    expect(api.config()).toBeNull();
    expect(api.visibleColumns()).toEqual([]);
  });

  it('warns and bails when no grid element is found in the host', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setup(createHost());
    const api = injectGrid();

    pendingAfterNextRender?.();

    expect(warnSpy).toHaveBeenCalledWith('[injectGrid] No tbw-grid element found in component');
    expect(api.element()).toBeNull();
    warnSpy.mockRestore();
  });

  it('honors a custom selector when present in the host', () => {
    const grid = createMockGrid();
    grid.classList.add('primary');
    setup(createHost(grid));
    const api = injectGrid('tbw-grid.primary');

    pendingAfterNextRender?.();
    expect(api.element()).toBe(grid);
  });
});

describe('injectGrid: ready/config flow', () => {
  it('sets isReady and config after the grid resolves ready()', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();

    pendingAfterNextRender?.();
    // Flush microtasks for ready().then chain
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.element()).toBe(grid);
    expect(api.isReady()).toBe(true);
    expect(api.config()).toEqual({ columns: [{ field: 'a' }, { field: 'b', hidden: true }] });
  });

  it('exposes visibleColumns excluding hidden columns', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();

    pendingAfterNextRender?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.visibleColumns()).toEqual([{ field: 'a' }]);
  });

  it('does not throw when grid.ready is missing', async () => {
    const grid = createMockGrid();
    grid.ready = undefined as never;
    setup(createHost(grid));
    const api = injectGrid();

    pendingAfterNextRender?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.isReady()).toBe(true);
  });

  it('logs but does not throw when ready() rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const grid = createMockGrid();
    grid.ready = vi.fn(() => Promise.reject(new Error('boom')));
    setup(createHost(grid));
    injectGrid();

    pendingAfterNextRender?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith('[injectGrid] Error waiting for grid to be ready:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('aborts setting signals when destroy fires before ready resolves', async () => {
    const destroyCallbacks: Array<() => void> = [];
    let resolveReady!: () => void;
    const grid = createMockGrid();
    grid.ready = vi.fn(() => new Promise<void>((r) => (resolveReady = r)));
    setup(createHost(grid), destroyCallbacks);
    const api = injectGrid();

    pendingAfterNextRender?.();
    // Trigger destruction before the ready promise resolves
    destroyCallbacks.forEach((cb) => cb());
    resolveReady();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.isReady()).toBe(false);
    expect(api.config()).toBeNull();
  });
});

describe('injectGrid: method delegation', () => {
  async function ready() {
    pendingAfterNextRender?.();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('delegates getConfig to the underlying element', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();
    await ready();

    const cfg = await api.getConfig();
    expect(cfg).toEqual({ columns: [{ field: 'a' }, { field: 'b', hidden: true }] });
    expect(grid.getConfig).toHaveBeenCalled();
  });

  it('returns null from getConfig when no element is bound', async () => {
    setup(createHost());
    const api = injectGrid();
    pendingAfterNextRender?.();
    await Promise.resolve();
    expect(await api.getConfig()).toBeNull();
  });

  it('delegates forceLayout to the underlying element', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();
    await ready();

    await api.forceLayout();
    expect(grid.forceLayout).toHaveBeenCalled();
  });

  it('forceLayout is a no-op when no element is bound', async () => {
    setup(createHost());
    const api = injectGrid();
    pendingAfterNextRender?.();
    await expect(api.forceLayout()).resolves.toBeUndefined();
  });

  it('delegates toggleGroup with the supplied key', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();
    await ready();

    await api.toggleGroup('region:north');
    expect(grid.toggleGroup).toHaveBeenCalledWith('region:north');
  });

  it('toggleGroup is a no-op when no element is bound', async () => {
    setup(createHost());
    const api = injectGrid();
    pendingAfterNextRender?.();
    await expect(api.toggleGroup('x')).resolves.toBeUndefined();
  });

  it('delegates registerStyles / unregisterStyles', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();
    await ready();

    api.registerStyles('id-1', '.x { color: red }');
    api.unregisterStyles('id-1');
    expect(grid.registerStyles).toHaveBeenCalledWith('id-1', '.x { color: red }');
    expect(grid.unregisterStyles).toHaveBeenCalledWith('id-1');
  });

  it('delegates getPlugin / getPluginByName', async () => {
    const grid = createMockGrid();
    setup(createHost(grid));
    const api = injectGrid();
    await ready();

    class FakePlugin {}
    expect(api.getPlugin(FakePlugin)).toEqual({ kind: 'plugin' });
    expect(grid.getPlugin).toHaveBeenCalledWith(FakePlugin);

    expect(api.getPluginByName('tooltip')).toEqual({ kind: 'plugin-by-name' });
    expect(grid.getPluginByName).toHaveBeenCalledWith('tooltip');
  });

  it('plugin lookups return undefined when no element is bound', () => {
    setup(createHost());
    const api = injectGrid();
    class FakePlugin {}
    expect(api.getPlugin(FakePlugin)).toBeUndefined();
    expect(api.getPluginByName('tooltip')).toBeUndefined();
  });
});

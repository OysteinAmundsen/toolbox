/**
 * Tests for `@toolbox-web/grid-vue/features/selection`.
 *
 * Also pins the reactive `selection` / `selectedRowIndices` / `selectedRows`
 * refs that mirror the Angular adapter's selection signals.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref, type App } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { useGridSelection, type SelectionMethods } from './selection';

function makeStubPlugin(mode: 'row' | 'range' = 'row') {
  return {
    name: 'selection' as const,
    config: { mode },
    selected: new Set<number>(),
    requestAfterRender: vi.fn(),
    clearSelection: vi.fn(),
    getSelection: vi.fn().mockReturnValue({ ranges: [], rows: [] }),
    isCellSelected: vi.fn().mockReturnValue(true),
    setRanges: vi.fn(),
    getSelectedRowIndices: vi.fn().mockReturnValue([0, 2]),
    getSelectedRows: vi.fn().mockReturnValue([{ id: 1 }, { id: 3 }]),
  };
}

type Listener = (detail: unknown) => void;

function makeGridEl(plugin: ReturnType<typeof makeStubPlugin> | undefined, id?: string) {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  const listeners = new Map<string, Listener[]>();
  Object.assign(grid, {
    rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
    _columns: [{ field: 'id' }, { field: 'name' }],
    getPluginByName: (name: string) => (name === 'selection' ? plugin : undefined),
    ready: () => Promise.resolve(),
    on: (type: string, listener: Listener) => {
      const existing = listeners.get(type) ?? [];
      listeners.set(type, [...existing, listener]);
      return () => listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== listener));
    },
  });
  document.body.appendChild(grid);
  return {
    grid,
    emit: (type: string, detail: unknown) => (listeners.get(type) ?? []).forEach((l) => l(detail)),
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
  };
}

function mountComposable(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: SelectionMethods<{ id: number }> | null } = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);

  const Inner = defineComponent({
    setup() {
      captured.current = useGridSelection<{ id: number }>(selector);
      return () => null;
    },
  });

  const Root = defineComponent({
    setup() {
      provide(GRID_ELEMENT_KEY, ref(gridEl ?? null));
      return () => h(Inner);
    },
  });

  const app: App = createApp(Root);
  app.mount(host);

  return {
    api: () => captured.current!,
    cleanup: () => {
      app.unmount();
      host.remove();
    },
  };
}

describe('@toolbox-web/grid-vue/features/selection', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('delegates the read methods to the plugin', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin).grid);

    expect(api().getSelection()).toEqual({ ranges: [], rows: [] });
    expect(api().isCellSelected(0, 0)).toBe(true);
    expect(api().getSelectedRows()).toEqual([{ id: 1 }, { id: 3 }]);

    api().clearSelection();
    expect(plugin.clearSelection).toHaveBeenCalled();

    api().setRanges([{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } }]);
    expect(plugin.setRanges).toHaveBeenCalledWith([{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } }]);

    cleanup();
  });

  it('selectAll fills every row index in row mode', () => {
    const plugin = makeStubPlugin('row');
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin).grid);

    api().selectAll();

    expect([...plugin.selected]).toEqual([0, 1, 2]);
    expect(plugin.requestAfterRender).toHaveBeenCalled();

    cleanup();
  });

  it('selectAll spans the full grid as one range in range mode', () => {
    const plugin = makeStubPlugin('range');
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin).grid);

    api().selectAll();

    expect(plugin.setRanges).toHaveBeenCalledWith([{ from: { row: 0, col: 0 }, to: { row: 2, col: 1 } }]);

    cleanup();
  });

  it('syncs the reactive refs from selection-change events', async () => {
    const plugin = makeStubPlugin('row');
    const { grid, emit } = makeGridEl(plugin);
    const { api, cleanup } = mountComposable(undefined, grid);

    expect(api().selectedRows.value).toEqual([]);

    emit('selection-change', { mode: 'row' });

    expect(api().selection.value).toEqual({ ranges: [], rows: [] });
    expect(api().selectedRowIndices.value).toEqual([0, 2]);
    expect(api().selectedRows.value).toEqual([{ id: 1 }, { id: 3 }]);

    cleanup();
  });

  it('leaves selectedRowIndices empty when the mode is not row', () => {
    const plugin = makeStubPlugin('range');
    const { grid, emit } = makeGridEl(plugin);
    const { api, cleanup } = mountComposable(undefined, grid);

    emit('selection-change', { mode: 'range' });
    expect(api().selectedRowIndices.value).toEqual([]);

    cleanup();
  });

  it('treats an array mode containing "row" as row mode', () => {
    const plugin = makeStubPlugin('row');
    const { grid, emit } = makeGridEl(plugin);
    const { api, cleanup } = mountComposable(undefined, grid);

    emit('selection-change', { mode: ['row', 'range'] });
    expect(api().selectedRowIndices.value).toEqual([0, 2]);

    cleanup();
  });

  it('unsubscribes from selection-change on unmount', () => {
    const plugin = makeStubPlugin();
    const { grid, listenerCount } = makeGridEl(plugin);
    const { cleanup } = mountComposable(undefined, grid);

    expect(listenerCount('selection-change')).toBe(1);
    cleanup();
    expect(listenerCount('selection-change')).toBe(0);
  });

  it('resolves the grid through an explicit selector', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'sel-grid');
    const { api, cleanup } = mountComposable('#sel-grid', null);

    expect(api().isCellSelected(0, 0)).toBe(true);

    cleanup();
  });

  it('warns on selectAll and returns safe defaults when the plugin is absent', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined).grid);

    api().selectAll();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SelectionPlugin not found'));

    expect(api().getSelection()).toBeNull();
    expect(api().isCellSelected(0, 0)).toBe(false);
    expect(api().getSelectedRows()).toEqual([]);
    api().clearSelection();
    api().setRanges([]);

    cleanup();
  });

  it('exposes isReady as false before the grid resolves', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined).grid);
    expect(api().isReady.value).toBe(false);
    cleanup();
  });
});

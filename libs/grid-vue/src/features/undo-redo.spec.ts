/**
 * Tests for `@toolbox-web/grid-vue/features/undo-redo`.
 *
 * Also pins the `historyVersion` reactivity added so `canUndo()` / `canRedo()`
 * re-evaluate in templates like the Angular adapter's signals.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, createApp, defineComponent, h, provide, ref, type App } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { useGridUndoRedo, type UndoRedoMethods } from './undo-redo';

function makeStubPlugin() {
  return {
    name: 'undoRedo' as const,
    undo: vi.fn().mockReturnValue({ rowIndex: 1, field: 'name' }),
    redo: vi.fn().mockReturnValue({ rowIndex: 2, field: 'age' }),
    canUndo: vi.fn().mockReturnValue(true),
    canRedo: vi.fn().mockReturnValue(true),
    clearHistory: vi.fn(),
    getUndoStack: vi.fn().mockReturnValue([{ rowIndex: 1 }]),
    getRedoStack: vi.fn().mockReturnValue([{ rowIndex: 2 }]),
    recordEdit: vi.fn(),
    beginTransaction: vi.fn(),
    endTransaction: vi.fn(),
  };
}

type Listener = (detail: unknown) => void;

function makeGridEl(plugin: ReturnType<typeof makeStubPlugin> | undefined, id?: string) {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  const listeners = new Map<string, Listener[]>();
  Object.assign(grid, {
    getPluginByName: (name: string) => (name === 'undoRedo' ? plugin : undefined),
    on: (type: string, listener: Listener) => {
      const existing = listeners.get(type) ?? [];
      listeners.set(type, [...existing, listener]);
      return () => listeners.set(type, (listeners.get(type) ?? []).filter((l) => l !== listener));
    },
  });
  document.body.appendChild(grid);
  return {
    grid,
    emit: (type: string) => (listeners.get(type) ?? []).forEach((l) => l(undefined)),
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
  };
}

function mountComposable(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: UndoRedoMethods | null } = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);

  const Inner = defineComponent({
    setup() {
      captured.current = useGridUndoRedo(selector);
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

describe('@toolbox-web/grid-vue/features/undo-redo', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('delegates every command to the plugin', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin).grid);

    expect(api().undo()).toEqual({ rowIndex: 1, field: 'name' });
    expect(api().redo()).toEqual({ rowIndex: 2, field: 'age' });
    expect(api().canUndo()).toBe(true);
    expect(api().canRedo()).toBe(true);
    expect(api().getUndoStack()).toEqual([{ rowIndex: 1 }]);
    expect(api().getRedoStack()).toEqual([{ rowIndex: 2 }]);

    api().clearHistory();
    expect(plugin.clearHistory).toHaveBeenCalled();

    api().recordEdit(3, 'name', 'a', 'b');
    expect(plugin.recordEdit).toHaveBeenCalledWith(3, 'name', 'a', 'b');

    api().beginTransaction();
    expect(plugin.beginTransaction).toHaveBeenCalled();

    api().endTransaction();
    expect(plugin.endTransaction).toHaveBeenCalled();

    cleanup();
  });

  it('resolves the grid through an explicit selector', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'undo-grid');
    const { api, cleanup } = mountComposable('#undo-grid', null);

    expect(api().canUndo()).toBe(true);

    cleanup();
  });

  it('warns and no-ops for every command when the plugin is absent', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined).grid);

    expect(api().undo()).toBeNull();
    expect(api().redo()).toBeNull();
    api().clearHistory();
    api().recordEdit(0, 'name', 'a', 'b');
    api().beginTransaction();
    api().endTransaction();

    expect(warnSpy).toHaveBeenCalledTimes(6);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('UndoRedoPlugin not found'));

    cleanup();
  });

  it('returns safe defaults for readers when the plugin is absent', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined).grid);

    expect(api().canUndo()).toBe(false);
    expect(api().canRedo()).toBe(false);
    expect(api().getUndoStack()).toEqual([]);
    expect(api().getRedoStack()).toEqual([]);

    cleanup();
  });

  it('re-evaluates canUndo in a computed when history events fire', () => {
    const plugin = makeStubPlugin();
    plugin.canUndo.mockReturnValue(false);
    const { grid, emit } = makeGridEl(plugin);
    const { api, cleanup } = mountComposable(undefined, grid);

    const canUndo = computed(() => api().canUndo());
    expect(canUndo.value).toBe(false);

    plugin.canUndo.mockReturnValue(true);
    // Without the history subscription the computed would stay cached at false.
    emit('undo');
    expect(canUndo.value).toBe(true);

    cleanup();
  });

  it('unsubscribes from history events on unmount', () => {
    const plugin = makeStubPlugin();
    const { grid, listenerCount } = makeGridEl(plugin);
    const { cleanup } = mountComposable(undefined, grid);

    expect(listenerCount('undo')).toBe(1);
    cleanup();
    expect(listenerCount('undo')).toBe(0);
  });

  it('exposes isReady as false before the grid resolves', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined).grid);
    expect(api().isReady.value).toBe(false);
    cleanup();
  });
});

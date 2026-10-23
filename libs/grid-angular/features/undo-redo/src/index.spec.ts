/**
 * Tests for injectGridUndoRedo — lazy grid discovery, signal sync, plugin delegation,
 * missing-plugin warnings, and recordEdit's optional rowId forwarding (#526).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockElementRef = { nativeElement: document.createElement('div') };
const destroyCallbacks: Array<() => void> = [];
const mockDestroyRef = { onDestroy: vi.fn((cb: () => void) => destroyCallbacks.push(cb)) };
const afterNextRenderCallbacks: Array<() => void> = [];

vi.mock('@angular/core', () => ({
  ElementRef: { name: 'ElementRef' },
  DestroyRef: { name: 'DestroyRef' },
  inject: vi.fn((token: { name?: string }) => (token?.name === 'ElementRef' ? mockElementRef : mockDestroyRef)),
  signal: <T>(initial: T) => {
    let value = initial;
    const sig = Object.assign(() => value, {
      set: (next: T) => {
        value = next;
      },
      asReadonly: () => sig,
    });
    return sig;
  },
  afterNextRender: vi.fn((cb: () => void) => afterNextRenderCallbacks.push(cb)),
}));
vi.mock('@toolbox-web/grid/features/undo-redo', () => ({}));
vi.mock('@toolbox-web/grid/plugins/undo-redo', () => ({ UndoRedoPlugin: class UndoRedoPlugin {} }));
vi.mock('./grid-undo-redo.directive', () => ({ GridUndoRedoDirective: class GridUndoRedoDirective {} }));

const { injectGridUndoRedo } = await import('./index.js');

type Listener = () => void;

function createPlugin() {
  return {
    undo: vi.fn().mockReturnValue({ type: 'cell-edit' }),
    redo: vi.fn().mockReturnValue({ type: 'cell-edit' }),
    clearHistory: vi.fn(),
    getUndoStack: vi.fn().mockReturnValue([{ type: 'cell-edit' }]),
    getRedoStack: vi.fn().mockReturnValue([]),
    recordEdit: vi.fn(),
    beginTransaction: vi.fn(),
    endTransaction: vi.fn(),
    canUndo: vi.fn().mockReturnValue(true),
    canRedo: vi.fn().mockReturnValue(false),
  };
}

function createGrid(plugin: ReturnType<typeof createPlugin> | undefined, opts: { withReady?: boolean } = {}) {
  const listeners = new Map<string, Listener>();
  const unsubs: Array<ReturnType<typeof vi.fn>> = [];
  const grid = document.createElement('tbw-grid');
  Object.assign(grid, {
    getPluginByName: vi.fn((name: string) => (name === 'undoRedo' ? plugin : undefined)),
    on: vi.fn((event: string, cb: Listener) => {
      listeners.set(event, cb);
      const unsub = vi.fn();
      unsubs.push(unsub);
      return unsub;
    }),
  });
  if (opts.withReady !== false) {
    Object.assign(grid, { ready: vi.fn(() => Promise.resolve()) });
  }
  return { grid, listeners, unsubs };
}

function mountHost(grid?: HTMLElement): HTMLElement {
  const host = document.createElement('div');
  if (grid) host.appendChild(grid);
  document.body.appendChild(host);
  mockElementRef.nativeElement = host;
  return host;
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('injectGridUndoRedo', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    destroyCallbacks.length = 0;
    afterNextRenderCallbacks.length = 0;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  describe('with the plugin present', () => {
    it('recordEdit forwards rowId (undefined when omitted) and syncs signals', () => {
      const plugin = createPlugin();
      mountHost(createGrid(plugin).grid);
      const api = injectGridUndoRedo();

      api.recordEdit(2, 'name', 'a', 'b');
      expect(plugin.recordEdit).toHaveBeenCalledWith(2, 'name', 'a', 'b', undefined);

      api.recordEdit(-1, 'name', 'a', 'b', 'row-7');
      expect(plugin.recordEdit).toHaveBeenLastCalledWith(-1, 'name', 'a', 'b', 'row-7');
      expect(api.canUndo()).toBe(true);
      expect(api.canRedo()).toBe(false);
    });

    it('undo/redo delegate to the plugin, return its result, and sync signals', () => {
      const plugin = createPlugin();
      mountHost(createGrid(plugin).grid);
      const api = injectGridUndoRedo();

      expect(api.undo()).toEqual({ type: 'cell-edit' });
      expect(plugin.undo).toHaveBeenCalledOnce();

      plugin.canUndo.mockReturnValue(false);
      plugin.canRedo.mockReturnValue(true);
      expect(api.redo()).toEqual({ type: 'cell-edit' });
      expect(plugin.redo).toHaveBeenCalledOnce();
      expect(api.canUndo()).toBe(false);
      expect(api.canRedo()).toBe(true);
    });

    it('clearHistory, transactions and stack getters delegate to the plugin', () => {
      const plugin = createPlugin();
      mountHost(createGrid(plugin).grid);
      const api = injectGridUndoRedo();

      api.clearHistory();
      api.beginTransaction();
      api.endTransaction();

      expect(plugin.clearHistory).toHaveBeenCalledOnce();
      expect(plugin.beginTransaction).toHaveBeenCalledOnce();
      expect(plugin.endTransaction).toHaveBeenCalledOnce();
      expect(api.getUndoStack()).toEqual([{ type: 'cell-edit' }]);
      expect(api.getRedoStack()).toEqual([]);
    });

    it('honours a custom selector', () => {
      const plugin = createPlugin();
      const host = mountHost(createGrid(undefined).grid);
      const { grid: target } = createGrid(plugin);
      target.id = 'secondary';
      host.appendChild(target);

      const api = injectGridUndoRedo('#secondary');
      api.undo();

      expect(plugin.undo).toHaveBeenCalledOnce();
    });

    it('caches the grid and attaches the history-change listener once', () => {
      const plugin = createPlugin();
      const { grid, listeners, unsubs } = createGrid(plugin);
      const host = mountHost(grid);
      const querySpy = vi.spyOn(host, 'querySelector');
      const api = injectGridUndoRedo();

      api.getUndoStack();
      api.getRedoStack();

      expect(querySpy).toHaveBeenCalledOnce();
      expect(unsubs).toHaveLength(1);
      expect([...listeners.keys()]).toEqual(['history-change']);
    });

    // #563 — the plugin emits `history-change` on every stack mutation (incl. clearHistory / recordEdit)
    it('a grid history-change event re-syncs the signals', () => {
      const plugin = createPlugin();
      const { grid, listeners } = createGrid(plugin);
      mountHost(grid);
      const api = injectGridUndoRedo();
      api.getUndoStack();

      plugin.canUndo.mockReturnValue(false);
      plugin.canRedo.mockReturnValue(true);
      listeners.get('history-change')?.();

      expect(api.canUndo()).toBe(false);
      expect(api.canRedo()).toBe(true);
    });

    it('unsubscribes grid listeners on destroy', () => {
      const { grid, unsubs } = createGrid(createPlugin());
      mountHost(grid);
      injectGridUndoRedo().getUndoStack();

      destroyCallbacks.forEach((cb) => cb());

      expect(unsubs).toHaveLength(1);
      unsubs.forEach((unsub) => expect(unsub).toHaveBeenCalledOnce());
    });

    it('sets isReady immediately after grid.ready() when the plugin exists', async () => {
      mountHost(createGrid(createPlugin()).grid);
      const api = injectGridUndoRedo();
      expect(api.isReady()).toBe(false);

      api.getUndoStack();
      await Promise.resolve();

      expect(api.isReady()).toBe(true);
    });
  });

  describe('without the plugin', () => {
    it('undo/redo warn and return null', () => {
      mountHost(createGrid(undefined).grid);
      const api = injectGridUndoRedo();

      expect(api.undo()).toBeNull();
      expect(api.redo()).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(warnSpy.mock.calls[0][0]).toContain('UndoRedoPlugin not found');
    });

    it('clearHistory, recordEdit and transactions warn and no-op', () => {
      mountHost(createGrid(undefined).grid);
      const api = injectGridUndoRedo();

      api.clearHistory();
      api.recordEdit(0, 'name', 'a', 'b');
      api.beginTransaction();
      api.endTransaction();

      expect(warnSpy).toHaveBeenCalledTimes(4);
      expect(api.canUndo()).toBe(false);
    });

    it('stack getters return empty arrays when no grid is found', () => {
      mountHost();
      const api = injectGridUndoRedo();

      expect(api.getUndoStack()).toEqual([]);
      expect(api.getRedoStack()).toEqual([]);
    });

    it('defers isReady to a macrotask when the plugin is not yet registered', async () => {
      mountHost(createGrid(undefined).grid);
      const api = injectGridUndoRedo();

      api.getUndoStack();
      await Promise.resolve();
      expect(api.isReady()).toBe(false);

      await flush();
      expect(api.isReady()).toBe(true);
    });

    it('tolerates grids without a ready() method', () => {
      mountHost(createGrid(undefined, { withReady: false }).grid);
      const api = injectGridUndoRedo();

      expect(() => api.getUndoStack()).not.toThrow();
      expect(api.isReady()).toBe(false);
    });
  });

  describe('afterNextRender discovery', () => {
    it('syncs signals once the grid is ready when the grid is already rendered', async () => {
      const plugin = createPlugin();
      mountHost(createGrid(plugin).grid);
      const api = injectGridUndoRedo();

      afterNextRenderCallbacks[0]();
      await Promise.resolve();
      await Promise.resolve();

      expect(api.canUndo()).toBe(true);
    });

    it('defers the sync when the plugin is registered after ready()', async () => {
      const plugin = createPlugin();
      const { grid } = createGrid(undefined);
      mountHost(grid);
      const api = injectGridUndoRedo();

      afterNextRenderCallbacks[0]();
      await Promise.resolve();
      (grid as unknown as { getPluginByName: ReturnType<typeof vi.fn> }).getPluginByName.mockImplementation(
        (name: string) => (name === 'undoRedo' ? plugin : undefined),
      );
      expect(api.canUndo()).toBe(false);

      await flush();
      expect(api.canUndo()).toBe(true);
    });

    it('skips the ready() wait for grids without a ready() method', () => {
      mountHost(createGrid(createPlugin(), { withReady: false }).grid);
      injectGridUndoRedo();

      expect(() => afterNextRenderCallbacks[0]()).not.toThrow();
    });

    it('observes the host for a lazily rendered grid and disconnects once found', async () => {
      const plugin = createPlugin();
      const host = mountHost();
      const api = injectGridUndoRedo();

      afterNextRenderCallbacks[0]();
      host.appendChild(document.createElement('span'));
      await flush();
      expect(api.canUndo()).toBe(false);

      host.appendChild(createGrid(plugin).grid);
      await flush();
      await flush();
      expect(api.canUndo()).toBe(true);

      // Disconnected: later mutations do not trigger another discovery
      plugin.canUndo.mockClear();
      host.appendChild(document.createElement('span'));
      await flush();
      expect(plugin.canUndo).not.toHaveBeenCalled();
    });

    it('defers the sync for a lazily rendered grid whose plugin registers late', async () => {
      const plugin = createPlugin();
      const host = mountHost();
      const api = injectGridUndoRedo();
      afterNextRenderCallbacks[0]();

      const { grid } = createGrid(undefined);
      host.appendChild(grid);
      await flush();
      (grid as unknown as { getPluginByName: ReturnType<typeof vi.fn> }).getPluginByName.mockImplementation(
        (name: string) => (name === 'undoRedo' ? plugin : undefined),
      );
      await flush();

      expect(api.canUndo()).toBe(true);
    });

    it('disconnects the observer on destroy', async () => {
      const host = mountHost();
      const api = injectGridUndoRedo();
      afterNextRenderCallbacks[0]();

      destroyCallbacks.forEach((cb) => cb());
      const plugin = createPlugin();
      host.appendChild(createGrid(plugin).grid);
      await flush();

      expect(plugin.canUndo).not.toHaveBeenCalled();
      expect(api.canUndo()).toBe(false);
    });
  });
});

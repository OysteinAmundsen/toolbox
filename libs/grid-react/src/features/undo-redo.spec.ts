/**
 * Tests for `@toolbox-web/grid-react/features/undo-redo`.
 *
 * Covers the `useGridUndoRedo` hook's plugin discovery, delegation to
 * `UndoRedoPlugin`, and the warn-and-no-op fallbacks when the plugin is absent.
 *
 * @vitest-environment jsdom
 */
import { createElement, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridElementContext } from '../lib/grid-element-context';
import { useGridUndoRedo, type UndoRedoMethods } from './undo-redo';

const ACTION = { type: 'edit', rowIndex: 0, field: 'name', oldValue: 'a', newValue: 'b' };

interface StubUndoRedoPlugin {
  name: 'undoRedo';
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  canUndo: ReturnType<typeof vi.fn>;
  canRedo: ReturnType<typeof vi.fn>;
  clearHistory: ReturnType<typeof vi.fn>;
  getUndoStack: ReturnType<typeof vi.fn>;
  getRedoStack: ReturnType<typeof vi.fn>;
  recordEdit: ReturnType<typeof vi.fn>;
  beginTransaction: ReturnType<typeof vi.fn>;
  endTransaction: ReturnType<typeof vi.fn>;
}

function makeStubPlugin(): StubUndoRedoPlugin {
  return {
    name: 'undoRedo',
    undo: vi.fn().mockReturnValue(ACTION),
    redo: vi.fn().mockReturnValue(ACTION),
    canUndo: vi.fn().mockReturnValue(true),
    canRedo: vi.fn().mockReturnValue(false),
    clearHistory: vi.fn(),
    getUndoStack: vi.fn().mockReturnValue([ACTION]),
    getRedoStack: vi.fn().mockReturnValue([]),
    recordEdit: vi.fn(),
    beginTransaction: vi.fn(),
    endTransaction: vi.fn(),
  };
}

function makeGridEl(plugin: StubUndoRedoPlugin | undefined, id?: string): HTMLElement {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  (grid as unknown as { getPluginByName: (name: string) => unknown }).getPluginByName = (name: string) =>
    name === 'undoRedo' ? plugin : undefined;
  document.body.appendChild(grid);
  return grid;
}

function renderHook(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: UndoRedoMethods | null } = { current: null };
  const container = document.createElement('div');
  document.body.appendChild(container);

  function TestComponent() {
    const ref = useRef(gridEl ?? null);
    return createElement(
      GridElementContext.Provider,
      { value: ref as React.RefObject<HTMLElement | null> },
      createElement(Inner),
    );
  }
  function Inner() {
    captured.current = useGridUndoRedo(selector);
    return null;
  }

  const root = createRoot(container);
  flushSync(() => root.render(createElement(TestComponent)));

  return {
    api: () => captured.current!,
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

describe('@toolbox-web/grid-react/features/undo-redo', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('delegates undo/redo and returns the plugin action', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin));

    expect(api().undo()).toBe(ACTION);
    expect(api().redo()).toBe(ACTION);
    expect(plugin.undo).toHaveBeenCalled();
    expect(plugin.redo).toHaveBeenCalled();
    cleanup();
  });

  it('delegates the query, history and transaction methods', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin));

    expect(api().canUndo()).toBe(true);
    expect(api().canRedo()).toBe(false);
    expect(api().getUndoStack()).toEqual([ACTION]);
    expect(api().getRedoStack()).toEqual([]);

    api().clearHistory();
    expect(plugin.clearHistory).toHaveBeenCalled();

    api().recordEdit(2, 'name', 'a', 'b');
    expect(plugin.recordEdit).toHaveBeenCalledWith(2, 'name', 'a', 'b');

    api().beginTransaction();
    api().endTransaction();
    expect(plugin.beginTransaction).toHaveBeenCalled();
    expect(plugin.endTransaction).toHaveBeenCalled();
    cleanup();
  });

  it('resolves the plugin through an explicit selector', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'ur-grid');
    const { api, cleanup } = renderHook('#ur-grid', null);

    api().undo();

    expect(plugin.undo).toHaveBeenCalled();
    cleanup();
  });

  it('warns and returns safe defaults when the plugin is missing', () => {
    const { api, cleanup } = renderHook(undefined, makeGridEl(undefined));

    expect(api().undo()).toBeNull();
    expect(api().redo()).toBeNull();
    expect(api().canUndo()).toBe(false);
    expect(api().canRedo()).toBe(false);
    expect(api().getUndoStack()).toEqual([]);
    expect(api().getRedoStack()).toEqual([]);
    expect(() => api().clearHistory()).not.toThrow();
    expect(() => api().recordEdit(0, 'f', 1, 2)).not.toThrow();
    expect(() => api().beginTransaction()).not.toThrow();
    expect(() => api().endTransaction()).not.toThrow();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('UndoRedoPlugin not found'));
    cleanup();
  });
});

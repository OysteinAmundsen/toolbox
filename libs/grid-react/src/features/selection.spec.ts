/**
 * Tests for `@toolbox-web/grid-react/features/selection`.
 *
 * Covers the `useGridSelection` hook's plugin discovery, delegation to
 * `SelectionPlugin`, the mode-dependent `selectAll` behaviour, and the safe
 * fallbacks when the plugin is absent.
 *
 * @vitest-environment jsdom
 */
import { createElement, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridElementContext } from '../lib/grid-element-context';
import { useGridSelection, type SelectionMethods } from './selection';

interface StubSelectionPlugin {
  name: 'selection';
  config: { mode: 'row' | 'range' | 'cell' };
  selected?: Set<number>;
  requestAfterRender: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  getSelection: ReturnType<typeof vi.fn>;
  isCellSelected: ReturnType<typeof vi.fn>;
  setRanges: ReturnType<typeof vi.fn>;
  getSelectedRows: ReturnType<typeof vi.fn>;
}

function makeStubPlugin(mode: 'row' | 'range' | 'cell' = 'range'): StubSelectionPlugin {
  return {
    name: 'selection',
    config: { mode },
    requestAfterRender: vi.fn(),
    clearSelection: vi.fn(),
    getSelection: vi.fn().mockReturnValue({ ranges: [], rowIndices: [1] }),
    isCellSelected: vi.fn().mockReturnValue(true),
    setRanges: vi.fn(),
    getSelectedRows: vi.fn().mockReturnValue([{ id: 1 }]),
  };
}

function makeGridEl(plugin: StubSelectionPlugin | undefined, rowCount = 3, colCount = 2): HTMLElement {
  const grid = document.createElement('tbw-grid');
  Object.assign(grid, {
    getPluginByName: (name: string) => (name === 'selection' ? plugin : undefined),
    rows: Array.from({ length: rowCount }, (_, i) => ({ id: i })),
    _columns: Array.from({ length: colCount }, (_, i) => ({ field: `f${i}` })),
  });
  document.body.appendChild(grid);
  return grid;
}

function renderHook(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: SelectionMethods | null } = { current: null };
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
    captured.current = useGridSelection(selector);
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

describe('@toolbox-web/grid-react/features/selection', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('selectAll in range mode sets one range spanning every row and column', () => {
    const plugin = makeStubPlugin('range');
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin, 3, 2));

    api().selectAll();

    expect(plugin.setRanges).toHaveBeenCalledWith([{ from: { row: 0, col: 0 }, to: { row: 2, col: 1 } }]);
    cleanup();
  });

  it('selectAll in row mode fills the selected index set and requests a render', () => {
    const plugin = makeStubPlugin('row');
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin, 3));

    api().selectAll();

    expect([...(plugin.selected ?? [])]).toEqual([0, 1, 2]);
    expect(plugin.requestAfterRender).toHaveBeenCalled();
    cleanup();
  });

  it('delegates clearSelection, getSelection, isCellSelected, setRanges and getSelectedRows', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin));

    api().clearSelection();
    expect(plugin.clearSelection).toHaveBeenCalled();

    expect(api().getSelection()).toEqual({ ranges: [], rowIndices: [1] });
    expect(api().isCellSelected(0, 1)).toBe(true);
    expect(plugin.isCellSelected).toHaveBeenCalledWith(0, 1);

    const ranges = [{ from: { row: 0, col: 0 }, to: { row: 1, col: 1 } }];
    api().setRanges(ranges);
    expect(plugin.setRanges).toHaveBeenCalledWith(ranges);

    expect(api().getSelectedRows()).toEqual([{ id: 1 }]);
    cleanup();
  });

  it('resolves the plugin through an explicit selector', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin).id = 'sel-grid';
    const { api, cleanup } = renderHook('#sel-grid', null);

    api().clearSelection();

    expect(plugin.clearSelection).toHaveBeenCalled();
    cleanup();
  });

  it('warns on selectAll and returns safe defaults when the plugin is missing', () => {
    const { api, cleanup } = renderHook(undefined, makeGridEl(undefined));

    api().selectAll();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SelectionPlugin not found'));

    expect(api().getSelection()).toBeNull();
    expect(api().isCellSelected(0, 0)).toBe(false);
    expect(api().getSelectedRows()).toEqual([]);
    expect(() => api().clearSelection()).not.toThrow();
    cleanup();
  });
});

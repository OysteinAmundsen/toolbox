/**
 * Tests for `@toolbox-web/grid-react/features/print`.
 *
 * Covers the `useGridPrint` hook's plugin discovery (context ref vs `selector`),
 * delegation to `PrintPlugin`, and the safe no-op + warning path when the plugin
 * is absent.
 *
 * @vitest-environment jsdom
 */
import { createElement, useRef } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GridElementContext } from '../lib/grid-element-context';
import { useGridPrint, type PrintMethods } from './print';

interface StubPrintPlugin {
  name: 'print';
  print: ReturnType<typeof vi.fn>;
  isPrinting: ReturnType<typeof vi.fn>;
}

function makeStubPlugin(): StubPrintPlugin {
  return {
    name: 'print',
    print: vi.fn().mockResolvedValue(undefined),
    isPrinting: vi.fn().mockReturnValue(true),
  };
}

function makeGridEl(plugin: StubPrintPlugin | undefined, id?: string): HTMLElement {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  (grid as unknown as { getPluginByName: (name: string) => unknown }).getPluginByName = (name: string) =>
    name === 'print' ? plugin : undefined;
  document.body.appendChild(grid);
  return grid;
}

function renderHook(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: PrintMethods | null } = { current: null };
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
    captured.current = useGridPrint(selector);
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

describe('@toolbox-web/grid-react/features/print', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('resolves the plugin through the context ref and delegates print()', async () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin));

    await api().print({ title: 'Report' });

    expect(plugin.print).toHaveBeenCalledWith({ title: 'Report' });
    cleanup();
  });

  it('resolves the plugin through an explicit selector', async () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'my-grid');
    // No context ref — the selector must be what finds the grid.
    const { api, cleanup } = renderHook('#my-grid', null);

    await api().print();

    expect(plugin.print).toHaveBeenCalledWith(undefined);
    cleanup();
  });

  it('delegates isPrinting()', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = renderHook(undefined, makeGridEl(plugin));

    expect(api().isPrinting()).toBe(true);
    expect(plugin.isPrinting).toHaveBeenCalled();
    cleanup();
  });

  it('warns and resolves without throwing when the plugin is missing', async () => {
    const { api, cleanup } = renderHook(undefined, makeGridEl(undefined));

    await expect(api().print()).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PrintPlugin not found'));
    cleanup();
  });

  it('reports isPrinting() as false when the plugin is missing', () => {
    const { api, cleanup } = renderHook(undefined, makeGridEl(undefined));
    expect(api().isPrinting()).toBe(false);
    cleanup();
  });
});

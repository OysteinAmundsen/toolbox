/**
 * Tests for `@toolbox-web/grid-vue/features/print`.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref, type App } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { useGridPrint, type PrintMethods } from './print';

function makeStubPlugin() {
  return {
    name: 'print' as const,
    print: vi.fn().mockResolvedValue(undefined),
    isPrinting: vi.fn().mockReturnValue(true),
  };
}

function makeGridEl(plugin: ReturnType<typeof makeStubPlugin> | undefined, id?: string): HTMLElement {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  (grid as unknown as { getPluginByName: (name: string) => unknown }).getPluginByName = (name: string) =>
    name === 'print' ? plugin : undefined;
  document.body.appendChild(grid);
  return grid;
}

function mountComposable(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: PrintMethods | null } = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);

  const Inner = defineComponent({
    setup() {
      captured.current = useGridPrint(selector);
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

describe('@toolbox-web/grid-vue/features/print', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('delegates print with and without params', async () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    await api().print();
    expect(plugin.print).toHaveBeenCalledWith(undefined);

    await api().print({ title: 'Report' });
    expect(plugin.print).toHaveBeenCalledWith({ title: 'Report' });

    cleanup();
  });

  it('reads print status from the plugin', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));
    expect(api().isPrinting()).toBe(true);
    cleanup();
  });

  it('resolves the grid through an explicit selector', async () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'print-grid');
    const { api, cleanup } = mountComposable('#print-grid', null);

    await api().print();
    expect(plugin.print).toHaveBeenCalled();

    cleanup();
  });

  it('warns and no-ops when the plugin is absent', async () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));

    await api().print();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('PrintPlugin not found'));
    expect(api().isPrinting()).toBe(false);

    cleanup();
  });

  it('exposes isReady as false before the grid resolves', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));
    expect(api().isReady.value).toBe(false);
    cleanup();
  });
});

/**
 * Tests for `@toolbox-web/grid-vue/features/export`.
 *
 * Covers plugin discovery (injected grid element vs explicit `selector`),
 * delegation to `ExportPlugin`, and the warn-and-no-op / safe-default
 * fallbacks when the plugin is absent.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref, type App } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { useGridExport, type ExportMethods } from './export';

function makeStubPlugin() {
  return {
    name: 'export' as const,
    exportCsv: vi.fn(),
    exportExcel: vi.fn(),
    exportJson: vi.fn(),
    isExporting: vi.fn().mockReturnValue(true),
    getLastExport: vi.fn().mockReturnValue({ format: 'csv', timestamp: new Date(0) }),
  };
}

function makeGridEl(plugin: ReturnType<typeof makeStubPlugin> | undefined, id?: string): HTMLElement {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  (grid as unknown as { getPluginByName: (name: string) => unknown }).getPluginByName = (name: string) =>
    name === 'export' ? plugin : undefined;
  document.body.appendChild(grid);
  return grid;
}

function mountComposable(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: ExportMethods | null } = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);

  const Inner = defineComponent({
    setup() {
      captured.current = useGridExport(selector);
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

describe('@toolbox-web/grid-vue/features/export', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('delegates each export format with a default filename', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    api().exportToCsv();
    expect(plugin.exportCsv).toHaveBeenCalledWith({ fileName: 'export.csv' });

    api().exportToExcel();
    expect(plugin.exportExcel).toHaveBeenCalledWith({ fileName: 'export.xlsx' });

    api().exportToJson();
    expect(plugin.exportJson).toHaveBeenCalledWith({ fileName: 'export.json' });

    cleanup();
  });

  it('prefers an explicit filename over params.fileName', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    api().exportToCsv('explicit.csv', { fileName: 'ignored.csv' });
    expect(plugin.exportCsv).toHaveBeenCalledWith({ fileName: 'explicit.csv' });

    api().exportToExcel(undefined, { fileName: 'from-params.xlsx' });
    expect(plugin.exportExcel).toHaveBeenCalledWith({ fileName: 'from-params.xlsx' });

    api().exportToJson(undefined, { fileName: 'from-params.json' });
    expect(plugin.exportJson).toHaveBeenCalledWith({ fileName: 'from-params.json' });

    cleanup();
  });

  it('reads export status from the plugin', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    expect(api().isExporting()).toBe(true);
    expect(api().getLastExport()).toEqual({ format: 'csv', timestamp: new Date(0) });

    cleanup();
  });

  it('resolves the grid through an explicit selector', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'export-grid');
    const { api, cleanup } = mountComposable('#export-grid', null);

    api().exportToCsv('via-selector.csv');
    expect(plugin.exportCsv).toHaveBeenCalledWith({ fileName: 'via-selector.csv' });

    cleanup();
  });

  it('warns and no-ops for every writer when the plugin is absent', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));

    api().exportToCsv();
    api().exportToExcel();
    api().exportToJson();

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ExportPlugin not found'));

    cleanup();
  });

  it('returns safe defaults for readers when the plugin is absent', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));

    expect(api().isExporting()).toBe(false);
    expect(api().getLastExport()).toBeNull();

    cleanup();
  });

  it('exposes isReady as false before the grid resolves', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));
    expect(api().isReady.value).toBe(false);
    cleanup();
  });
});

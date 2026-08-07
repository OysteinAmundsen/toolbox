/**
 * Tests for `@toolbox-web/grid-vue/features/filtering`.
 *
 * Covers the `useGridFiltering` composable's plugin discovery (injected grid
 * element vs explicit `selector`), delegation to `FilteringPlugin`, and the
 * warn-and-no-op / safe-default fallbacks when the plugin is absent.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, provide, ref, type App } from 'vue';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';
import { useGridFiltering, type FilteringMethods } from './filtering';

interface StubFilteringPlugin {
  name: 'filtering';
  setFilter: ReturnType<typeof vi.fn>;
  getFilter: ReturnType<typeof vi.fn>;
  getFilters: ReturnType<typeof vi.fn>;
  setFilterModel: ReturnType<typeof vi.fn>;
  clearAllFilters: ReturnType<typeof vi.fn>;
  clearFieldFilter: ReturnType<typeof vi.fn>;
  isFieldFiltered: ReturnType<typeof vi.fn>;
  getFilteredRowCount: ReturnType<typeof vi.fn>;
  getUniqueValues: ReturnType<typeof vi.fn>;
  getStaleFilters: ReturnType<typeof vi.fn>;
  getBlankMode: ReturnType<typeof vi.fn>;
  toggleBlankFilter: ReturnType<typeof vi.fn>;
}

function makeStubPlugin(): StubFilteringPlugin {
  return {
    name: 'filtering',
    setFilter: vi.fn(),
    getFilter: vi.fn().mockReturnValue({ field: 'name', operator: 'contains', value: 'a' }),
    getFilters: vi.fn().mockReturnValue([{ field: 'name', operator: 'contains', value: 'a' }]),
    setFilterModel: vi.fn(),
    clearAllFilters: vi.fn(),
    clearFieldFilter: vi.fn(),
    isFieldFiltered: vi.fn().mockReturnValue(true),
    getFilteredRowCount: vi.fn().mockReturnValue(7),
    getUniqueValues: vi.fn().mockReturnValue(['a', 'b']),
    getStaleFilters: vi.fn().mockReturnValue([]),
    getBlankMode: vi.fn().mockReturnValue('include'),
    toggleBlankFilter: vi.fn(),
  };
}

function makeGridEl(plugin: StubFilteringPlugin | undefined, id?: string): HTMLElement {
  const grid = document.createElement('tbw-grid');
  if (id) grid.id = id;
  (grid as unknown as { getPluginByName: (name: string) => unknown }).getPluginByName = (name: string) =>
    name === 'filtering' ? plugin : undefined;
  document.body.appendChild(grid);
  return grid;
}

/**
 * Mount a component that calls `useGridFiltering(selector)` under a provided
 * `GRID_ELEMENT_KEY` and expose the returned API.
 */
function mountComposable(selector?: string, gridEl?: HTMLElement | null) {
  const captured: { current: FilteringMethods | null } = { current: null };
  const host = document.createElement('div');
  document.body.appendChild(host);

  const Inner = defineComponent({
    setup() {
      captured.current = useGridFiltering(selector);
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

describe('@toolbox-web/grid-vue/features/filtering', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
    document.body.innerHTML = '';
  });

  it('resolves the plugin through the injected grid element and delegates writes', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    api().setFilter('name', { operator: 'contains', value: 'a' });
    expect(plugin.setFilter).toHaveBeenCalledWith('name', { operator: 'contains', value: 'a' }, undefined);

    api().setFilterModel([{ field: 'name', operator: 'contains', value: 'a' }], { silent: true });
    expect(plugin.setFilterModel).toHaveBeenCalledWith([{ field: 'name', operator: 'contains', value: 'a' }], {
      silent: true,
    });

    api().clearAllFilters();
    expect(plugin.clearAllFilters).toHaveBeenCalled();

    api().clearFieldFilter('name');
    expect(plugin.clearFieldFilter).toHaveBeenCalledWith('name', undefined);

    api().toggleBlankFilter('name', 'blanks');
    expect(plugin.toggleBlankFilter).toHaveBeenCalledWith('name', 'blanks');

    cleanup();
  });

  it('delegates the read methods', () => {
    const plugin = makeStubPlugin();
    const { api, cleanup } = mountComposable(undefined, makeGridEl(plugin));

    expect(api().getFilter('name')).toEqual({ field: 'name', operator: 'contains', value: 'a' });
    expect(api().getFilters()).toHaveLength(1);
    expect(api().isFieldFiltered('name')).toBe(true);
    expect(api().getFilteredRowCount()).toBe(7);
    expect(api().getUniqueValues('name')).toEqual(['a', 'b']);
    expect(api().getStaleFilters()).toEqual([]);
    expect(api().getBlankMode('name')).toBe('include');

    cleanup();
  });

  it('resolves the plugin through an explicit selector, ignoring the injected element', () => {
    const plugin = makeStubPlugin();
    makeGridEl(plugin, 'vue-filter-grid');
    const { api, cleanup } = mountComposable('#vue-filter-grid', null);

    api().clearAllFilters();

    expect(plugin.clearAllFilters).toHaveBeenCalled();
    cleanup();
  });

  it('warns and returns safe defaults when the plugin is missing', () => {
    const { api, cleanup } = mountComposable(undefined, makeGridEl(undefined));

    api().setFilter('name', null);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FilteringPlugin not found'));

    expect(api().getFilter('name')).toBeUndefined();
    expect(api().getFilters()).toEqual([]);
    expect(api().isFieldFiltered('name')).toBe(false);
    expect(api().getFilteredRowCount()).toBe(0);
    expect(api().getUniqueValues('name')).toEqual([]);
    expect(api().getStaleFilters()).toEqual([]);
    expect(api().getBlankMode('name')).toBe('all');

    expect(() => api().clearAllFilters()).not.toThrow();
    expect(() => api().clearFieldFilter('name')).not.toThrow();
    expect(() => api().setFilterModel([])).not.toThrow();
    expect(() => api().toggleBlankFilter('name', 'blanks')).not.toThrow();

    cleanup();
  });
});

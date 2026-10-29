import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockCache } from './cache';
import {
  createUrlDataSource,
  getBlockNumber,
  getBlockRange,
  getRequiredBlocks,
  getRowFromCache,
  loadBlock,
} from './datasource';
import { createLoadingPlaceholder, isLoadingPlaceholder } from './placeholder';
import { ServerSidePlugin } from './server-side-plugin';
import type { ServerSideConfig, ServerSideDataSource } from './types';

// #region Mock Grid

function createServerSideMockGrid(overrides: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  // Add a child so children[0] is defined (used by base plugin for gridElement)
  el.appendChild(document.createElement('div'));
  const rows: unknown[] = [];

  // Plugin manager mock for event subscriptions (on/off/emitPluginEvent)
  const eventListeners = new Map<string, Map<unknown, (detail: unknown) => void>>();
  const pluginManager = {
    subscribe(plugin: unknown, eventType: string, callback: (detail: unknown) => void) {
      let listeners = eventListeners.get(eventType);
      if (!listeners) {
        listeners = new Map();
        eventListeners.set(eventType, listeners);
      }
      listeners.set(plugin, callback);
    },
    unsubscribe(plugin: unknown, eventType: string) {
      eventListeners.get(eventType)?.delete(plugin);
    },
    unsubscribeAll(plugin: unknown) {
      for (const listeners of eventListeners.values()) {
        listeners.delete(plugin);
      }
    },
    emitPluginEvent<T>(eventType: string, detail: T) {
      const listeners = eventListeners.get(eventType);
      if (listeners) {
        for (const callback of listeners.values()) {
          callback(detail);
        }
      }
    },
    _hasRowStructurePlugins: true,
  };

  Object.defineProperty(el, 'rows', { value: rows, writable: true, configurable: true });
  Object.defineProperty(el, 'sourceRows', { value: rows, writable: true, configurable: true });
  Object.defineProperty(el, 'columns', { value: [], writable: true, configurable: true });
  Object.defineProperty(el, '_visibleColumns', { value: [], writable: true, configurable: true });
  Object.defineProperty(el, '_virtualization', {
    value: overrides._virtualization ?? { enabled: false, start: 0, end: 20 },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, 'gridConfig', { value: {}, writable: true, configurable: true });
  Object.defineProperty(el, 'effectiveConfig', { value: {}, writable: true, configurable: true });
  Object.defineProperty(el, 'getPlugin', { value: () => undefined, configurable: true });
  Object.defineProperty(el, 'getPluginByName', { value: () => undefined, configurable: true });
  Object.defineProperty(el, 'getPluginState', { value: () => null, configurable: true });
  Object.defineProperty(el, 'query', { value: () => [], configurable: true });
  Object.defineProperty(el, 'requestRender', { value: vi.fn(), writable: true, configurable: true });
  Object.defineProperty(el, 'refreshVirtualWindow', { value: vi.fn(), configurable: true });
  Object.defineProperty(el, '_pluginManager', { value: pluginManager, writable: true, configurable: true });

  for (const [key, value] of Object.entries(overrides)) {
    if (key !== '_virtualization') {
      Object.defineProperty(el, key, { value, writable: true, configurable: true });
    }
  }

  return el as HTMLElement & Record<string, any>;
}

/** Data source serving `{ id }` rows for any requested range of a `total`-row dataset. */
const pagedDS = (total: number): ServerSideDataSource => ({
  getRows: vi.fn().mockImplementation(({ startNode, endNode }: { startNode: number; endNode: number }) =>
    Promise.resolve({
      rows: Array.from({ length: Math.max(0, Math.min(total, endNode) - startNode) }, (_, i) => ({
        id: startNode + i,
      })),
      totalNodeCount: total,
    }),
  ),
});

// #endregion

describe('server-side plugin', () => {
  describe('getBlockNumber', () => {
    it('should return 0 for rows in first block', () => {
      expect(getBlockNumber(0, 100)).toBe(0);
      expect(getBlockNumber(50, 100)).toBe(0);
      expect(getBlockNumber(99, 100)).toBe(0);
    });

    it('should return correct block for rows in subsequent blocks', () => {
      expect(getBlockNumber(100, 100)).toBe(1);
      expect(getBlockNumber(150, 100)).toBe(1);
      expect(getBlockNumber(199, 100)).toBe(1);
      expect(getBlockNumber(200, 100)).toBe(2);
    });

    it('should work with different block sizes', () => {
      expect(getBlockNumber(25, 50)).toBe(0);
      expect(getBlockNumber(50, 50)).toBe(1);
      expect(getBlockNumber(75, 50)).toBe(1);
      expect(getBlockNumber(100, 50)).toBe(2);
    });

    it('should handle edge cases', () => {
      expect(getBlockNumber(0, 1)).toBe(0);
      expect(getBlockNumber(5, 1)).toBe(5);
      expect(getBlockNumber(999, 1000)).toBe(0);
      expect(getBlockNumber(1000, 1000)).toBe(1);
    });
  });

  describe('getBlockRange', () => {
    it('should return correct range for first block', () => {
      expect(getBlockRange(0, 100)).toEqual({ start: 0, end: 100 });
    });

    it('should return correct range for subsequent blocks', () => {
      expect(getBlockRange(1, 100)).toEqual({ start: 100, end: 200 });
      expect(getBlockRange(2, 100)).toEqual({ start: 200, end: 300 });
      expect(getBlockRange(5, 100)).toEqual({ start: 500, end: 600 });
    });

    it('should work with different block sizes', () => {
      expect(getBlockRange(0, 50)).toEqual({ start: 0, end: 50 });
      expect(getBlockRange(1, 50)).toEqual({ start: 50, end: 100 });
      expect(getBlockRange(2, 25)).toEqual({ start: 50, end: 75 });
    });
  });

  describe('getRequiredBlocks', () => {
    it('should return single block when range fits in one block', () => {
      expect(getRequiredBlocks(0, 50, 100)).toEqual([0]);
      expect(getRequiredBlocks(10, 90, 100)).toEqual([0]);
      expect(getRequiredBlocks(100, 150, 100)).toEqual([1]);
    });

    it('should return multiple blocks when range spans blocks', () => {
      expect(getRequiredBlocks(0, 150, 100)).toEqual([0, 1]);
      expect(getRequiredBlocks(50, 250, 100)).toEqual([0, 1, 2]);
      expect(getRequiredBlocks(0, 500, 100)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle exact block boundaries', () => {
      expect(getRequiredBlocks(0, 100, 100)).toEqual([0]);
      expect(getRequiredBlocks(100, 200, 100)).toEqual([1]);
      expect(getRequiredBlocks(0, 200, 100)).toEqual([0, 1]);
    });

    it('should handle ranges starting mid-block', () => {
      expect(getRequiredBlocks(75, 125, 100)).toEqual([0, 1]);
      expect(getRequiredBlocks(150, 350, 100)).toEqual([1, 2, 3]);
    });

    it('should work with small block sizes', () => {
      expect(getRequiredBlocks(0, 10, 5)).toEqual([0, 1]);
      expect(getRequiredBlocks(7, 18, 5)).toEqual([1, 2, 3]);
    });
  });

  describe('loadBlock', () => {
    it('should call dataSource.getRows with correct params', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 1 }, { id: 2 }],
          totalNodeCount: 1000,
        }),
      };

      const result = await loadBlock(
        mockDataSource,
        2,
        100,
        {
          sortModel: [{ field: 'name', direction: 'asc' }],
          filterModel: { status: 'active' },
        },
        new AbortController().signal,
      );

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startNode: 200,
        endNode: 300,
        pageSize: 100,
        sortModel: [{ field: 'name', direction: 'asc' }],
        filterModel: { status: 'active' },
        signal: expect.any(AbortSignal),
      });

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.totalNodeCount).toBe(1000);
    });

    it('should handle first block correctly', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [],
          totalNodeCount: 0,
        }),
      };

      await loadBlock(mockDataSource, 0, 50, {}, new AbortController().signal);

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startNode: 0,
        endNode: 50,
        pageSize: 50,
        sortModel: undefined,
        filterModel: undefined,
        signal: expect.any(AbortSignal),
      });
    });

    it('should propagate errors from dataSource', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      await expect(loadBlock(mockDataSource, 0, 100, {}, new AbortController().signal)).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('getRowFromCache', () => {
    it('should return undefined for missing block', () => {
      const loadedBlocks = new Map<number, any[]>();
      expect(getRowFromCache(50, 100, loadedBlocks)).toBeUndefined();
    });

    it('should return correct row from cached block', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, [{ id: 0 }, { id: 1 }, { id: 2 }]);

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(1, 100, loadedBlocks)).toEqual({ id: 1 });
      expect(getRowFromCache(2, 100, loadedBlocks)).toEqual({ id: 2 });
    });

    it('should handle rows in different blocks', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(
        0,
        Array.from({ length: 100 }, (_, i) => ({ id: i })),
      );
      loadedBlocks.set(
        1,
        Array.from({ length: 100 }, (_, i) => ({ id: 100 + i })),
      );

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(99, 100, loadedBlocks)).toEqual({ id: 99 });
      expect(getRowFromCache(100, 100, loadedBlocks)).toEqual({ id: 100 });
      expect(getRowFromCache(150, 100, loadedBlocks)).toEqual({ id: 150 });
    });

    it('should return undefined for row beyond cached block size', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, [{ id: 0 }, { id: 1 }]);

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(5, 100, loadedBlocks)).toBeUndefined();
    });
  });

  describe('BlockCache', () => {
    it('should store and retrieve values', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');

      expect(cache.get(0)).toBe('block0');
      expect(cache.get(1)).toBe('block1');
      expect(cache.get(2)).toBeUndefined();
    });

    it('should report has correctly', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');

      expect(cache.has(0)).toBe(true);
      expect(cache.has(1)).toBe(false);
    });

    it('should evict oldest entry when full', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(2, 'block2');
      cache.set(3, 'block3'); // Should evict block0

      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBe('block1');
      expect(cache.get(2)).toBe('block2');
      expect(cache.get(3)).toBe('block3');
    });

    it('should update access order on get', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(2, 'block2');

      // Access block0, making it most recently used
      cache.get(0);

      // Add block3, should evict block1 (oldest after get)
      cache.set(3, 'block3');

      expect(cache.get(0)).toBe('block0');
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(2)).toBe('block2');
      expect(cache.get(3)).toBe('block3');
    });

    it('should update existing entry without increasing size', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(0, 'block0-updated');
      cache.set(2, 'block2');

      expect(cache.size).toBe(3);
      expect(cache.get(0)).toBe('block0-updated');
    });

    it('should clear all entries', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBeUndefined();
    });

    it('should handle cache size of 1', () => {
      const cache = new BlockCache<string>(1);

      cache.set(0, 'block0');
      expect(cache.get(0)).toBe('block0');

      cache.set(1, 'block1');
      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBe('block1');
    });

    it('should handle sequential evictions', () => {
      const cache = new BlockCache<number[]>(2);

      cache.set(0, [0, 1, 2]);
      cache.set(1, [3, 4, 5]);
      cache.set(2, [6, 7, 8]); // Evicts 0
      cache.set(3, [9, 10, 11]); // Evicts 1

      expect(cache.has(0)).toBe(false);
      expect(cache.has(1)).toBe(false);
      expect(cache.get(2)).toEqual([6, 7, 8]);
      expect(cache.get(3)).toEqual([9, 10, 11]);
    });

    it('should move accessed item to end of eviction queue', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'a');
      cache.set(1, 'b');
      cache.set(2, 'c');

      // Access 0 and 1, making 2 the oldest
      cache.get(0);
      cache.get(1);

      // Add 3, should evict 2
      cache.set(3, 'd');

      expect(cache.has(2)).toBe(false);
      expect(cache.has(0)).toBe(true);
      expect(cache.has(1)).toBe(true);
      expect(cache.has(3)).toBe(true);
    });
  });
});

describe('ServerSidePlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('constructor and defaults', () => {
    it('should have correct name', () => {
      const plugin = new ServerSidePlugin();
      expect(plugin.name).toBe('serverSide');
    });

    it('should accept custom config', () => {
      const plugin = new ServerSidePlugin({ pageSize: 50, maxConcurrentRequests: 1 });
      expect(plugin.name).toBe('serverSide');
    });
  });

  describe('manifest', () => {
    it('should declare incompatibilities', () => {
      const manifest = ServerSidePlugin.manifest;
      expect(manifest.incompatibleWith).toBeDefined();
      expect(manifest.incompatibleWith!.length).toBe(1);
      expect(manifest.incompatibleWith!.map((i) => i.name)).toEqual(['pivot']);
    });

    it('should answer datasource:filter-mode only while a data source is active (#520)', () => {
      expect(ServerSidePlugin.manifest.queries!.map((q) => q.type)).toContain('datasource:filter-mode');
      const query = { type: 'datasource:filter-mode', context: null };
      const getRows = vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 });

      const serverMode = new ServerSidePlugin({ pageSize: 10 });
      serverMode.attach(createServerSideMockGrid() as any);
      expect(serverMode.handleQuery(query)).toBeUndefined();
      serverMode.setDataSource({ getRows });
      expect(serverMode.handleQuery(query)).toBe('server');

      const localMode = new ServerSidePlugin({ pageSize: 10, filterMode: 'local', dataSource: { getRows } });
      localMode.attach(createServerSideMockGrid() as any);
      expect(localMode.handleQuery(query)).toBe('local');

      // The URL source (`data-src`) slices a cached dataset and cannot filter.
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => undefined)),
      );
      const urlSource = new ServerSidePlugin({ pageSize: 10, filterMode: 'server' });
      try {
        urlSource.attach(createServerSideMockGrid() as any);
        urlSource.setDataSource(createUrlDataSource('/rows.json'));
        expect(urlSource.handleQuery(query)).toBe('local');
      } finally {
        urlSource.detach();
        vi.unstubAllGlobals();
      }
    });

    it('should answer datasource:sort-mode only while a data source is active (#521)', () => {
      expect(ServerSidePlugin.manifest.queries!.map((q) => q.type)).toContain('datasource:sort-mode');
      const query = { type: 'datasource:sort-mode', context: null };
      const getRows = vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 });

      const serverMode = new ServerSidePlugin({ pageSize: 10 });
      serverMode.attach(createServerSideMockGrid() as any);
      expect(serverMode.handleQuery(query)).toBeUndefined();
      serverMode.setDataSource({ getRows });
      expect(serverMode.handleQuery(query)).toBe('server');

      const localMode = new ServerSidePlugin({ pageSize: 10, sortMode: 'local', dataSource: { getRows } });
      localMode.attach(createServerSideMockGrid() as any);
      expect(localMode.handleQuery(query)).toBe('local');

      // The URL source (`data-src`) slices a cached dataset and cannot sort.
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => undefined)),
      );
      const urlSource = new ServerSidePlugin({ pageSize: 10, sortMode: 'server' });
      try {
        urlSource.attach(createServerSideMockGrid() as any);
        urlSource.setDataSource(createUrlDataSource('/rows.json'));
        expect(urlSource.handleQuery(query)).toBe('local');
      } finally {
        urlSource.detach();
        vi.unstubAllGlobals();
      }
    });
  });

  describe('setDataSource', () => {
    it('should load first block and trigger render', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 100 }),
      };

      plugin.setDataSource(mockDS);

      // Wait for the async load
      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      expect(mockDS.getRows).toHaveBeenCalledWith(expect.objectContaining({ startNode: 0, endNode: 10 }));
      expect(plugin.getTotalNodeCount()).toBe(100);
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    it('should clear previous state when setting new data source', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const ds1: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 50 }),
      };
      plugin.setDataSource(ds1);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(50));

      const ds2: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 2 }], totalNodeCount: 200 }),
      };
      plugin.setDataSource(ds2);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(200));

      expect(plugin.getLoadedBlockCount()).toBe(1);
    });
  });

  describe('config.dataSource (declarative)', () => {
    it('should auto-initialize from config.dataSource on attach', async () => {
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 100 }),
      };
      const plugin = new ServerSidePlugin({ pageSize: 10, dataSource: mockDS });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      expect(mockDS.getRows).toHaveBeenCalledWith(expect.objectContaining({ startNode: 0, endNode: 10 }));
      expect(plugin.getTotalNodeCount()).toBe(100);
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    it('should allow setDataSource to override config.dataSource', async () => {
      const configDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 50 }),
      };
      const plugin = new ServerSidePlugin({ pageSize: 10, dataSource: configDS });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(50));

      const runtimeDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 2 }], totalNodeCount: 200 }),
      };
      plugin.setDataSource(runtimeDS);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(200));

      expect(runtimeDS.getRows).toHaveBeenCalled();
    });

    it('should not auto-initialize when config.dataSource is not provided', () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      // processRows should pass through when no dataSource is set
      const rows = [{ id: 1 }];
      expect(plugin.processRows(rows)).toEqual(rows);
    });
  });

  describe('serverSide feature boolean shorthand', () => {
    it('enables the plugin with `serverSide: true` (matches the feature convention)', async () => {
      // Importing the feature module registers its factory.
      await import('../../features/server-side');
      const { createPluginsFromFeatures } = await import('../../features/registry');

      const plugins = createPluginsFromFeatures({ serverSide: true });

      expect(plugins).toHaveLength(1);
      expect(plugins[0]).toBeInstanceOf(ServerSidePlugin);
    });
  });

  describe('createUrlDataSource', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('fetches a plain JSON array and derives totalNodeCount from its length', async () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      vi.stubGlobal('fetch', fetchMock);

      const ds = createUrlDataSource('/api/rows.json');
      const result = await ds.getRows({
        startNode: 0,
        endNode: 2,
        pageSize: 2,
        signal: new AbortController().signal,
      });

      expect(fetchMock).toHaveBeenCalledWith('/api/rows.json', expect.objectContaining({ signal: expect.anything() }));
      expect(result).toEqual({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 3 });
    });

    it('fetches a { rows, totalNodeCount } envelope and honours totalNodeCount', async () => {
      const envelope = { rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 500 };
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(envelope) });
      vi.stubGlobal('fetch', fetchMock);

      const ds = createUrlDataSource('/api/rows');
      const result = await ds.getRows({
        startNode: 0,
        endNode: 2,
        pageSize: 2,
        signal: new AbortController().signal,
      });

      expect(result).toEqual({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 500 });
    });

    it('fetches once and serves subsequent blocks from cache', async () => {
      const data = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      vi.stubGlobal('fetch', fetchMock);

      const ds = createUrlDataSource('/api/rows.json');
      const signal = new AbortController().signal;
      const first = await ds.getRows({ startNode: 0, endNode: 2, pageSize: 2, signal });
      const second = await ds.getRows({ startNode: 2, endNode: 4, pageSize: 2, signal });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.rows).toEqual([{ id: 0 }, { id: 1 }]);
      expect(second.rows).toEqual([{ id: 2 }, { id: 3 }]);
    });

    it('rejects when the response is not ok', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
      vi.stubGlobal('fetch', fetchMock);

      const ds = createUrlDataSource('/api/missing');
      await expect(
        ds.getRows({ startNode: 0, endNode: 2, pageSize: 2, signal: new AbortController().signal }),
      ).rejects.toThrow('/api/missing');
    });

    it('does not cache a failed fetch — a later block request retries', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
      vi.stubGlobal('fetch', fetchMock);

      const ds = createUrlDataSource('/api/rows.json');
      const signal = new AbortController().signal;

      await expect(ds.getRows({ startNode: 0, endNode: 2, pageSize: 2, signal })).rejects.toThrow();
      // The rejected promise must not be cached — the retry re-fetches and succeeds.
      const retry = await ds.getRows({ startNode: 0, endNode: 2, pageSize: 2, signal });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(retry).toEqual({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 2 });
    });
  });

  describe('data-src host attribute (declarative)', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('reads data-src from the host element and loads the first block on attach', async () => {
      const data = [{ id: 1 }, { id: 2 }];
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      vi.stubGlobal('fetch', fetchMock);

      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({ _hostElement: undefined });
      grid._hostElement = grid;
      grid.setAttribute('data-src', '/api/rows.json');
      plugin.attach(grid as any);

      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      expect(fetchMock).toHaveBeenCalledWith('/api/rows.json', expect.objectContaining({ signal: expect.anything() }));
      expect(plugin.getTotalNodeCount()).toBe(2);
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    it('prefers config.dataSource over the data-src attribute', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const configDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 9 }], totalNodeCount: 1 }),
      };
      const plugin = new ServerSidePlugin({ pageSize: 10, dataSource: configDS });
      const grid = createServerSideMockGrid();
      grid._hostElement = grid;
      grid.setAttribute('data-src', '/api/rows.json');
      plugin.attach(grid as any);

      await vi.waitFor(() => expect(configDS.getRows).toHaveBeenCalled());
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does nothing when neither config.dataSource nor data-src is present', () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      grid._hostElement = grid;
      plugin.attach(grid as any);

      const rows = [{ id: 1 }];
      expect(plugin.processRows(rows)).toEqual(rows);
    });
  });

  describe('AbortSignal cancellation', () => {
    it('passes a fresh, non-aborted AbortSignal to getRows', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 1 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(1));

      const params = (mockDS.getRows as any).mock.calls[0][0];
      expect(params.signal).toBeInstanceOf(AbortSignal);
      expect(params.signal.aborted).toBe(false);
    });

    it('aborts the in-flight signal when setDataSource is called again', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      let firstSignal: AbortSignal | undefined;
      const ds1: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation((p) => {
          firstSignal = p.signal;
          // Never resolve — simulate slow request
          return new Promise(() => undefined);
        }),
      };
      plugin.setDataSource(ds1);
      await vi.waitFor(() => expect(firstSignal).toBeDefined());
      expect(firstSignal!.aborted).toBe(false);

      const ds2: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 9 }], totalNodeCount: 1 }),
      };
      plugin.setDataSource(ds2);

      expect(firstSignal!.aborted).toBe(true);
    });

    it('aborts the in-flight signal on detach', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      let signal: AbortSignal | undefined;
      const ds: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation((p) => {
          signal = p.signal;
          return new Promise(() => undefined);
        }),
      };
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(signal).toBeDefined());

      plugin.detach();

      expect(signal!.aborted).toBe(true);
    });

    it('aborts the in-flight signal when refresh() is called', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      let firstSignal: AbortSignal | undefined;
      const ds: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockImplementationOnce((p) => {
            firstSignal = p.signal;
            return new Promise(() => undefined);
          })
          .mockResolvedValue({ rows: [{ id: 2 }], totalNodeCount: 1 }),
      };
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(firstSignal).toBeDefined());

      plugin.refresh();

      expect(firstSignal!.aborted).toBe(true);
    });

    it('drops the result when a superseded request resolves anyway', async () => {
      // Simulates a data source that ignores params.signal — the plugin still
      // protects the cache by checking signal.aborted before storing the result.
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      let resolveFirst!: (value: unknown) => void;
      const firstPromise = new Promise((r) => {
        resolveFirst = r;
      });
      const ds: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockImplementationOnce(() => firstPromise)
          .mockResolvedValue({ rows: [{ id: 'second' }], totalNodeCount: 1 }),
      };
      plugin.setDataSource(ds);
      // Supersede before the first resolves.
      plugin.refresh();
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(1));

      // Now resolve the stale first request — its result must NOT replace block 0.
      resolveFirst({ rows: [{ id: 'stale' }], totalNodeCount: 999 });
      await Promise.resolve();
      await Promise.resolve();

      expect(plugin.getTotalNodeCount()).toBe(1);
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    describe('getChildRows signal', () => {
      function setup(getChildRows: ServerSideDataSource['getChildRows']) {
        const plugin = new ServerSidePlugin({ pageSize: 10 });
        const grid = createServerSideMockGrid();
        plugin.attach(grid as any);
        plugin.setDataSource({ getRows: vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 }), getChildRows });
        const events: Array<{ type: string; detail: any }> = [];
        for (const type of ['datasource:children', 'datasource:error', 'datasource:loading']) {
          // Child-request events only — the root block's `datasource:loading` carries no context.
          grid.addEventListener(type, (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail.context) events.push({ type, detail });
          });
        }
        const fetch = (signal?: AbortSignal) =>
          plugin.handleQuery({ type: 'datasource:fetch-children', context: { context: { source: 'tree' }, signal } });
        return { plugin, events, fetch };
      }

      it('passes a non-aborted signal to getChildRows', async () => {
        const getChildRows = vi.fn(async () => ({ rows: [{ id: 1 }] }));
        const { events, fetch } = setup(getChildRows);

        fetch();

        await vi.waitFor(() => expect(events.some((e) => e.type === 'datasource:children')).toBe(true));
        const params = getChildRows.mock.calls[0] as unknown[];
        expect((params[0] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
        expect((params[0] as { signal: AbortSignal }).signal.aborted).toBe(false);
      });

      it('aborts getChildRows and drops its result when the requester signal aborts (#527)', async () => {
        let childSignal: AbortSignal | undefined;
        let resolve!: (value: { rows: unknown[] }) => void;
        const { events, fetch } = setup((params) => {
          childSignal = params.signal;
          return new Promise((r) => (resolve = r));
        });
        const requester = new AbortController();
        fetch(requester.signal);

        requester.abort();
        expect(childSignal!.aborted).toBe(true);
        resolve({ rows: [{ id: 'stale' }] });
        await new Promise((r) => setTimeout(r, 0));

        expect(events.map((e) => e.type)).toEqual(['datasource:loading', 'datasource:loading']);
        expect(events.at(-1)!.detail.loading).toBe(false);
      });

      it('untracks a requester-aborted request even when getChildRows never settles (#539)', () => {
        const { plugin, fetch } = setup(() => new Promise(() => undefined));
        const requesters = Array.from({ length: 3 }, () => new AbortController());
        for (const requester of requesters) fetch(requester.signal);
        expect(plugin['childControllers'].size).toBe(3);

        for (const requester of requesters) requester.abort();

        expect(plugin['childControllers'].size).toBe(0);
      });

      it('reports no error when an aborted getChildRows rejects', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { events, fetch } = setup(
          ({ signal }) =>
            new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')))),
        );
        const requester = new AbortController();
        fetch(requester.signal);

        requester.abort();
        await new Promise((r) => setTimeout(r, 0));

        expect(events.some((e) => e.type === 'datasource:error')).toBe(false);
        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('does not call getChildRows for an already-aborted requester signal', () => {
        const getChildRows = vi.fn(async () => ({ rows: [] }));
        const { fetch } = setup(getChildRows);

        fetch(AbortSignal.abort());

        expect(getChildRows).not.toHaveBeenCalled();
      });

      it('settles the request with datasource:error when getChildRows is not implemented (#539)', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { events, fetch } = setup(undefined);

        fetch();

        expect(warnSpy).toHaveBeenCalled();
        expect(events.map((e) => e.type)).toEqual(['datasource:error']);
        expect(events[0].detail.error.message).toContain('getChildRows() is not implemented');
        expect(events[0].detail.context.source).toBe('tree');
        warnSpy.mockRestore();
      });

      it('aborts in-flight child requests on detach', () => {
        let childSignal: AbortSignal | undefined;
        const { plugin, fetch } = setup((params) => {
          childSignal = params.signal;
          return new Promise(() => undefined);
        });
        fetch();

        plugin.detach();

        expect(childSignal!.aborted).toBe(true);
      });

      it('keeps child requests alive across refresh() (GroupingRows/MasterDetail rely on the result)', async () => {
        let childSignal: AbortSignal | undefined;
        const { plugin, events, fetch } = setup(async (params) => {
          childSignal = params.signal;
          return { rows: [{ id: 1 }] };
        });
        fetch();

        plugin.refresh();

        await vi.waitFor(() => expect(events.some((e) => e.type === 'datasource:children')).toBe(true));
        expect(childSignal!.aborted).toBe(false);
      });
    });
  });

  describe('Subscribable getRows (RxJS / HttpClient)', () => {
    it('accepts a Subscribable and resolves on next', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const ds: ServerSideDataSource = {
        getRows: () => ({
          subscribe(observer) {
            queueMicrotask(() => observer.next?.({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 2 }));
            return { unsubscribe: () => undefined };
          },
        }),
      };
      plugin.setDataSource(ds);

      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(2));
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    it('unsubscribes from the Subscribable when the request is superseded', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const unsubscribe = vi.fn();
      let firstCalls = 0;
      const ds: ServerSideDataSource = {
        getRows: () => {
          firstCalls += 1;
          if (firstCalls === 1) {
            // First request — never emits, just tracks unsubscribe.
            return {
              subscribe() {
                return { unsubscribe };
              },
            };
          }
          // Second request — resolves immediately.
          return Promise.resolve({ rows: [{ id: 9 }], totalNodeCount: 1 });
        },
      };
      plugin.setDataSource(ds);
      // Wait a tick so the Subscribable has been subscribed to.
      await Promise.resolve();
      plugin.refresh();
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(1));

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('rejects loadBlock with AbortError when the Subscribable is aborted before emitting', async () => {
      const controller = new AbortController();
      const teardown = vi.fn();
      const ds: ServerSideDataSource = {
        getRows: () => ({
          subscribe() {
            return { unsubscribe: teardown };
          },
        }),
      };

      const promise = loadBlock(ds, 0, 10, {}, controller.signal);
      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(teardown).toHaveBeenCalled();
    });
  });

  describe('processRows', () => {
    it('should pass through rows when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const rows = [{ id: 1 }, { id: 2 }];
      const result = plugin.processRows(rows);
      expect(result).toEqual(rows);
    });

    it('should return managed rows with placeholders when data source is set', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(10));

      const result = plugin.processRows([]);
      expect(result.length).toBe(10);
      // First 5 are loaded data
      expect(result[0]).toEqual({ id: 0 });
      expect(result[4]).toEqual({ id: 4 });
      // Remaining are placeholders
      expect((result[5] as any).__loading).toBe(true);
    });

    it('should not throw when totalNodeCount is undefined (malformed datasource)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: undefined }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      // undefined totalNodeCount is treated as 0 (not a valid number)
      expect(() => plugin.processRows([])).not.toThrow();
      expect(plugin.processRows([]).length).toBe(0);
      expect(plugin.getTotalNodeCount()).toBe(0);
    });

    it('treats a malformed lastNode (negative / NaN) as an unknown total instead of throwing', async () => {
      for (const lastNode of [-5, Number.NaN]) {
        const plugin = new ServerSidePlugin({ pageSize: 5 });
        const grid = createServerSideMockGrid();
        plugin.attach(grid as any);
        plugin.setDataSource({ getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], lastNode }) });
        await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

        // `managedNodes.length = NaN | -4` would throw a RangeError.
        expect(() => plugin.processRows([])).not.toThrow();
        expect(plugin.getTotalNodeCount()).toBe(0);
        plugin.detach();
      }
    });

    it('fills only the loaded blocks and keeps stable placeholders in the gaps', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 0, end: 0 } });
      plugin.attach(grid as any);

      plugin.setDataSource(pagedDS(12));
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      const first = plugin.processRows([]);
      grid.rows = first;
      const gapPlaceholder = first[5];
      expect(isLoadingPlaceholder(gapPlaceholder)).toBe(true);

      // Land block 2 (the short last block) without block 1.
      grid._virtualization.start = 10;
      grid._virtualization.end = 12;
      plugin.afterRender();
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(plugin.isNodeLoaded(5)).toBe(false);

      const result = plugin.processRows([]);
      expect(result.length).toBe(12);
      expect(result.slice(0, 5).map((r: any) => r.id)).toEqual([0, 1, 2, 3, 4]);
      expect(result.slice(10).map((r: any) => r.id)).toEqual([10, 11]);
      // Unloaded block 1 keeps the very same placeholder objects as the first pass.
      expect(result[5]).toBe(gapPlaceholder);
      expect(result.slice(5, 10).every((r) => isLoadingPlaceholder(r))).toBe(true);
    });

    it('should enter infinite scroll mode when totalNodeCount is -1', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: -1 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      // -1 means infinite scroll — shows loaded data + one extra block of placeholders
      expect(() => plugin.processRows([])).not.toThrow();
      // Short block (1 row < blockSize 5) auto-detects end → total = 1
      expect(plugin.processRows([]).length).toBe(1);
    });
  });

  describe('loading placeholders (#508)', () => {
    it('createLoadingPlaceholder carries the node index and a height-cache key', () => {
      const p = createLoadingPlaceholder(7);
      expect(p).toMatchObject({ __loading: true, __index: 7, __rowCacheKey: '__loading:7' });
      expect(isLoadingPlaceholder(p)).toBe(true);
    });

    it('isLoadingPlaceholder rejects data rows and grouped placeholders', () => {
      expect(isLoadingPlaceholder({ id: 1 })).toBe(false);
      expect(isLoadingPlaceholder(null)).toBe(false);
      expect(isLoadingPlaceholder('row')).toBe(false);
      expect(isLoadingPlaceholder({ __loading: true, __groupKey: 'a' })).toBe(false);
    });

    it('renderRow renders placeholders in the row-loading state and ignores data rows', () => {
      const plugin = new ServerSidePlugin();
      plugin.attach(createServerSideMockGrid() as any);
      const rowEl = document.createElement('div');

      expect(plugin.renderRow({ id: 1 }, rowEl)).toBe(false);
      expect(plugin.renderRow(createLoadingPlaceholder(0), rowEl)).toBe(true);
      expect(rowEl.classList.contains('tbw-row-loading')).toBe(true);
      expect(rowEl.getAttribute('aria-busy')).toBe('true');
    });

    it("renderRow leaves placeholders to the default path with placeholderRendering: 'columns'", () => {
      const plugin = new ServerSidePlugin({ placeholderRendering: 'columns' });
      plugin.attach(createServerSideMockGrid() as any);
      const rowEl = document.createElement('div');
      expect(plugin.renderRow(createLoadingPlaceholder(0), rowEl)).toBe(false);
      expect(rowEl.classList.contains('tbw-row-loading')).toBe(false);
    });

    it('claims renderRow before default-priority plugins', () => {
      expect(ServerSidePlugin.manifest.hookPriority?.renderRow).toBeLessThan(0);
    });
  });

  describe('isNodeLoaded', () => {
    it('should return false when no data is loaded', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      expect(plugin.isNodeLoaded(0)).toBe(false);
    });

    it('should return true for rows in loaded blocks', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 100 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 100 }, (_, i) => ({ id: i })), totalNodeCount: 500 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      expect(plugin.isNodeLoaded(0)).toBe(true);
      expect(plugin.isNodeLoaded(50)).toBe(true);
      expect(plugin.isNodeLoaded(99)).toBe(true);
      expect(plugin.isNodeLoaded(100)).toBe(false);
    });
  });

  describe('refresh', () => {
    it('should clear cache and trigger re-render', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid.requestRender.mockClear();
      plugin.refresh();

      // refresh() delegates to setDataSource() which is async — wait for re-fetch
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('should do nothing when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      plugin.refresh(); // should not throw
      expect(grid.requestRender).not.toHaveBeenCalled();
    });
  });

  describe('sort/filter cache invalidation (regression)', () => {
    it('should refetch and requestRender after sort-change so the table is not left blank', async () => {
      // Reproduces: clicking sort wipes caches (totalNodeCount=0, managedNodes=[]),
      // the immediate processRows returns []. onModelChange must (a) trigger a fresh
      // fetch with new enrichment params and (b) on resolve call requestRender() so
      // processRows runs again and managedNodes regrows. Otherwise the grid stays blank.
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], totalNodeCount: 100 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      // Initial processRows simulates the scheduler running after setDataSource
      plugin.processRows([]);
      grid.requestRender.mockClear();
      (mockDS.getRows as any).mockClear();

      // Simulate sort-change: should reset caches AND eagerly refetch
      grid._pluginManager.emitPluginEvent('sort-change', {});

      // Right after onModelChange synchronously: caches cleared, processRows returns []
      expect(plugin.processRows([]).length).toBe(0);

      // Wait for the refetch to actually resolve (synchronous requestRender from
      // onModelChange would otherwise resolve waitFor too early).
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBeGreaterThan(0));
      expect(mockDS.getRows).toHaveBeenCalled();
      // The post-resolve path must call requestRender (full ROWS phase) — not just
      // requestVirtualRefresh — so processRows runs again and managedNodes regrows.
      expect(grid.requestRender).toHaveBeenCalled();

      // After the fresh processRows runs, the table is no longer blank
      const refreshed = plugin.processRows([]);
      expect(refreshed.length).toBe(100);
      expect(refreshed[0]).toEqual({ id: 0 });
    });
  });

  describe('purgeCache', () => {
    it('should clear loaded blocks without triggering render', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid.requestRender.mockClear();
      plugin.purgeCache();

      expect(plugin.getLoadedBlockCount()).toBe(0);
      expect(grid.requestRender).not.toHaveBeenCalled();
    });

    it('drops a pending scroll debounce so the purge does not refetch', async () => {
      vi.useFakeTimers();
      try {
        const plugin = new ServerSidePlugin({ pageSize: 10 });
        const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 10, end: 20 } });
        plugin.attach(grid as any);

        const ds = pagedDS(100);
        plugin.setDataSource(ds);
        await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

        // Immediate check fetches block 1; the debounced re-check is now pending.
        plugin.onScroll({ scrollTop: 500, scrollLeft: 0, direction: 'vertical' } as any);
        expect(ds.getRows).toHaveBeenCalledTimes(2);

        plugin.purgeCache();
        vi.advanceTimersByTime(200);

        // Without clearing the timer the debounce would refetch the purged block 1.
        expect(ds.getRows).toHaveBeenCalledTimes(2);
        expect(plugin.getLoadedBlockCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('datasource:loading (root blocks)', () => {
    it('stays loading until every in-flight root block settles, including block 0 from setDataSource()', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 0, end: 20 } });
      plugin.attach(grid as any);
      const loading: boolean[] = [];
      grid.addEventListener('datasource:loading', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (!detail.context) loading.push(detail.loading);
      });

      const resolvers = new Map<number, (result: { rows: unknown[]; totalNodeCount: number }) => void>();
      const ds: ServerSideDataSource = {
        getRows: ({ startNode }) =>
          new Promise((resolve) => {
            resolvers.set(startNode, resolve);
          }),
      };
      plugin.setDataSource(ds);
      // A scroll while block 0 is in flight starts block 1 (total still unknown).
      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);
      expect([...resolvers.keys()]).toEqual([0, 10]);
      loading.length = 0;

      resolvers.get(0)!({ rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 });
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      // Block 1 is still in flight — no `false` may have been broadcast yet.
      expect(loading).not.toContain(false);

      resolvers.get(10)!({ rows: Array.from({ length: 10 }, (_, i) => ({ id: 10 + i })), totalNodeCount: 100 });
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(loading.at(-1)).toBe(false);

      plugin.detach();
    });
  });

  describe('initial block landing after a scroll-started block', () => {
    it('still schedules the post-render viewport refill so the freed slot is used', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10, maxConcurrentRequests: 2 });
      // Viewport needs blocks 0–3; only two requests may be in flight.
      const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 0, end: 40 } });
      plugin.attach(grid as any);
      const resolvers = new Map<number, (result: { rows: unknown[]; totalNodeCount: number }) => void>();
      const ds: ServerSideDataSource = {
        getRows: ({ startNode }) =>
          new Promise((resolve) => {
            resolvers.set(startNode, resolve);
          }),
      };
      const rowsFor = (start: number) => Array.from({ length: 10 }, (_, i) => ({ id: start + i }));
      /** Run the render block 0/1 scheduled: processRows sizes managedNodes, afterRender consumes the viewport check. */
      const render = () => {
        grid.rows = plugin.processRows([]);
        plugin.afterRender();
      };

      plugin.setDataSource(ds); // block 0 in flight
      // Viewport check while block 0 is pending (a scroll, minus its debounce
      // timer, which would otherwise refill on its own and mask the regression).
      plugin['loadRequiredBlocks']();
      expect([...resolvers.keys()]).toEqual([0, 10]); // block 1 took the second slot

      // Block 1 lands FIRST: its render sizes managedNodes; its re-check starts block 2.
      resolvers.get(10)!({ rows: rowsFor(10), totalNodeCount: 100 });
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      render();
      expect([...resolvers.keys()]).toEqual([0, 10, 20]); // block 3 throttled behind 0 and 2

      // Block 0 lands: it frees a slot. managedNodes is already sized, so nothing
      // but `initial` puts it on the rebuild path — without that, no viewport check
      // runs and block 3 waits for block 2 to settle.
      resolvers.get(0)!({ rows: rowsFor(0), totalNodeCount: 100 });
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      render();

      expect([...resolvers.keys()]).toEqual([0, 10, 20, 30]);

      plugin.detach();
    });
  });

  describe('onScroll', () => {
    it('should trigger block loading on scroll', async () => {
      vi.useFakeTimers();
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 10, end: 20 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Scroll to trigger loading of block 1
      plugin.onScroll({ scrollTop: 500, scrollLeft: 0, direction: 'vertical' } as any);

      // The debounced check should fire
      vi.advanceTimersByTime(200);

      // getRows should have been called for block 1 (after initial block 0)
      expect(mockDS.getRows).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not fetch when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      // Should not throw
      plugin.onScroll({ scrollTop: 500, scrollLeft: 0, direction: 'vertical' } as any);
    });
  });

  describe('datasource:data generation (#538)', () => {
    it('stamps blocks of one cache with the same generation and bumps it on every cache discard', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 0, end: 10 } });
      plugin.attach(grid as any);
      const blocks: Array<{ startNode: number; generation: number }> = [];
      grid._pluginManager.subscribe({}, 'datasource:data', (detail: any) => blocks.push(detail));

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation(({ startNode }: { startNode: number }) =>
          Promise.resolve({
            rows: Array.from({ length: 10 }, (_, i) => ({ id: startNode + i })),
            totalNodeCount: 100,
          }),
        ),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(blocks).toHaveLength(1));
      grid.rows = plugin.processRows([]);

      grid._virtualization.start = 20;
      grid._virtualization.end = 30;
      plugin.onScroll({ scrollTop: 800, scrollLeft: 0, direction: 'vertical' } as any);
      await vi.waitFor(() => expect(blocks.length).toBeGreaterThan(1));
      expect(blocks[1].startNode).toBe(20);
      expect(blocks[1].generation).toBe(blocks[0].generation);
      const firstGeneration = blocks[0].generation;
      // Aborted old-generation blocks are dropped, never broadcast — wait on the new generation, not on time.
      const latest = () => Math.max(...blocks.map((b) => b.generation));

      plugin.refresh();
      await vi.waitFor(() => expect(latest()).toBeGreaterThan(firstGeneration));
      const refreshed = latest();

      plugin.purgeCache();
      grid.rows = plugin.processRows([]);
      plugin.onScroll({ scrollTop: 800, scrollLeft: 0, direction: 'vertical' } as any);
      await vi.waitFor(() => expect(latest()).toBeGreaterThan(refreshed));

      plugin.detach();
    });
  });

  describe('claimed data (structural plugin) rebuilds the row model', () => {
    it('should requestRender, not requestVirtualRefresh, when a plugin claimed the block', async () => {
      const requestVirtualRefresh = vi.fn();
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        requestVirtualRefresh,
        _virtualization: { enabled: true, start: 0, end: 10 },
      });
      plugin.attach(grid as any);

      // Stand in for Tree/GroupingRows, which derive their own row model from
      // managedNodes and therefore keep referencing the discarded placeholders.
      grid._pluginManager.subscribe({}, 'datasource:data', (detail: any) => {
        detail.claimed = true;
      });

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation(({ startNode }: { startNode: number }) =>
          Promise.resolve({
            rows: Array.from({ length: 10 }, (_, i) => ({ id: startNode + i })),
            totalNodeCount: 100,
          }),
        ),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Size managedNodes so the second block would otherwise take the cheap
      // in-place path (previousManagedLength > 0, length === totalNodeCount).
      grid.rows = plugin.processRows([]);
      (grid.requestRender as any).mockClear();

      grid._virtualization.start = 20;
      grid._virtualization.end = 30;
      plugin.onScroll({ scrollTop: 800, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(grid.requestRender).toHaveBeenCalled();
      expect(requestVirtualRefresh).not.toHaveBeenCalled();

      plugin.detach();
    });

    it('should use requestVirtualRefresh when no plugin claims the block', async () => {
      const requestVirtualRefresh = vi.fn();
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        requestVirtualRefresh,
        _virtualization: { enabled: true, start: 0, end: 10 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation(({ startNode }: { startNode: number }) =>
          Promise.resolve({
            rows: Array.from({ length: 10 }, (_, i) => ({ id: startNode + i })),
            totalNodeCount: 100,
          }),
        ),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Mirror core: with no downstream transform, `_rows` IS managedNodes.
      grid.rows = plugin.processRows([]);
      (grid.requestRender as any).mockClear();

      grid._virtualization.start = 20;
      grid._virtualization.end = 30;
      plugin.onScroll({ scrollTop: 800, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(requestVirtualRefresh).toHaveBeenCalled());
      expect(grid.requestRender).not.toHaveBeenCalled();

      plugin.detach();
    });

    /** Plugin on a mock grid with block 0 of a paged `total`-row source loaded. */
    async function withFirstBlock(
      config: Partial<ServerSideConfig>,
      total: number,
      gridOverrides: Record<string, unknown>,
    ) {
      const plugin = new ServerSidePlugin({ pageSize: 10, ...config });
      const grid = createServerSideMockGrid(gridOverrides);
      plugin.attach(grid as any);
      const ds = pagedDS(total);
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      return { plugin, grid, ds };
    }

    it("should re-check the viewport after the render a filterMode: 'local' filter change requests (#520)", async () => {
      const { plugin, grid, ds } = await withFirstBlock({ filterMode: 'local' }, 30, {
        _virtualization: { enabled: true, start: 0, end: 5 },
      });
      // The render block 0 requested: the 5-row viewport needs nothing more.
      grid.rows = plugin.processRows([]);
      plugin.afterRender();
      expect(ds.getRows).toHaveBeenCalledTimes(1);

      // A local filter rejects block 0. Its render moves block 1's placeholders into
      // view without any scroll.
      grid._pluginManager.emitPluginEvent('filter-change', {});
      grid.rows = grid.rows.filter(isLoadingPlaceholder);
      plugin.afterRender();

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(ds.getRows).toHaveBeenLastCalledWith(expect.objectContaining({ startNode: 10, endNode: 20 }));

      plugin.detach();
    });

    it('should request the blocks of on-screen placeholders after a later stage dropped rows above them (#520)', async () => {
      const { plugin, grid, ds } = await withFirstBlock({}, 30, {
        _virtualization: { enabled: true, start: 0, end: 5 },
      });

      // Unfiltered: the 5-row viewport needs only block 0.
      grid.rows = plugin.processRows([]);
      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);
      expect(ds.getRows).toHaveBeenCalledTimes(1);

      // A local filter drops every row of block 0: placeholders 10–29 now sit at display 0–19.
      grid.rows = grid.rows.filter(isLoadingPlaceholder);
      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(ds.getRows).toHaveBeenLastCalledWith(expect.objectContaining({ startNode: 10, endNode: 20 }));

      plugin.detach();
    });

    it('should requestRender with a new managedNodes identity when a later stage transformed the rows (#520)', async () => {
      const requestVirtualRefresh = vi.fn();
      const { plugin, grid } = await withFirstBlock({}, 100, {
        requestVirtualRefresh,
        _virtualization: { enabled: true, start: 0, end: 10 },
      });

      const managed = plugin.processRows([]);
      // Stand in for a later stage (e.g. MultiSort's `[...rows]`) that derived `_rows` from managedNodes.
      grid.rows = [...managed];
      (grid.requestRender as any).mockClear();

      grid._virtualization.start = 20;
      grid._virtualization.end = 30;
      plugin.onScroll({ scrollTop: 800, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(grid.requestRender).toHaveBeenCalled();
      expect(requestVirtualRefresh).not.toHaveBeenCalled();
      // Downstream caches keyed on the input reference must see a new array.
      const next = plugin.processRows([]);
      expect(next).not.toBe(managed);
      expect(next[25]).toEqual({ id: 25 });

      plugin.detach();
    });

    it('should not request blocks past a total that shrank before the scheduled render (#520)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10, maxConcurrentRequests: 1 });
      const grid = createServerSideMockGrid({ _virtualization: { enabled: true, start: 0, end: 20 } });
      plugin.attach(grid as any);
      // Block 0 reports 100 nodes; block 1 declares the real end at node 14.
      const getRows = vi.fn(({ startNode }: { startNode: number }) =>
        Promise.resolve(
          startNode === 0
            ? { rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 }
            : { rows: Array.from({ length: 5 }, (_, i) => ({ id: startNode + i })), totalNodeCount: 100, lastNode: 14 },
        ),
      );
      plugin.setDataSource({ getRows });
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // A local filter dropped block 0: placeholders 10–29 fill the 20-row viewport.
      grid.rows = plugin.processRows([]).filter(isLoadingPlaceholder);
      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));

      // Block 1's synchronous re-check still sees the old placeholders 15–29.
      expect(getRows.mock.calls.map(([params]) => params.startNode)).toEqual([0, 10]);
      expect(plugin.getTotalNodeCount()).toBe(15);

      plugin.detach();
    });

    it('should request the blocks of on-screen placeholders a structural mapping renumbered (#520)', async () => {
      const { plugin, grid, ds } = await withFirstBlock({ filterMode: 'local' }, 30, {
        _virtualization: { enabled: true, start: 0, end: 5 },
      });
      // Stand in for Tree after a local filter kept only root 0: it numbers the remaining
      // roots from zero, so it maps the viewport to nodes [0, 6) — cached block 0 only.
      Object.defineProperty(grid, 'query', {
        value: (type: string) =>
          type === 'datasource:viewport-mapping' ? [{ startNode: 0, endNode: 6, totalLoadedNodes: 21 }] : [],
        configurable: true,
      });
      const managed = plugin.processRows([]);
      grid.rows = [managed[0], ...managed.slice(10)];

      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));
      expect(ds.getRows).toHaveBeenLastCalledWith(expect.objectContaining({ startNode: 10, endNode: 20 }));

      plugin.detach();
    });

    it('should find on-screen placeholders with a fractional loadThreshold (#520)', async () => {
      const { plugin, grid, ds } = await withFirstBlock({ loadThreshold: 2.5 }, 30, {
        _virtualization: { enabled: true, start: 0, end: 5 },
      });
      // A local filter dropped block 0: placeholders 10–29 sit at display 0–19.
      grid.rows = plugin.processRows([]).filter(isLoadingPlaceholder);
      grid._virtualization.start = 5;
      grid._virtualization.end = 10;

      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(3));
      expect((ds.getRows as any).mock.calls.map(([params]: [{ startNode: number }]) => params.startNode)).toEqual([
        0, 10, 20,
      ]);

      plugin.detach();
    });
  });

  describe('loadThreshold', () => {
    it('should prefetch the next block when viewport is within threshold of an unloaded block', async () => {
      vi.useFakeTimers();
      // Viewport rows 0..10 normally only requires block 0 (size 10).
      // With loadThreshold: 5 the expanded range becomes 0..15, pulling in block 1.
      // Prefetch must fire on the initial fetch, not require a user scroll.
      const plugin = new ServerSidePlugin({ pageSize: 10, loadThreshold: 5 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 10 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Simulate the render that block 0 requested — the prefetch check runs there.
      plugin.afterRender();

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));

      // Block 0 (initial) + block 1 (prefetched via threshold) should both have been requested.
      const calls = (mockDS.getRows as any).mock.calls.map((c: any[]) => c[0]);
      expect(calls).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ startNode: 0, endNode: 10 }),
          expect.objectContaining({ startNode: 10, endNode: 20 }),
        ]),
      );

      vi.useRealTimers();
    });

    it('should not prefetch beyond totalNodeCount', async () => {
      vi.useFakeTimers();
      // Total of 15 rows means only blocks 0 and 1 exist (block 1 has rows 10..14).
      // loadThreshold: 50 would otherwise request many blocks past the end.
      const plugin = new ServerSidePlugin({ pageSize: 10, loadThreshold: 50 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 5 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation((params) => {
          const rows = Array.from({ length: Math.max(0, Math.min(15, params.endNode) - params.startNode) }, (_, i) => ({
            id: params.startNode + i,
          }));
          return Promise.resolve({ rows, totalNodeCount: 15 });
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(15));

      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);
      vi.advanceTimersByTime(200);
      await vi.waitFor(() => expect((mockDS.getRows as any).mock.calls.length).toBeGreaterThanOrEqual(2));

      // Only the 2 valid blocks should have been requested (no calls past row 15).
      expect((mockDS.getRows as any).mock.calls.length).toBe(2);

      vi.useRealTimers();
    });

    it('should default to 0 (no prefetch beyond visible viewport)', async () => {
      vi.useFakeTimers();
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 10 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      plugin.onScroll({ scrollTop: 0, scrollLeft: 0, direction: 'vertical' } as any);
      vi.advanceTimersByTime(200);

      // Only block 0 should have been fetched — viewport ends exactly at row 10,
      // and getRequiredBlocks(0, 10, 10) = [0] (endNode-1 = 9 falls in block 0).
      expect((mockDS.getRows as any).mock.calls.length).toBe(1);

      vi.useRealTimers();
    });
  });

  describe('viewport taller than one block (#507)', () => {
    it('should load further visible blocks after the post-data render, without loadThreshold or scroll', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      // Before data arrives the grid has no rows, so the virtual window is empty.
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 0 },
      });
      plugin.attach(grid as any);

      const ds = pagedDS(100);
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      expect(ds.getRows).toHaveBeenCalledTimes(1);

      // Simulate the render that block 0 requested: rows exist now and the
      // virtual window spans 28 rows (blocks 0, 1 and 2). Core assigns `_rows`.
      grid.rows = plugin.processRows([]);
      grid._virtualization.end = 28;
      plugin.afterRender();

      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(3));
      const starts = (ds.getRows as any).mock.calls.map((c: any[]) => c[0].startNode);
      expect(starts).toEqual([0, 10, 20]);

      plugin.detach();
    });

    it('should keep filling the viewport as each block lands (respecting maxConcurrentRequests)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10, maxConcurrentRequests: 1 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 0 },
      });
      plugin.attach(grid as any);

      let inFlight = 0;
      let maxInFlight = 0;
      const inner = pagedDS(100);
      const ds: ServerSideDataSource = {
        getRows: vi.fn().mockImplementation(async (params) => {
          maxInFlight = Math.max(maxInFlight, ++inFlight);
          try {
            return await inner.getRows(params);
          } finally {
            inFlight--;
          }
        }),
      };
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid._virtualization.end = 28;
      plugin.afterRender();
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(3));

      expect(ds.getRows).toHaveBeenCalledTimes(3);
      expect(maxInFlight).toBe(1);

      plugin.detach();
    });

    it('should only re-check once per data load (scroll renders do not re-run it)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 0 },
      });
      plugin.attach(grid as any);

      const ds = pagedDS(100);
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid._virtualization.end = 10;
      plugin.afterRender(); // consumes the pending check; block 0 already covers 0..10

      grid._virtualization.start = 50;
      grid._virtualization.end = 60;
      plugin.afterRender(); // no pending check → no fetch (onScroll owns this path)

      expect(ds.getRows).toHaveBeenCalledTimes(1);

      plugin.detach();
    });

    it('should not refetch when purgeCache() runs between block resolution and afterRender()', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 0, end: 0 },
      });
      plugin.attach(grid as any);

      const ds = pagedDS(100);
      plugin.setDataSource(ds);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Block 0 landed and scheduled a render; the consumer purges before it runs.
      plugin.purgeCache();

      // The scheduled render rebuilds placeholders from the retained total count.
      plugin.processRows([]);
      grid._virtualization.end = 28;
      plugin.afterRender();
      await Promise.resolve();

      // purgeCache() clears without refreshing — nothing is requested until the next scroll.
      expect(ds.getRows).toHaveBeenCalledTimes(1);
      expect(plugin.getLoadedBlockCount()).toBe(0);

      plugin.detach();
    });
  });

  describe('detach', () => {
    it('should clean up all state', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      plugin.detach();

      expect(plugin.getTotalNodeCount()).toBe(0);
      expect(plugin.getLoadedBlockCount()).toBe(0);
    });
  });

  describe('getTotalNodeCount', () => {
    it('should return 0 initially', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      expect(plugin.getTotalNodeCount()).toBe(0);
    });
  });

  describe('getLoadedBlockCount', () => {
    it('should return 0 initially', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      expect(plugin.getLoadedBlockCount()).toBe(0);
    });
  });

  describe('infinite scroll (lastNode)', () => {
    it('should enter infinite scroll mode when totalNodeCount is -1', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
          totalNodeCount: -1,
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // In infinite scroll mode, processRows should show loaded rows + one extra block of placeholders
      const result = plugin.processRows([]);
      expect(result.length).toBe(10); // 5 loaded + 5 placeholders
      expect(result[0]).toEqual({ id: 0 });
      expect(result[4]).toEqual({ id: 4 });
      expect((result[5] as any).__loading).toBe(true);
    });

    it('should finalize total when lastNode is returned', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
          totalNodeCount: -1,
          lastNode: 7, // Total is 8 nodes (0-7)
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // lastNode should override infinite scroll and set exact total
      expect(plugin.getTotalNodeCount()).toBe(8);
      const result = plugin.processRows([]);
      expect(result.length).toBe(8);
    });

    it('should auto-detect end of data when a short block is returned', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      // First block returns fewer rows than blockSize → end of data
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 0 }, { id: 1 }, { id: 2 }],
          totalNodeCount: -1,
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Short block (3 rows < blockSize 10) → total is 3
      expect(plugin.getTotalNodeCount()).toBe(3);
      const result = plugin.processRows([]);
      expect(result.length).toBe(3);
    });

    it('should use exact totalNodeCount when provided (non -1)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
          totalNodeCount: 100,
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Not in infinite scroll — exact total used
      expect(plugin.getTotalNodeCount()).toBe(100);
      const result = plugin.processRows([]);
      expect(result.length).toBe(100);
    });

    it('should reset infinite scroll mode on refresh', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValueOnce({
            rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
            totalNodeCount: -1,
          })
          .mockResolvedValueOnce({
            rows: [{ id: 0 }, { id: 1 }],
            totalNodeCount: 2,
          }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // First: infinite scroll mode
      let result = plugin.processRows([]);
      expect(result.length).toBe(10); // 5 + 5 placeholders

      // Refresh with finite response
      plugin.refresh();
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(plugin.getTotalNodeCount()).toBe(2));

      result = plugin.processRows([]);
      expect(result.length).toBe(2);
    });

    it('should prioritize lastNode over totalNodeCount when both are provided', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 0 }],
          totalNodeCount: 1000, // Server says 1000 but also provides lastNode
          lastNode: 49, // Actual last node is 49 → total = 50
        }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      expect(plugin.getTotalNodeCount()).toBe(50);
    });
  });

  describe('sortMode / filterMode (issue #231)', () => {
    function setupQueriesGrid() {
      const grid = createServerSideMockGrid();
      // Stub query() to return a sort + filter model so getEnrichmentParams has
      // something to filter out under 'local' mode.
      const sortModel = [{ field: 'name', direction: 'asc' as const }];
      const filterModel = { status: 'active' };
      Object.defineProperty(grid, 'query', {
        value: (q: string) => {
          if (q === 'sort:get-model') return [sortModel];
          if (q === 'filter:get-model') return [filterModel];
          return [];
        },
        configurable: true,
      });
      return { grid, sortModel, filterModel };
    }

    it('default (sortMode omitted) purges cache and refetches on sort-change', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 5 }, (_, i) => ({ id: i })), totalNodeCount: 50 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      (mockDS.getRows as any).mockClear();

      grid._pluginManager.emitPluginEvent('sort-change', {});

      // Cache cleared synchronously
      expect(plugin.getLoadedBlockCount()).toBe(0);
      // Eager refetch fires
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalled());
    });

    it('sortMode: "local" does NOT purge cache and does NOT refetch on sort-change', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local' });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 5 }, (_, i) => ({ id: i })), totalNodeCount: 50 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      (mockDS.getRows as any).mockClear();
      grid.requestRender.mockClear();

      grid._pluginManager.emitPluginEvent('sort-change', {});

      // Cache preserved, no refetch, just a re-render
      expect(plugin.getLoadedBlockCount()).toBe(1);
      expect(mockDS.getRows).not.toHaveBeenCalled();
      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('filterMode: "local" does NOT purge cache and does NOT refetch on filter-change', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, filterMode: 'local' });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 5 }, (_, i) => ({ id: i })), totalNodeCount: 50 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      (mockDS.getRows as any).mockClear();
      grid.requestRender.mockClear();

      grid._pluginManager.emitPluginEvent('filter-change', {});

      expect(plugin.getLoadedBlockCount()).toBe(1);
      expect(mockDS.getRows).not.toHaveBeenCalled();
      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('mixed sortMode: "local", filterMode: "server" — only filter purges cache', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local', filterMode: 'server' });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 5 }, (_, i) => ({ id: i })), totalNodeCount: 50 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      (mockDS.getRows as any).mockClear();

      // sort-change → re-render only, cache intact
      grid._pluginManager.emitPluginEvent('sort-change', {});
      expect(plugin.getLoadedBlockCount()).toBe(1);
      expect(mockDS.getRows).not.toHaveBeenCalled();

      // filter-change → cache purged + refetch
      grid._pluginManager.emitPluginEvent('filter-change', {});
      expect(plugin.getLoadedBlockCount()).toBe(0);
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalled());
    });

    it('block fetch params omit sortModel under sortMode: "local"', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local' });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalled());

      const call = (mockDS.getRows as any).mock.calls[0][0];
      expect(call.sortModel).toBeUndefined();
      // filter still flows through (default 'server')
      expect(call.filterModel).toEqual({ status: 'active' });
    });

    it('block fetch params omit filterModel under filterMode: "local"', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, filterMode: 'local' });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalled());

      const call = (mockDS.getRows as any).mock.calls[0][0];
      expect(call.filterModel).toBeUndefined();
      expect(call.sortModel).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('both modes "local" — neither sort nor filter is sent on block fetch', async () => {
      const plugin = new ServerSidePlugin({
        pageSize: 5,
        sortMode: 'local',
        filterMode: 'local',
      });
      const { grid } = setupQueriesGrid();
      plugin.attach(grid as any);
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(mockDS.getRows).toHaveBeenCalled());

      const call = (mockDS.getRows as any).mock.calls[0][0];
      expect(call.sortModel).toBeUndefined();
      expect(call.filterModel).toBeUndefined();
    });

    it('processRows applies core _sortState to managedNodes when sortMode === "local"', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local' });
      const grid = createServerSideMockGrid();
      // Provide columns and a sort state on the grid for the plugin to read.
      Object.defineProperty(grid, '_columns', {
        value: [{ field: 'name', sortable: true }],
        writable: true,
        configurable: true,
      });
      Object.defineProperty(grid, '_sortState', {
        value: { field: 'name', direction: -1 as const },
        writable: true,
        configurable: true,
      });
      plugin.attach(grid as any);
      const rows = [{ name: 'Alice' }, { name: 'Charlie' }, { name: 'Bob' }, { name: 'Eve' }, { name: 'Dave' }];
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows, totalNodeCount: 5 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // processRows should return rows sorted by name desc.
      const result = plugin.processRows([]) as { name: string }[];
      expect(result.map((r) => r.name)).toEqual(['Eve', 'Dave', 'Charlie', 'Bob', 'Alice']);
    });

    it('processRows leaves managedNodes order untouched when sortMode is server (default)', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      Object.defineProperty(grid, '_columns', {
        value: [{ field: 'name', sortable: true }],
        writable: true,
        configurable: true,
      });
      Object.defineProperty(grid, '_sortState', {
        value: { field: 'name', direction: -1 as const },
        writable: true,
        configurable: true,
      });
      plugin.attach(grid as any);
      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows, totalNodeCount: 3 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Default 'server' mode: ordering owned by backend; processRows returns
      // managedNodes in index order regardless of grid._sortState.
      const result = plugin.processRows([]) as { name: string }[];
      expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('processRows under sortMode === "local" honors gridConfig.sortHandler', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local' });
      // Custom sortHandler that always reverses input — distinct from default
      // comparator so we can confirm it actually ran.
      const sortHandler = vi.fn((input: any[]) => [...input].reverse());
      const grid = createServerSideMockGrid({
        effectiveConfig: { sortHandler },
      });
      Object.defineProperty(grid, '_columns', {
        value: [{ field: 'name', sortable: true }],
        writable: true,
        configurable: true,
      });
      Object.defineProperty(grid, '_sortState', {
        value: { field: 'name', direction: 1 as const },
        writable: true,
        configurable: true,
      });
      plugin.attach(grid as any);
      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows, totalNodeCount: 3 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      const result = plugin.processRows([]) as { name: string }[];

      expect(sortHandler).toHaveBeenCalledOnce();
      expect(sortHandler.mock.calls[0][1]).toEqual({ field: 'name', direction: 1 });
      // Reverse of [Alice, Bob, Charlie] = [Charlie, Bob, Alice]
      expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    it('processRows falls back to managedNodes order when sortHandler returns a Promise', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5, sortMode: 'local' });
      const sortHandler = vi.fn(() => Promise.resolve([]));
      const grid = createServerSideMockGrid({
        effectiveConfig: { sortHandler },
      });
      Object.defineProperty(grid, '_columns', {
        value: [{ field: 'name', sortable: true }],
        writable: true,
        configurable: true,
      });
      Object.defineProperty(grid, '_sortState', {
        value: { field: 'name', direction: 1 as const },
        writable: true,
        configurable: true,
      });
      plugin.attach(grid as any);
      const rows = [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }];
      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows, totalNodeCount: 3 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      const result = plugin.processRows([]) as { name: string }[];

      // Async handler can't be awaited inside processRows — managedNodes order is preserved.
      expect(result.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('QA regressions: row-model sizing, superseded requests, sync throws', () => {
    /** Data source serving full `pageSize`-row blocks with an unknown total (infinite scroll). */
    const infiniteDS = (blockSize: number, lastBlockRows = blockSize, lastBlock = Infinity): ServerSideDataSource => ({
      getRows: vi.fn(({ startNode }: { startNode: number }) => {
        const length = startNode / blockSize === lastBlock ? lastBlockRows : blockSize;
        return Promise.resolve({
          rows: Array.from({ length }, (_, i) => ({ id: startNode + i })),
          totalNodeCount: -1,
        });
      }),
    });

    it('re-runs processRows when a block grows the infinite-scroll estimate', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid({ requestVirtualRefresh: vi.fn() });
      grid._virtualization = { enabled: false, start: 0, end: 10 };
      plugin.attach(grid as any);
      plugin.setDataSource(infiniteDS(5));
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      grid.rows = plugin.processRows([]);
      expect(grid.rows.length).toBe(10);

      grid.requestRender.mockClear();
      plugin.afterRender(); // fetches block 1 (rows 5..9)
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));

      expect(grid.requestRender).toHaveBeenCalled();
      expect(plugin.processRows([]).length).toBe(15); // 10 loaded + one placeholder block
    });

    it('re-runs processRows when a short block shrinks the infinite-scroll estimate', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid({ requestVirtualRefresh: vi.fn() });
      grid._virtualization = { enabled: false, start: 0, end: 10 };
      plugin.attach(grid as any);
      plugin.setDataSource(infiniteDS(5, 2, 1)); // block 1 returns 2 rows → total 7
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      grid.rows = plugin.processRows([]);

      grid.requestRender.mockClear();
      plugin.afterRender();
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(2));

      expect(plugin.getTotalNodeCount()).toBe(7);
      expect(grid.requestRender).toHaveBeenCalled();
      const result = plugin.processRows([]);
      expect(result.length).toBe(7);
      expect(result.some(isLoadingPlaceholder)).toBe(false);
    });

    it('keeps a superseding request abortable after the superseded one settles', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      const signals: AbortSignal[] = [];
      const ds: ServerSideDataSource = {
        getRows: vi.fn(({ signal }: { signal: AbortSignal }) => {
          signals.push(signal);
          return new Promise<never>(() => undefined);
        }),
      };
      plugin.setDataSource(ds);
      plugin.refresh(); // aborts request #0, starts #1 for the same block
      await new Promise((r) => setTimeout(r, 0)); // let #0's rejection settle

      grid._pluginManager.emitPluginEvent('sort-change', {});

      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(true); // was orphaned before the fix
    });

    it('does not let a superseded block-0 result overwrite the current one', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      // Ignores the abort signal, resolving in call order on demand.
      const resolvers: Array<(rows: unknown[]) => void> = [];
      const ds: ServerSideDataSource = {
        getRows: vi.fn(
          () =>
            new Promise((resolve) => {
              resolvers.push((rows) => resolve({ rows, totalNodeCount: rows.length }));
            }),
        ),
      };
      plugin.setDataSource(ds); // #0
      plugin.refresh(); // #1
      await new Promise((r) => setTimeout(r, 0));
      grid._pluginManager.emitPluginEvent('sort-change', {}); // #2 (+ viewport blocks)
      await new Promise((r) => setTimeout(r, 0));

      resolvers[2]([{ id: 'current' }]);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      resolvers[1]([{ id: 'stale' }]);
      await new Promise((r) => setTimeout(r, 0));

      expect(plugin.processRows([])[0]).toEqual({ id: 'current' });
    });

    it('purgeCache() releases loading slots so purged blocks can be refetched', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      grid._virtualization = { enabled: false, start: 0, end: 5 };
      plugin.attach(grid as any);
      const ds: ServerSideDataSource = { getRows: vi.fn(() => new Promise<never>(() => undefined)) };
      plugin.setDataSource(ds);
      plugin.purgeCache();
      await new Promise((r) => setTimeout(r, 0));

      plugin.onScroll({} as any);
      expect(ds.getRows).toHaveBeenCalledTimes(2);
    });

    it('surfaces a synchronous getRows() throw as datasource:error', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      const errors: unknown[] = [];
      const loading: boolean[] = [];
      grid.addEventListener('datasource:error', (e: Event) => errors.push((e as CustomEvent).detail.error));
      grid.addEventListener('datasource:loading', (e: Event) => loading.push((e as CustomEvent).detail.loading));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const ds: ServerSideDataSource = {
        getRows: () => {
          throw new Error('boom');
        },
      };

      expect(() => plugin.setDataSource(ds)).not.toThrow();
      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect((errors[0] as Error).message).toBe('boom');
      expect(loading.at(-1)).toBe(false);
    });

    it('surfaces a synchronous getChildRows() throw as datasource:error', async () => {
      const plugin = new ServerSidePlugin({ pageSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      const errors: unknown[] = [];
      grid.addEventListener('datasource:error', (e: Event) => errors.push((e as CustomEvent).detail.error));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      plugin.setDataSource({
        getRows: vi.fn().mockResolvedValue({ rows: [], totalNodeCount: 0 }),
        getChildRows: () => {
          throw new Error('child boom');
        },
      });

      expect(() =>
        plugin.handleQuery({ type: 'datasource:fetch-children', context: { context: { source: 'tree' } } }),
      ).not.toThrow();
      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect((errors[0] as Error).message).toBe('child boom');
    });
  });
});

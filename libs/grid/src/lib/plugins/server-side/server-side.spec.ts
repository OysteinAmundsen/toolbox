import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBlockNumber,
  getBlockRange,
  getRequiredBlocks,
  loadBlock,
  getRowFromCache,
  isBlockLoaded,
  isBlockLoading,
} from './datasource';
import { BlockCache } from './cache';
import type { ServerSideDataSource, GetRowsResult } from './types';

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
          totalRowCount: 1000,
        }),
      };

      const result = await loadBlock(mockDataSource, 2, 100, {
        sortModel: [{ field: 'name', direction: 'asc' }],
        filterModel: { status: 'active' },
      });

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startRow: 200,
        endRow: 300,
        sortModel: [{ field: 'name', direction: 'asc' }],
        filterModel: { status: 'active' },
      });

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.totalRowCount).toBe(1000);
    });

    it('should handle first block correctly', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [],
          totalRowCount: 0,
        }),
      };

      await loadBlock(mockDataSource, 0, 50, {});

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startRow: 0,
        endRow: 50,
        sortModel: undefined,
        filterModel: undefined,
      });
    });

    it('should propagate errors from dataSource', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      await expect(loadBlock(mockDataSource, 0, 100, {})).rejects.toThrow('Network error');
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
        Array.from({ length: 100 }, (_, i) => ({ id: i }))
      );
      loadedBlocks.set(
        1,
        Array.from({ length: 100 }, (_, i) => ({ id: 100 + i }))
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

  describe('isBlockLoaded', () => {
    it('should return false for missing block', () => {
      const loadedBlocks = new Map<number, any[]>();
      expect(isBlockLoaded(0, loadedBlocks)).toBe(false);
    });

    it('should return true for loaded block', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, []);
      loadedBlocks.set(2, []);

      expect(isBlockLoaded(0, loadedBlocks)).toBe(true);
      expect(isBlockLoaded(1, loadedBlocks)).toBe(false);
      expect(isBlockLoaded(2, loadedBlocks)).toBe(true);
    });
  });

  describe('isBlockLoading', () => {
    it('should return false for block not loading', () => {
      const loadingBlocks = new Set<number>();
      expect(isBlockLoading(0, loadingBlocks)).toBe(false);
    });

    it('should return true for loading block', () => {
      const loadingBlocks = new Set<number>([1, 3]);

      expect(isBlockLoading(0, loadingBlocks)).toBe(false);
      expect(isBlockLoading(1, loadingBlocks)).toBe(true);
      expect(isBlockLoading(2, loadingBlocks)).toBe(false);
      expect(isBlockLoading(3, loadingBlocks)).toBe(true);
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

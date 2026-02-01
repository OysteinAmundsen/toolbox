/**
 * Tests for the useGrid and useGridEvent composables.
 *
 * Tests cover:
 * - useGrid hook interface
 * - useGridEvent hook interface
 */

import { describe, expect, it } from 'vitest';
import { GRID_ELEMENT_KEY, useGrid } from './use-grid';
import { useGridEvent } from './use-grid-event';

// ═══════════════════════════════════════════════════════════════════════════
// USE GRID TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('use-grid', () => {
  describe('useGrid', () => {
    it('should be a valid function', () => {
      expect(useGrid).toBeDefined();
      expect(typeof useGrid).toBe('function');
    });

    it('should return an object with expected methods', () => {
      const result = useGrid();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('gridElement');
      expect(result).toHaveProperty('forceLayout');
      expect(result).toHaveProperty('getConfig');
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('getPlugin');
    });

    it('should return async functions for forceLayout and ready', () => {
      const result = useGrid();

      expect(typeof result.forceLayout).toBe('function');
      expect(typeof result.ready).toBe('function');
      expect(typeof result.getConfig).toBe('function');
      expect(typeof result.getPlugin).toBe('function');
    });

    it('should have gridElement in return object', () => {
      const result = useGrid();

      // gridElement is returned (may be undefined ref outside component context)
      expect(result).toHaveProperty('gridElement');
    });
  });

  describe('GRID_ELEMENT_KEY', () => {
    it('should be a valid injection key', () => {
      expect(GRID_ELEMENT_KEY).toBeDefined();
      expect(typeof GRID_ELEMENT_KEY).toBe('symbol');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// USE GRID EVENT TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('use-grid-event', () => {
  describe('useGridEvent', () => {
    it('should be a valid function', () => {
      expect(useGridEvent).toBeDefined();
      expect(typeof useGridEvent).toBe('function');
    });

    it('should accept event name and handler', () => {
      // Just verify it doesn't throw when called
      // Note: In real usage, this would be called inside a component setup
      expect(() => {
        useGridEvent('cell-click', () => {});
      }).not.toThrow();
    });
  });
});
